import { Module } from '@nestjs/common';
import { AccessTokenGuard } from '../../common/guards/access-token.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';
import { LoanAgreementPdfService } from './loan-agreement-pdf.service.js';
import { StorageService } from './storage.service.js';

@Module({
  imports: [AuthModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    LoanAgreementPdfService,
    StorageService,
    AccessTokenGuard,
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
