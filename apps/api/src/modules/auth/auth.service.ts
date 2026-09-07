import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomInt } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async requestOtp(phone: string) {
    const key = `otp:${phone}`;
    const rateKey = `otp-rate:${phone}`;
    const attempts = await this.redis.client.incr(rateKey);
    if (attempts === 1) await this.redis.client.expire(rateKey, 15 * 60);
    if (attempts > 5) throw new HttpException('Слишком много запросов OTP', HttpStatus.TOO_MANY_REQUESTS);

    const code = randomInt(100000, 1000000).toString();
    const ttl = this.config.get<number>('OTP_TTL_SECONDS', 300);
    await this.redis.client.set(key, this.hash(code), 'EX', ttl);

    if (this.config.get('NODE_ENV', 'development') !== 'production') {
      console.info(`[DEV OTP] ${phone}: ${code}`);
    }

    return { ok: true, expiresIn: ttl };
  }

  async verifyOtp(phone: string, code: string, meta: { ip?: string; userAgent?: string }) {
    const key = `otp:${phone}`;
    const stored = await this.redis.client.get(key);
    if (!stored || stored !== this.hash(code)) throw new UnauthorizedException('Неверный или истёкший код');
    await this.redis.client.del(key);

    const user = await this.prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone },
    });

    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: 'pending',
        ip: meta.ip,
        userAgent: meta.userAgent,
        device: this.deviceFromUserAgent(meta.userAgent),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const tokens = await this.issueTokens(user.id, session.id);
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { refreshTokenHash: this.hash(tokens.refreshToken) },
    });

    return { user: { id: user.id, phone: user.phone }, sessionId: session.id, ...tokens };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; sid: string; type: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid token type');

    const session = await this.prisma.userSession.findUnique({ where: { id: payload.sid } });
    if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired');
    }
    if (session.refreshTokenHash !== this.hash(refreshToken)) {
      await this.prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const tokens = await this.issueTokens(payload.sub, payload.sid);
    await this.prisma.userSession.update({
      where: { id: payload.sid },
      data: { refreshTokenHash: this.hash(tokens.refreshToken), lastActivityAt: new Date() },
    });
    return { sessionId: payload.sid, ...tokens };
  }

  async logout(sessionId: string) {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  private async issueTokens(userId: string, sessionId: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, sid: sessionId, type: 'access' },
      { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: '15m' },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, sid: sessionId, type: 'refresh' },
      { secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'), expiresIn: '30d' },
    );
    return { accessToken, refreshToken };
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private deviceFromUserAgent(userAgent?: string) {
    if (!userAgent) return undefined;
    if (/mobile|android|iphone/i.test(userAgent)) return 'Mobile';
    return 'Desktop';
  }
}
