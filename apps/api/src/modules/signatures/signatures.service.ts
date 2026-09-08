import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDecipheriv, createHash } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { assertLoanTransition } from '../loans/loan-state-machine.js';
import { SignatureProviderPort } from './signature-provider.port.js';

@Injectable()
export class SignaturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly provider: SignatureProviderPort,
    private readonly config: ConfigService,
  ) {}

  async start(userId: string, documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        loan: {
          include: {
            lender: { include: { identity: true } },
            borrower: { include: { identity: true } },
          },
        },
      },
    });
    if (!document) throw new NotFoundException('Документ не найден');
    if (document.type !== 'LOAN_AGREEMENT') {
      throw new BadRequestException('Этот тип документа пока нельзя подписать');
    }

    const role = this.resolveRole(userId, document.loan);
    const expectedStatus =
      role === 'LENDER'
        ? 'WAITING_LENDER_SIGNATURE'
        : 'WAITING_BORROWER_SIGNATURE';
    if (document.loan.status !== expectedStatus) {
      throw new BadRequestException('Сейчас очередь подписи другой стороны');
    }

    const active = await this.prisma.signature.findFirst({
      where: {
        documentId,
        userId,
        role,
        status: { in: ['CREATED', 'WAITING_FOR_USER', 'PROCESSING'] },
        expireAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (active) return this.publicSignature(active);

    const signer =
      role === 'LENDER' ? document.loan.lender : document.loan.borrower;
    if (!signer?.identity?.iinEncrypted) {
      throw new BadRequestException('Заполните ФИО и ИИН перед подписанием');
    }

    const meta = [
      { name: 'Номер договора', value: document.loan.number },
      {
        name: 'Сумма',
        value: `${Number(document.loan.principalAmount).toLocaleString('ru-RU')} ${document.loan.currency}`,
      },
    ];
    const backUrl = `${this.config.get<string>('WEB_BASE_URL', 'http://localhost:3000')}/loans/${document.loan.id}`;
    const description = `Dolg.kz: договор займа ${document.loan.number}`;

    if (role === 'LENDER') {
      if (!document.loan.borrower?.identity?.iinEncrypted) {
        throw new BadRequestException(
          'Заёмщик должен принять приглашение и заполнить профиль перед подписанием',
        );
      }

      const launch = await this.provider.createFirstOperation({
        description,
        backUrl,
      });

      const signature = await this.prisma.signature.create({
        data: {
          documentId,
          userId,
          role,
          status: 'WAITING_FOR_USER',
          providerContext: launch.context,
          qrCode: launch.qrCode,
          launchLink: launch.launchLink,
          expireAt: launch.expireAt,
        },
      });

      await this.documents.lockDocument(documentId);

      void this.finishLenderSignature(signature.id).catch(async (error) => {
        await this.failSignature(signature.id, error);
      });

      return this.publicSignature(signature);
    }

    if (!document.providerDocumentId) {
      throw new BadRequestException(
        'Документ ещё не зарегистрирован после подписи заимодателя',
      );
    }

    const launch = await this.provider.createAdditionalOperation({
      providerDocumentId: document.providerDocumentId,
      description,
      backUrl,
      meta,
    });

    const signature = await this.prisma.signature.create({
      data: {
        documentId,
        userId,
        role,
        status: 'WAITING_FOR_USER',
        providerContext: launch.context,
        qrCode: launch.qrCode,
        launchLink: launch.launchLink,
        expireAt: launch.expireAt,
      },
    });

    void this.finishBorrowerSignature(signature.id).catch(async (error) => {
      await this.failSignature(signature.id, error);
    });

    return this.publicSignature(signature);
  }

  async list(userId: string, documentId: string) {
    await this.assertPartyAccess(userId, documentId);
    const signatures = await this.prisma.signature.findMany({
      where: { documentId },
      orderBy: { createdAt: 'asc' },
    });
    return signatures.map((item) => this.publicSignature(item));
  }

  async status(userId: string, signatureId: string) {
    const signature = await this.prisma.signature.findUnique({
      where: { id: signatureId },
      include: {
        document: {
          include: {
            loan: {
              include: {
                lender: { include: { identity: true } },
                borrower: { include: { identity: true } },
              },
            },
          },
        },
      },
    });
    if (!signature) throw new NotFoundException('Операция подписи не найдена');

    const loan = signature.document.loan;
    if (loan.lenderId !== userId && loan.borrowerId !== userId) {
      throw new ForbiddenException('Нет доступа к операции подписи');
    }

    if (
      signature.role === 'BORROWER' &&
      ['CREATED', 'WAITING_FOR_USER', 'PROCESSING'].includes(signature.status) &&
      signature.providerOperationId &&
      signature.document.providerDocumentId
    ) {
      const providerStatus =
        await this.provider.getAdditionalOperationStatus({
          providerDocumentId: signature.document.providerDocumentId,
          operationId: signature.providerOperationId,
        });

      if (providerStatus.status === 'SIGNED') {
        const expectedUser = loan.borrower;
        if (!expectedUser?.identity?.iinEncrypted) {
          throw new BadRequestException('У заёмщика отсутствует ИИН');
        }
        const expectedIin = this.decrypt(expectedUser.identity.iinEncrypted);
        if (providerStatus.signerIin !== expectedIin) {
          await this.prisma.signature.update({
            where: { id: signature.id },
            data: {
              status: 'FAILED',
              error: 'Документ подписан ЭЦП другого человека',
            },
          });
          throw new ForbiddenException('Документ подписан ЭЦП другого человека');
        }

        assertLoanTransition(loan.status, 'SIGNED');
        const results = await this.prisma.$transaction([
          this.prisma.document.update({
            where: { id: signature.documentId },
            data: { status: 'SIGNED' },
          }),
          this.prisma.signature.update({
            where: { id: signature.id },
            data: {
              status: 'SIGNED',
              providerSignId: providerStatus.providerSignId,
              certificateInfo: providerStatus.certificateInfo as any,
              qrCode: null,
              launchLink: null,
              signedAt: new Date(),
            },
          }),
          this.prisma.loan.update({
            where: { id: loan.id },
            data: { status: 'SIGNED' },
          }),
        ]);
        return this.publicSignature(results[1]);
      }

      if (providerStatus.status === 'CANCELED') {
        const updated = await this.prisma.signature.update({
          where: { id: signature.id },
          data: {
            status: 'CANCELED',
            qrCode: null,
            launchLink: null,
          },
        });
        return this.publicSignature(updated);
      }

      if (providerStatus.status === 'FAILED') {
        const updated = await this.prisma.signature.update({
          where: { id: signature.id },
          data: {
            status: 'FAILED',
            error: providerStatus.error,
            qrCode: null,
            launchLink: null,
          },
        });
        return this.publicSignature(updated);
      }
    }

    const current = await this.prisma.signature.findUnique({
      where: { id: signatureId },
    });
    return this.publicSignature(current!);
  }

  private async finishLenderSignature(signatureId: string) {
    const signature = await this.prisma.signature.findUnique({
      where: { id: signatureId },
      include: {
        document: {
          include: {
            loan: {
              include: {
                lender: { include: { identity: true } },
                borrower: { include: { identity: true } },
              },
            },
          },
        },
      },
    });
    if (!signature) return;

    await this.prisma.signature.update({
      where: { id: signatureId },
      data: { status: 'PROCESSING' },
    });

    const { body } = await this.documents.file(
      signature.userId,
      signature.documentId,
    );
    const context = signature.providerContext as
      | { dataUrl?: string; signUrl?: string }
      | null;
    if (!context?.dataUrl || !context.signUrl) {
      throw new Error('Утерян контекст операции SIGEX');
    }

    const lenderIdentity = signature.document.loan.lender.identity;
    const borrowerIdentity = signature.document.loan.borrower?.identity;
    if (!lenderIdentity?.iinEncrypted || !borrowerIdentity?.iinEncrypted) {
      throw new Error('У сторон отсутствует ИИН');
    }

    const lenderIin = this.decrypt(lenderIdentity.iinEncrypted);
    const borrowerIin = this.decrypt(borrowerIdentity.iinEncrypted);
    const loan = signature.document.loan;

    const result = await this.provider.completeFirstOperation({
      context: {
        dataUrl: context.dataUrl,
        signUrl: context.signUrl,
      },
      file: body,
      title: `Договор займа ${loan.number}`,
      description: `Dolg.kz: договор займа ${loan.number}`,
      meta: [
        { name: 'Номер договора', value: loan.number },
        {
          name: 'Сумма',
          value: `${Number(loan.principalAmount).toLocaleString('ru-RU')} ${loan.currency}`,
        },
      ],
      signerIins: [lenderIin, borrowerIin],
    });

    if (result.status === 'CANCELED') {
      await this.prisma.signature.update({
        where: { id: signature.id },
        data: {
          status: 'CANCELED',
          qrCode: null,
          launchLink: null,
        },
      });
      return;
    }

    if (result.signerIin !== lenderIin) {
      throw new Error('Первую подпись поставил не заимодатель');
    }

    assertLoanTransition(loan.status, 'WAITING_BORROWER_SIGNATURE');
    await this.prisma.$transaction([
      this.prisma.document.update({
        where: { id: signature.documentId },
        data: {
          providerDocumentId: result.providerDocumentId,
          status: 'LOCKED',
        },
      }),
      this.prisma.signature.update({
        where: { id: signature.id },
        data: {
          status: 'SIGNED',
          providerSignId: result.providerSignId,
          certificateInfo: result.certificateInfo as any,
          qrCode: null,
          launchLink: null,
          signedAt: new Date(),
        },
      }),
      this.prisma.loan.update({
        where: { id: loan.id },
        data: { status: 'WAITING_BORROWER_SIGNATURE' },
      }),
    ]);
  }

  private async finishBorrowerSignature(signatureId: string) {
    const signature = await this.prisma.signature.findUnique({
      where: { id: signatureId },
      include: {
        document: {
          include: {
            loan: {
              include: {
                lender: { include: { identity: true } },
                borrower: { include: { identity: true } },
              },
            },
          },
        },
      },
    });
    if (!signature) return;

    await this.prisma.signature.update({
      where: { id: signatureId },
      data: { status: 'PROCESSING' },
    });

    const context = signature.providerContext as
      | { dataUrl?: string; signUrl?: string }
      | null;
    if (!context?.dataUrl || !context.signUrl) {
      throw new Error('Утерян контекст операции SIGEX для заёмщика');
    }

    const providerDocumentId = signature.document.providerDocumentId;
    if (!providerDocumentId) {
      throw new Error('Документ не зарегистрирован в SIGEX');
    }

    const borrowerIdentity = signature.document.loan.borrower?.identity;
    if (!borrowerIdentity?.iinEncrypted) {
      throw new Error('У заёмщика отсутствует ИИН');
    }

    const borrowerIin = this.decrypt(borrowerIdentity.iinEncrypted);
    const loan = signature.document.loan;
    const { body } = await this.documents.file(
      signature.userId,
      signature.documentId,
    );

    const result = await this.provider.completeAdditionalOperation({
      context: {
        dataUrl: context.dataUrl,
        signUrl: context.signUrl,
      },
      file: body,
      providerDocumentId,
      title: `Договор займа ${loan.number}`,
      meta: [
        { name: 'Номер договора', value: loan.number },
        {
          name: 'Сумма',
          value: `${Number(loan.principalAmount).toLocaleString('ru-RU')} ${loan.currency}`,
        },
      ],
      expectedSignerIin: borrowerIin,
    });

    if (result.status === 'CANCELED') {
      await this.prisma.signature.update({
        where: { id: signature.id },
        data: {
          status: 'CANCELED',
          qrCode: null,
          launchLink: null,
        },
      });
      return;
    }

    if (result.signerIin !== borrowerIin) {
      throw new Error('Вторую подпись поставил не заёмщик');
    }

    assertLoanTransition(loan.status, 'SIGNED');
    await this.prisma.$transaction([
      this.prisma.document.update({
        where: { id: signature.documentId },
        data: { status: 'SIGNED' },
      }),
      this.prisma.signature.update({
        where: { id: signature.id },
        data: {
          status: 'SIGNED',
          providerSignId: result.providerSignId,
          certificateInfo: result.certificateInfo as any,
          qrCode: null,
          launchLink: null,
          signedAt: new Date(),
        },
      }),
      this.prisma.loan.update({
        where: { id: loan.id },
        data: { status: 'SIGNED' },
      }),
    ]);
  }

  private resolveRole(
    userId: string,
    loan: { lenderId: string; borrowerId: string | null },
  ) {
    if (loan.lenderId === userId) return 'LENDER' as const;
    if (loan.borrowerId === userId) return 'BORROWER' as const;
    throw new ForbiddenException('Вы не являетесь стороной этого займа');
  }

  private async assertPartyAccess(userId: string, documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { loan: true },
    });
    if (!document) throw new NotFoundException('Документ не найден');
    if (
      document.loan.lenderId !== userId &&
      document.loan.borrowerId !== userId
    ) {
      throw new ForbiddenException('Нет доступа к документу');
    }
  }

  private publicSignature(signature: any) {
    return {
      id: signature.id,
      documentId: signature.documentId,
      userId: signature.userId,
      provider: signature.provider,
      role: signature.role,
      status: signature.status,
      providerOperationId: signature.providerOperationId,
      providerSignId: signature.providerSignId,
      qrCode: signature.qrCode,
      launchLink: signature.launchLink,
      expireAt: signature.expireAt,
      error: signature.error,
      createdAt: signature.createdAt,
      signedAt: signature.signedAt,
    };
  }

  private async failSignature(signatureId: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await this.prisma.signature.updateMany({
      where: {
        id: signatureId,
        status: { not: 'SIGNED' },
      },
      data: {
        status: 'FAILED',
        error: message.slice(0, 4000),
        qrCode: null,
        launchLink: null,
      },
    });
  }

  private encryptionKey() {
    const secret = this.config.get<string>(
      'FIELD_ENCRYPTION_KEY',
      'dev-only-change-me',
    );
    return createHash('sha256').update(secret).digest();
  }

  private decrypt(value: string) {
    const payload = Buffer.from(value, 'base64url');
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const encrypted = payload.subarray(28);
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey(),
      iv,
    );
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }
}
