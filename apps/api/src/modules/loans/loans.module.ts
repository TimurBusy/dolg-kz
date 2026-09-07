import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AccessTokenGuard } from '../../common/guards/access-token.guard.js';
import { LoansController } from './loans.controller.js';
import { LoansService } from './loans.service.js';

@Module({
  imports: [AuthModule],
  controllers: [LoansController],
  providers: [LoansService, AccessTokenGuard],
  exports: [LoansService],
})
export class LoansModule {}
