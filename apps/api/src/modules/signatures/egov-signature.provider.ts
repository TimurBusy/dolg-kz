import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdditionalSigningCompletion,
  AdditionalSigningLaunch,
  AdditionalSigningStatus,
  FirstSigningCompletion,
  FirstSigningLaunch,
  SignatureProviderPort,
  SigningMeta,
} from './signature-provider.port.js';

@Injectable()
export class EgovSignatureProvider extends SignatureProviderPort {
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    super();

    const configuredBaseUrl =
      this.config.get<string>('EGOV_BASE_URL')?.trim();

    this.baseUrl = (configuredBaseUrl || '').replace(/\/$/, '');
  }

  async createFirstOperation(input: {
    description: string;
    backUrl: string;
  }): Promise<FirstSigningLaunch> {
    throw new Error('eGov QR launch is not implemented yet');
  }

  async completeFirstOperation(input: {
    context: FirstSigningLaunch['context'];
    file: Buffer;
    title: string;
    description: string;
    meta: SigningMeta;
    signerIins: string[];
  }): Promise<FirstSigningCompletion> {
    throw new Error('eGov first completion is not implemented yet');
  }

  async createAdditionalOperation(input: {
    providerDocumentId: string;
    description: string;
    backUrl: string;
    meta: SigningMeta;
  }): Promise<AdditionalSigningLaunch> {
    throw new Error('eGov additional launch is not implemented yet');
  }

  async completeAdditionalOperation(input: {
    context: AdditionalSigningLaunch['context'];
    file: Buffer;
    providerDocumentId: string;
    title: string;
    meta: SigningMeta;
    expectedSignerIin: string;
  }): Promise<AdditionalSigningCompletion> {
    throw new Error('eGov additional completion is not implemented yet');
  }

  async getAdditionalOperationStatus(input: {
    providerDocumentId: string;
    operationId: string;
  }): Promise<AdditionalSigningStatus> {
    throw new Error('eGov status is not implemented yet');
  }
}
