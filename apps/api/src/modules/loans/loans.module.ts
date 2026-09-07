import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';

@Module({
  imports: [AuthModule],
  controllers: [LoansController],
  providers: [LoansService, AccessTokenGuard],
  exports: [LoansService],
})
export class LoansModule {}
