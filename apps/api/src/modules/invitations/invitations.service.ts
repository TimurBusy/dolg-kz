import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class InvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: { borrower: { select: { id: true } } },
    });

    if (!loan) throw new NotFoundException('Займ не найден');
    if (loan.lenderId !== userId) {
      throw new ForbiddenException('Создать приглашение может только заимодатель');
    }
    if (loan.status !== 'DRAFT') {
      throw new BadRequestException('Приглашение создаётся только для черновика');
    }
    if (loan.borrowerId) {
      return {
        linked: true,
        borrowerId: loan.borrowerId,
        message: 'Заёмщик уже зарегистрирован и связан с займом',
      };
    }

    await this.prisma.loanInvitation.updateMany({
      where: { loanId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });

    const token = randomBytes(32).toString('base64url');
    const invitation = await this.prisma.loanInvitation.create({
      data: {
        loanId,
        phone: loan.borrowerPhone,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      linked: false,
      token,
      invitation: this.publicInvitation(invitation),
    };
  }

  async preview(token: string) {
    const invitation = await this.findByToken(token);

    if (invitation.status === 'PENDING' && invitation.expiresAt < new Date()) {
      const expired = await this.prisma.loanInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
        include: this.include(),
      });
      return this.previewPayload(expired);
    }

    return this.previewPayload(invitation);
  }

  async accept(userId: string, token: string) {
    const invitation = await this.findByToken(token);
    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Приглашение уже использовано или недействительно');
    }
    if (invitation.expiresAt < new Date()) {
      await this.prisma.loanInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Срок действия приглашения истёк');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { identity: true },
    });
    if (!user) throw new NotFoundException('Пользователь не найден');
    if (user.phone !== invitation.phone) {
      throw new ForbiddenException(
        `Приглашение предназначено для номера ${this.maskPhone(invitation.phone)}`,
      );
    }

    if (invitation.loan.borrowerId && invitation.loan.borrowerId !== userId) {
      throw new BadRequestException('К займу уже привязан другой заёмщик');
    }

    await this.prisma.$transaction([
      this.prisma.loan.update({
        where: { id: invitation.loanId },
        data: { borrowerId: userId },
      }),
      this.prisma.loanInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedByUserId: userId,
          acceptedAt: new Date(),
        },
      }),
    ]);

    return {
      ok: true,
      loanId: invitation.loanId,
      profileComplete: Boolean(
        user.identity?.firstName &&
          user.identity?.lastName &&
          user.identity?.iinEncrypted,
      ),
    };
  }

  private async findByToken(token: string) {
    const invitation = await this.prisma.loanInvitation.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: this.include(),
    });
    if (!invitation) throw new NotFoundException('Приглашение не найдено');
    return invitation;
  }

  private include() {
    return {
      loan: {
        include: {
          lender: {
            select: {
              phone: true,
              identity: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      },
    } as const;
  }

  private previewPayload(invitation: any) {
    const lenderName = [
      invitation.loan.lender.identity?.lastName,
      invitation.loan.lender.identity?.firstName,
    ]
      .filter(Boolean)
      .join(' ');

    return {
      id: invitation.id,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      borrowerPhoneMasked: this.maskPhone(invitation.phone),
      loan: {
        id: invitation.loan.id,
        number: invitation.loan.number,
        principalAmount: Number(invitation.loan.principalAmount),
        currency: invitation.loan.currency,
        dueDate: invitation.loan.dueDate,
        lenderName: lenderName || this.maskPhone(invitation.loan.lender.phone),
      },
    };
  }

  private publicInvitation(invitation: any) {
    return {
      id: invitation.id,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private maskPhone(phone: string) {
    if (phone.length < 8) return phone;
    return `${phone.slice(0, 4)}***${phone.slice(-4)}`;
  }
}
