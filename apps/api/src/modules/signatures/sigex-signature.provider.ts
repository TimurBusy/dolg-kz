import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdditionalSigningLaunch,
  AdditionalSigningStatus,
  FirstSigningCompletion,
  FirstSigningLaunch,
  SignatureProviderPort,
  SigningMeta,
} from './signature-provider.port.js';

type Json = Record<string, any>;

@Injectable()
export class SigexSignatureProvider extends SignatureProviderPort {
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    super();
    const configuredBaseUrl = this.config.get<string>('SIGEX_BASE_URL')?.trim();
    this.baseUrl = (configuredBaseUrl || 'https://sigex.kz').replace(/\/$/, '');
  }

  async createFirstOperation(input: {
    description: string;
    backUrl: string;
  }): Promise<FirstSigningLaunch> {
    const response = await this.json(`${this.baseUrl}/api/egovQr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: input.description,
        whenDone: { backUrl: input.backUrl },
      }),
    });

    const dataUrl = this.safeSigexUrl(response.dataURLAuto ?? response.dataURL);
    const signUrl = this.safeSigexUrl(response.signURLAuto ?? response.signURL);

    return {
      expireAt: new Date(Number(response.expireAt)),
      qrCode: String(response.qrCode),
      launchLink: String(response.eGovMobileLaunchLink),
      context: { dataUrl, signUrl },
    };
  }

  async completeFirstOperation(input: {
    context: FirstSigningLaunch['context'];
    file: Buffer;
    title: string;
    description: string;
    meta: SigningMeta;
    signerIins: string[];
  }): Promise<FirstSigningCompletion> {
    await this.json(
      this.safeSigexUrl(input.context.dataUrl),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signMethod: 'CMS_SIGN_ONLY',
          documentsToSign: [
            {
              id: 1,
              nameRu: input.title,
              nameKz: 'Қарыз шарты',
              nameEn: 'Loan agreement',
              meta: input.meta,
              document: {
                file: {
                  mime: '@file/pdf',
                  data: input.file.toString('base64'),
                },
              },
            },
          ],
        }),
      },
      10 * 60 * 1000,
    );

    const signed = await this.json(
      this.safeSigexUrl(input.context.signUrl),
      { method: 'GET' },
      10 * 60 * 1000,
    );

    if (String(signed.status ?? '').toUpperCase() === 'CANCELED') {
      return { status: 'CANCELED' };
    }

    const signature = signed.documentsToSign?.[0]?.document?.file?.data;
    if (!signature || typeof signature !== 'string') {
      throw new Error('SIGEX/eGov не вернул CMS подпись');
    }

    const registration = await this.json(`${this.baseUrl}/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        signType: 'cms',
        signature,
        settings: {
          private: true,
          signaturesLimit: 2,
          switchToPrivateAfterLimitReached: true,
          unique: ['iin'],
          strictSignersRequirements: true,
          sequentialSignersRequirements: true,
          signersRequirements: input.signerIins.map((iin) => ({
            iin: `IIN${iin}`,
          })),
          publicDuringPreregistration: false,
          publicWhileLessThanSignatures: 2,
          tempStorageAfterRegistration: 7 * 24 * 60 * 60 * 1000,
        },
      }),
    });

    const providerDocumentId = String(registration.documentId);
    const providerSignId = Number(registration.signId);

    await this.binary(
      `${this.baseUrl}/api/${encodeURIComponent(providerDocumentId)}/data`,
      input.file,
    );

    // The document is registered with strict + sequential signer requirements.
    // SIGEX validates the first CMS signature against signerIins[0] before
    // accepting registration, so a successful POST /api is authoritative here.
    // Reading signature metadata back anonymously is unreliable for private
    // documents and is not required for enforcing the lender IIN.
    const signerIin = input.signerIins[0];
    if (!signerIin) {
      throw new Error('Не задан ИИН первого подписанта');
    }

    return {
      status: 'SIGNED',
      providerDocumentId,
      providerSignId,
      signerIin,
    };
  }

  async createAdditionalOperation(input: {
    providerDocumentId: string;
    description: string;
    backUrl: string;
    meta: SigningMeta;
  }): Promise<AdditionalSigningLaunch> {
    const response = await this.json(
      `${this.baseUrl}/api/${encodeURIComponent(input.providerDocumentId)}/egovQr`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: input.description,
          meta: input.meta,
          whenDone: { backUrl: input.backUrl },
        }),
      },
    );

    return {
      operationId: String(response.operationId),
      expireAt: new Date(Number(response.expireAt)),
      qrCode: String(response.qrCode),
      launchLink: String(response.eGovMobileLaunchLink),
    };
  }

  async getAdditionalOperationStatus(input: {
    providerDocumentId: string;
    operationId: string;
  }): Promise<AdditionalSigningStatus> {
    const response = await this.json(
      `${this.baseUrl}/api/${encodeURIComponent(input.providerDocumentId)}/egovOperation/${encodeURIComponent(input.operationId)}`,
      { method: 'GET' },
    );

    const status = String(response.status ?? '').toLowerCase();
    if (status === 'done') {
      const providerSignId =
        response.signId == null ? undefined : Number(response.signId);
      const document = await this.json(
        `${this.baseUrl}/api/${encodeURIComponent(input.providerDocumentId)}`,
        { method: 'GET' },
      );
      const certificateInfo = document.signatures?.find(
        (item: Json) => Number(item.signId) === providerSignId,
      );

      return {
        status: 'SIGNED',
        signerIin: this.normalizeIin(response.userId),
        providerSignId,
        certificateInfo,
      };
    }
    if (status === 'canceled' || status === 'canceledfromegov') {
      return { status: 'CANCELED' };
    }
    if (status === 'fail') {
      return {
        status: 'FAILED',
        error:
          response.errors?.sigex ??
          response.errors?.egov ??
          'Подписание завершилось ошибкой',
      };
    }
    return { status: 'PENDING' };
  }

  private async json(
    url: string,
    init: RequestInit,
    timeoutMs = 30_000,
  ): Promise<Json> {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const responseBody = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        responseBody?.message ??
          `SIGEX HTTP ${response.status} ${response.statusText}`,
      );
    }
    return responseBody as Json;
  }

  private async binary(url: string, data: Buffer) {
    const payload = Uint8Array.from(data);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(payload.byteLength),
      },
      body: payload,
      signal: AbortSignal.timeout(60_000),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        body?.message ??
          `SIGEX HTTP ${response.status} ${response.statusText}`,
      );
    }
    return body;
  }

  private safeSigexUrl(value: unknown) {
    if (typeof value !== 'string') {
      throw new Error('SIGEX не вернул URL операции');
    }
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      (url.hostname !== 'sigex.kz' && !url.hostname.endsWith('.sigex.kz'))
    ) {
      throw new Error('SIGEX вернул недоверенный URL операции');
    }
    return url.toString();
  }

  private extractSignerIin(signature: Json | undefined) {
    if (!signature) return undefined;

    const direct = this.normalizeIin(signature.userId);
    if (direct) return direct;

    if (typeof signature.subject === 'string') {
      const match = signature.subject.match(/IIN\D*(\d{12})/i);
      if (match?.[1]) return match[1];
    }

    if (Array.isArray(signature.subjectStructure)) {
      for (const group of signature.subjectStructure) {
        if (!Array.isArray(group)) continue;
        for (const item of group) {
          const name = String(item?.name ?? '').toUpperCase();
          if (name !== 'SERIALNUMBER' && name !== 'SERIALINUMBER') continue;
          const fromStructure = this.normalizeIin(item?.value);
          if (fromStructure) return fromStructure;
        }
      }
    }

    return undefined;
  }

  private normalizeIin(value: unknown) {
    if (typeof value !== 'string') return undefined;
    const normalized = value.replace(/^IIN/i, '').replace(/\D/g, '');
    return /^\d{12}$/.test(normalized) ? normalized : undefined;
  }
}
