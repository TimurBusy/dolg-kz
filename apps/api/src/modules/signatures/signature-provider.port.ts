export type SigningMeta = Array<{ name: string; value: string }>;

export type FirstSigningLaunch = {
  expireAt: Date;
  qrCode: string;
  launchLink: string;
  context: {
    dataUrl: string;
    signUrl: string;
  };
};

export type FirstSigningCompletion =
  | {
      status: 'SIGNED';
      providerDocumentId: string;
      providerSignId: number;
      signerIin: string;
      certificateInfo?: Record<string, unknown>;
    }
  | {
      status: 'CANCELED';
    };

export type AdditionalSigningLaunch = {
  expireAt: Date;
  qrCode: string;
  launchLink: string;
  operationId: string;
};

export type AdditionalSigningStatus = {
  status: 'PENDING' | 'SIGNED' | 'CANCELED' | 'FAILED';
  signerIin?: string;
  providerSignId?: number;
  certificateInfo?: Record<string, unknown>;
  error?: string;
};

export abstract class SignatureProviderPort {
  abstract createFirstOperation(input: {
    description: string;
    backUrl: string;
  }): Promise<FirstSigningLaunch>;

  abstract completeFirstOperation(input: {
    context: FirstSigningLaunch['context'];
    file: Buffer;
    title: string;
    description: string;
    meta: SigningMeta;
    signerIins: string[];
  }): Promise<FirstSigningCompletion>;

  abstract createAdditionalOperation(input: {
    providerDocumentId: string;
    description: string;
    backUrl: string;
    meta: SigningMeta;
  }): Promise<AdditionalSigningLaunch>;

  abstract getAdditionalOperationStatus(input: {
    providerDocumentId: string;
    operationId: string;
  }): Promise<AdditionalSigningStatus>;
}
