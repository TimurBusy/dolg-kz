import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDecipheriv, createHash } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { assertLoanTransition } from '../loans/loan-state-machine.js';
import { LoanAgreementPdfService } from './loan-agreement-pdf.service.js';
import { StorageService } from './storage.service.js';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly pdf: LoanAgreementPdfService,
    private readonly config: ConfigService,
  ) {}

  async generateLoanAgreement(userId: string, loanId: string) {
    const existing = await this.prisma.document.findFirst({
      where: { loanId, type: 'LOAN_AGREEMENT' },
      orderBy: { version: 'desc' },
    });
    if (existing) {
      await this.assertDocumentAccess(userId, existing.id);
      return existing;
    }

    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        terms: true,
        lender: { include: { identity: true } },
        borrower: { include: { identity: true } },
      },
    });

    if (!loan) throw new NotFoundException('Займ не найден');
    if (loan.lenderId !== userId) {
      throw new ForbiddenException('Сформировать договор может только заимодатель');
    }
    if (loan.status !== 'DRAFT') {
      throw new BadRequestException('Договор можно сформировать только для черновика');
    }
    if (!loan.borrower || !loan.borrower.identity) {
      throw new BadRequestException(
        'Заёмщик должен зарегистрироваться и заполнить профиль до формирования финального договора',
      );
    }
    if (!loan.lender.identity) {
      throw new BadRequestException('Заполните профиль заимодателя до формирования договора');
    }

    const lender = this.partyFromIdentity(loan.lender.phone, loan.lender.identity);
    const borrower = this.partyFromIdentity(loan.borrower.phone, loan.borrower.identity);

    const pdf = await this.pdf.generate({
      number: loan.number,
      lender,
      borrower,
      principalAmount: Number(loan.principalAmount),
      currency: loan.currency,
      issuedAt: loan.issuedAt,
      dueDate: loan.dueDate,
      purpose: loan.terms?.purpose,
    });

    const sha256Hash = createHash('sha256').update(pdf).digest('hex');
    const version = 1;
    const fileKey = `documents/${loan.id}/loan-agreement-v${version}.pdf`;

    await this.storage.put(fileKey, pdf, 'application/pdf');
    assertLoanTransition(loan.status, 'WAITING_LENDER_SIGNATURE');

    const [document] = await this.prisma.$transaction([
      this.prisma.document.create({
        data: {
          loanId: loan.id,
          type: 'LOAN_AGREEMENT',
          version,
          fileKey,
          sha256Hash,
        },
      }),
      this.prisma.loan.update({
        where: { id: loan.id },
        data: { status: 'WAITING_LENDER_SIGNATURE' },
      }),
    ]);

    return document;
  }

  async listForLoan(userId: string, loanId: string) {
    await this.assertLoanAccess(userId, loanId);
    return this.prisma.document.findMany({
      where: { loanId },
      orderBy: [{ type: 'asc' }, { version: 'desc' }],
    });
  }

  async get(userId: string, documentId: string) {
    return this.assertDocumentAccess(userId, documentId);
  }

  async file(userId: string, documentId: string) {
    const document = await this.assertDocumentAccess(userId, documentId);
    const body = await this.storage.get(document.fileKey);
    const actualHash = createHash('sha256').update(body).digest('hex');

    if (actualHash !== document.sha256Hash) {
      throw new BadRequestException('Нарушена целостность документа');
    }

    return { document, body };
  }

  async lockDocument(documentId: string) {
    const document = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new NotFoundException('Документ не найден');
    if (document.lockedAt) return document;

    return this.prisma.document.update({
      where: { id: documentId },
      data: {
        lockedAt: new Date(),
        status: 'LOCKED',
      },
    });
  }

  private async assertLoanAccess(userId: string, loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      select: { id: true, lenderId: true, borrowerId: true },
    });
    if (!loan) throw new NotFoundException('Займ не найден');
    if (loan.lenderId !== userId && loan.borrowerId !== userId) {
      throw new ForbiddenException('Нет доступа к документам займа');
    }
    return loan;
  }

  private async assertDocumentAccess(userId: string, documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        loan: {
          select: { lenderId: true, borrowerId: true },
        },
      },
    });
    if (!document) throw new NotFoundException('Документ не найден');
    if (document.loan.lenderId !== userId && document.loan.borrowerId !== userId) {
      throw new ForbiddenException('Нет доступа к документу');
    }
    return document;
  }

  private partyFromIdentity(
    phone: string,
    identity: {
      firstName: string | null;
      lastName: string | null;
      middleName: string | null;
      iinEncrypted: string | null;
    },
  ) {
    if (!identity.firstName || !identity.lastName || !identity.iinEncrypted) {
      throw new BadRequestException(
        'У обеих сторон должны быть заполнены ФИО и ИИН до формирования договора',
      );
    }

    return {
      fullName: [identity.lastName, identity.firstName, identity.middleName]
        .filter(Boolean)
        .join(' '),
      iin: this.decrypt(identity.iinEncrypted),
      phone,
    };
  }

  private encryptionKey() {
    const secret = this.config.get<string>('FIELD_ENCRYPTION_KEY', 'dev-only-change-me');
    return createHash('sha256').update(secret).digest();
  }

  private decrypt(value: string) {
    const payload = Buffer.from(value, 'base64url');
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const encrypted = payload.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
}
