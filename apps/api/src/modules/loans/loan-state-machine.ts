import { BadRequestException } from '@nestjs/common';
import type { LoanStatus } from '../../generated/prisma/client.js';

const transitions: Record<LoanStatus, readonly LoanStatus[]> = {
  DRAFT: ['WAITING_LENDER_SIGNATURE', 'CANCELLED'],
  WAITING_LENDER_SIGNATURE: ['WAITING_BORROWER_SIGNATURE', 'CANCELLED'],
  WAITING_BORROWER_SIGNATURE: ['SIGNED', 'CANCELLED'],
  SIGNED: ['WAITING_TRANSFER', 'CANCELLED'],
  WAITING_TRANSFER: ['WAITING_TRANSFER_CONFIRMATION', 'CANCELLED'],
  WAITING_TRANSFER_CONFIRMATION: ['ACTIVE', 'DISPUTED'],
  ACTIVE: ['PARTIALLY_REPAID', 'OVERDUE', 'REPAID', 'DISPUTED'],
  PARTIALLY_REPAID: ['PARTIALLY_REPAID', 'OVERDUE', 'REPAID', 'DISPUTED'],
  OVERDUE: ['PARTIALLY_REPAID', 'REPAID', 'DISPUTED'],
  REPAID: ['CLOSED', 'DISPUTED'],
  CLOSED: [],
  CANCELLED: [],
  DISPUTED: ['ACTIVE', 'PARTIALLY_REPAID', 'OVERDUE', 'REPAID', 'CLOSED'],
};

export function assertLoanTransition(from: LoanStatus, to: LoanStatus) {
  if (!transitions[from].includes(to)) {
    throw new BadRequestException(`Недопустимый переход займа ${from} → ${to}`);
  }
}
