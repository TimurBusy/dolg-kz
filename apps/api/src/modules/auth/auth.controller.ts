import { Body, Controller, Headers, Ip, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { LogoutDto } from './dto/logout.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { RequestOtpDto } from './dto/request-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.phone);
  }

  @Post('otp/verify')
  verifyOtp(@Body() dto: VerifyOtpDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    return this.auth.verifyOtp(dto.phone, dto.code, { ip, userAgent });
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  logout(@Body() dto: LogoutDto) {
    return this.auth.logout(dto.sessionId);
  }
}
