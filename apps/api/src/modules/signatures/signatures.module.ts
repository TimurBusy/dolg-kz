import { Module } from '@nestjs/common';
import { AccessTokenGuard } from '../../common/guards/access-token.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { SignatureProviderPort } from './signature-provider.port.js';
import { SigexSignatureProvider } from './sigex-signature.provider.js';
import { SignaturesController } from './signatures.controller.js';
import { SignaturesService } from './signatures.service.js';

@Module({
  imports: [AuthModule, DocumentsModule],
  controllers: [SignaturesController],
  providers: [
    SignaturesService,
    AccessTokenGuard,
    {
      provide: SignatureProviderPort,
      useClass: SigexSignatureProvider,
    },
  ],
})
export class SignaturesModule {}
