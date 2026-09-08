import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator.js';
import { AccessTokenGuard } from '../../common/guards/access-token.guard.js';
import { SignaturesService } from './signatures.service.js';

@ApiTags('signatures')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller()
export class SignaturesController {
  constructor(private readonly signatures: SignaturesService) {}

  @Post('documents/:documentId/signatures/start')
  start(
    @CurrentUser() user: AuthUser,
    @Param('documentId') documentId: string,
  ) {
    return this.signatures.start(user.userId, documentId);
  }

  @Get('documents/:documentId/signatures')
  list(
    @CurrentUser() user: AuthUser,
    @Param('documentId') documentId: string,
  ) {
    return this.signatures.list(user.userId, documentId);
  }

  @Get('signatures/:id/status')
  status(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.signatures.status(user.userId, id);
  }
}
