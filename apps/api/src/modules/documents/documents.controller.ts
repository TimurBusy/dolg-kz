import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator.js';
import { AccessTokenGuard } from '../../common/guards/access-token.guard.js';
import { DocumentsService } from './documents.service.js';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post('loans/:loanId/documents/generate')
  generate(@CurrentUser() user: AuthUser, @Param('loanId') loanId: string) {
    return this.documents.generateLoanAgreement(user.userId, loanId);
  }

  @Get('loans/:loanId/documents')
  list(@CurrentUser() user: AuthUser, @Param('loanId') loanId: string) {
    return this.documents.listForLoan(user.userId, loanId);
  }

  @Get('documents/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.documents.get(user.userId, id);
  }

  @Get('documents/:id/file')
  @ApiProduces('application/pdf')
  async file(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { document, body } = await this.documents.file(user.userId, id);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${document.type.toLowerCase()}-v${document.version}.pdf"`,
    );
    response.setHeader('Content-Length', body.length.toString());
    return body;
  }
}
