import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';

@Injectable()
export class LoansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(lenderId: string, dto: CreateLoanDto) {
    const borrower = await this.prisma.user.findUnique({ where: { phone: dto.borrowerPhone } });
    if (borrower?.id === lenderId) throw new ForbiddenException('Нельзя оформить займ самому себе');

    const number = await this.nextNumber();
    const loan = await this.prisma.loan.create({
      data: {
        number,
        lenderId,
        borrowerId: borrower?.id,
        borrowerPhone: dto.borrowerPhone,
        principalAmount: dto.principalAmount,
        remainingAmount: dto.principalAmount,
        issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : null,
        dueDate: new Date(dto.dueDate),
        terms: { create: { purpose: dto.purpose, comment: dto.comment } },
      },
      include: this.include(),
    });
    return this.serialize(loan);
  }

  async list(userId: string, filter?: string) {
    const statusFilter = this.statusFilter(filter);
    const loans = await this.prisma.loan.findMany({
      where: { AND: [{ OR: [{ lenderId: userId }, { borrowerId: userId }] }, ...(statusFilter ? [{ status: { in: [...statusFilter] } }] : [])] },
      include: this.include(),
      orderBy: { createdAt: 'desc' },
    });
    return loans.map((loan) => this.serialize(loan));
  }

  async get(userId: string, id: string) {
    const loan = await this.prisma.loan.findUnique({ where: { id }, include: this.include() });
    if (!loan) throw new NotFoundException('Займ не найден');
    this.assertParty(userId, loan.lenderId, loan.borrowerId);
    return this.serialize(loan);
  }

  async update(userId: string, id: string, dto: UpdateLoanDto) {
    const loan = await this.prisma.loan.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException('Займ не найден');
    if (loan.lenderId !== userId) throw new ForbiddenException('Редактировать займ может только заимодатель');
    if (loan.status !== 'DRAFT') throw new ForbiddenException('Редактировать можно только черновик');

    let borrowerId = loan.borrowerId;
    if (dto.borrowerPhone) {
      const borrower = await this.prisma.user.findUnique({ where: { phone: dto.borrowerPhone } });
      if (borrower?.id === userId) throw new ForbiddenException('Нельзя оформить займ самому себе');
      borrowerId = borrower?.id ?? null;
    }

    const amount = dto.principalAmount;
    const updated = await this.prisma.loan.update({
      where: { id },
      data: {
        borrowerPhone: dto.borrowerPhone,
        borrowerId,
        principalAmount: amount,
        remainingAmount: amount,
        issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        terms: { update: { purpose: dto.purpose, comment: dto.comment } },
      },
      include: this.include(),
    });
    return this.serialize(updated);
  }

  async remove(userId: string, id: string) {
    const loan = await this.prisma.loan.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException('Займ не найден');
    if (loan.lenderId !== userId || loan.status !== 'DRAFT') throw new ForbiddenException('Удалить можно только свой черновик');
    await this.prisma.loan.delete({ where: { id } });
    return { ok: true };
  }

  private async nextNumber() {
    const year = new Date().getFullYear();
    const sequence = await this.prisma.loanSequence.upsert({ where: { year }, create: { year, value: 1 }, update: { value: { increment: 1 } } });
    return `DLG-${year}-${sequence.value.toString().padStart(6, '0')}`;
  }

  private assertParty(userId: string, lenderId: string, borrowerId: string | null) {
    if (lenderId !== userId && borrowerId !== userId) throw new ForbiddenException('Нет доступа к займу');
  }

  private statusFilter(filter?: string) {
    if (filter === 'active') return ['ACTIVE', 'PARTIALLY_REPAID'] as const;
    if (filter === 'overdue') return ['OVERDUE'] as const;
    if (filter === 'closed') return ['CLOSED'] as const;
    return undefined;
  }

  private include() {
    return {
      terms: true,
      lender: { select: { id: true, phone: true, identity: { select: { firstName: true, lastName: true } } } },
      borrower: { select: { id: true, phone: true, identity: { select: { firstName: true, lastName: true } } } },
    } satisfies Prisma.LoanInclude;
  }

  private serialize(loan: any) {
    return { ...loan, principalAmount: Number(loan.principalAmount), remainingAmount: Number(loan.remainingAmount) };
  }
}
