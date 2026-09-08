import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private bucketReady?: Promise<void>;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('S3_BUCKET', 'dolg-documents');
    this.client = new S3Client({
      region: this.config.get<string>('S3_REGION', 'us-east-1'),
      endpoint: this.config.get<string>('S3_ENDPOINT'),
      forcePathStyle: this.config.get<string>('S3_FORCE_PATH_STYLE', 'true') === 'true',
      credentials: {
        accessKeyId: this.config.get<string>('S3_ACCESS_KEY', 'dolg'),
        secretAccessKey: this.config.get<string>('S3_SECRET_KEY', 'dolg_minio_password'),
      },
    });
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string) {
    await this.ensureBucket();
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    if (!result.Body) {
      throw new Error('Object storage returned an empty body');
    }

    const bytes = await result.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  private ensureBucket() {
    this.bucketReady ??= this.prepareBucket();
    return this.bucketReady;
  }

  private async prepareBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }
}
