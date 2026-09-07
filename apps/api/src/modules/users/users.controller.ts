import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator.js';
import { AccessTokenGuard } from '../../common/guards/access-token.guard.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('me')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  me(@CurrentUser() user: AuthUser) { return this.users.me(user.userId); }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) { return this.users.update(user.userId, dto); }

  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser) { return this.users.sessions(user.userId); }

  @Delete('sessions/:id')
  revoke(@CurrentUser() user: AuthUser, @Param('id') sessionId: string) { return this.users.revokeSession(user.userId, sessionId); }
}
