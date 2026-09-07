import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({ imports: [AuthModule], controllers: [UsersController], providers: [UsersService, AccessTokenGuard] })
export class UsersModule {}
