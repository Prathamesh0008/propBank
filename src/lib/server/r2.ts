import 'server-only';

import { S3Client } from '@aws-sdk/client-s3';

interface R2Configuration {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
}

const singleton = globalThis as typeof globalThis & { propbankR2Client?: S3Client };

export function getR2Configuration(): R2Configuration {
  const config = {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
    bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME || '',
    publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL || '',
  };
  if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
    throw new Error('Missing required Cloudflare R2 environment variables');
  }
  return config;
}

export function getR2Client() {
  if (!singleton.propbankR2Client) {
    const config = getR2Configuration();
    singleton.propbankR2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }
  return singleton.propbankR2Client;
}

// Preserve Go's configured prefix and fallback. Keys and existing URLs are not rewritten.
export function getR2PublicUrl(key: string) {
  const config = getR2Configuration();
  return config.publicUrl
    ? `${config.publicUrl.replace(/\/$/, '')}/${key}`
    : `https://${config.bucketName}.r2.dev/${key}`;
}
