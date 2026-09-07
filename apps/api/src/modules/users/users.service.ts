import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { identity: true } });
    if (!user) throw new NotFoundException('User not found');
    return { id:user.id, phone:user.phone, email:user.email, status:user.status, createdAt:user.createdAt, identity:user.identity ? { firstName:user.identity.firstName,lastName:user.identity.lastName,middleName:user.identity.middleName,birthDate:user.identity.birthDate,iinMasked:user.identity.iinEncrypted?this.maskIin(this.decrypt(user.identity.iinEncrypted)):null,verificationStatus:user.identity.verificationStatus,verifiedAt:user.identity.verifiedAt }:null };
  }
  async update(userId:string,dto:UpdateProfileDto){
    await this.prisma.user.update({where:{id:userId},data:{email:dto.email}});
    await this.prisma.identity.upsert({where:{userId},create:{userId,firstName:dto.firstName,lastName:dto.lastName,middleName:dto.middleName,birthDate:dto.birthDate?new Date(dto.birthDate):undefined,iinEncrypted:dto.iin?this.encrypt(dto.iin):undefined,iinHash:dto.iin?this.hash(dto.iin):undefined,verificationStatus:'DATA_PROVIDED'},update:{firstName:dto.firstName,lastName:dto.lastName,middleName:dto.middleName,birthDate:dto.birthDate?new Date(dto.birthDate):undefined,iinEncrypted:dto.iin?this.encrypt(dto.iin):undefined,iinHash:dto.iin?this.hash(dto.iin):undefined,verificationStatus:'DATA_PROVIDED'}});
    return this.me(userId);
  }
  async sessions(userId:string){return this.prisma.userSession.findMany({where:{userId,revokedAt:null},select:{id:true,device:true,ip:true,userAgent:true,createdAt:true,lastActivityAt:true,expiresAt:true},orderBy:{lastActivityAt:'desc'}})}
  async revokeSession(userId:string,sessionId:string){const result=await this.prisma.userSession.updateMany({where:{id:sessionId,userId,revokedAt:null},data:{revokedAt:new Date()}});if(result.count===0)throw new NotFoundException('Session not found');return{ok:true}}
  private hash(value:string){return createHash('sha256').update(`dolg:${value}`).digest('hex')}
  private key(){const secret=this.config.get<string>('FIELD_ENCRYPTION_KEY','dev-only-change-me');return createHash('sha256').update(secret).digest()}
  private encrypt(value:string){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',this.key(),iv);const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);const tag=cipher.getAuthTag();return Buffer.concat([iv,tag,encrypted]).toString('base64url')}
  private decrypt(value:string){const payload=Buffer.from(value,'base64url');const iv=payload.subarray(0,12);const tag=payload.subarray(12,28);const encrypted=payload.subarray(28);const decipher=createDecipheriv('aes-256-gcm',this.key(),iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(encrypted),decipher.final()]).toString('utf8')}
  private maskIin(iin:string){return `${iin.slice(0,2)}********${iin.slice(-2)}`}
}
