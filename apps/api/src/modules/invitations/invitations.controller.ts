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
import { InvitationsService } from './invitations.service.js';

@ApiTags('invitations')
@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post('loans/:loanId/invitations')
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  create(
    @CurrentUser() user: AuthUser,
    @Param('loanId') loanId: string,
  ) {
    return this.invitations.create(user.userId, loanId);
  }

  @Get('invitations/:token')
  preview(@Param('token') token: string) {
    return this.invitations.preview(token);
  }

  @Post('invitations/:token/accept')
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  accept(
    @CurrentUser() user: AuthUser,
    @Param('token') token: string,
  ) {
    return this.invitations.accept(user.userId, token);
  }
}
