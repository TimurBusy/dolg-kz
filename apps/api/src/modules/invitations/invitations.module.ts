import { Module } from '@nestjs/common';
import { AccessTokenGuard } from '../../common/guards/access-token.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { InvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';

@Module({
  imports: [AuthModule],
  controllers: [InvitationsController],
  providers: [InvitationsService, AccessTokenGuard],
})
export class InvitationsModule {}
