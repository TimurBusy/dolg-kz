import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdditionalSigningCompletion,
  AdditionalSigningLaunch,
  AdditionalSigningStatus,
  FirstSigningCompletion,
  FirstSigningLaunch,
  SignatureProviderPort,
} from './signature-provider.port.js';

@Injectable()
export class EgovSignatureProvider extends SignatureProviderPort {
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    super();

    const configuredBaseUrl =
      this.config.get<string>('SIGEX_BASE_URL')?.trim();

    this.baseUrl = (configuredBaseUrl || 'https://sigex.kz').replace(/\/$/, '');
  }

  async createFirstOperation(input: {
    description: string;
    backUrl: string;
  }): Promise<FirstSigningLaunch> {
    throw new Error('Egov createFirstOperation not implemented');
  }

  async completeFirstOperation(
    input: any,
  ): Promise<FirstSigningCompletion> {
    throw new Error('Egov completeFirstOperation not implemented');
  }

  async createAdditionalOperation(
    input: any,
  ): Promise<AdditionalSigningLaunch> {
    throw new Error('Egov createAdditionalOperation not implemented');
  }

  async completeAdditionalOperation(
    input: any,
  ): Promise<AdditionalSigningCompletion> {
    throw new Error('Egov completeAdditionalOperation not implemented');
  }

  async getAdditionalOperationStatus(
    input: any,
  ): Promise<AdditionalSigningStatus> {
    throw new Error('Egov getAdditionalOperationStatus not implemented');
  }
}