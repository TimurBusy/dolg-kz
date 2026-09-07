import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator.js';
import { AccessTokenGuard } from '../../common/guards/access-token.guard.js';
import { CreateLoanDto } from './dto/create-loan.dto.js';
import { UpdateLoanDto } from './dto/update-loan.dto.js';
import { LoansService } from './loans.service.js';

@ApiTags('loans')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('loans')
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLoanDto) {
    return this.loans.create(user.userId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('filter') filter?: string) {
    return this.loans.list(user.userId, filter);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.loans.get(user.userId, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateLoanDto) {
    return this.loans.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.loans.remove(user.userId, id);
  }
}
