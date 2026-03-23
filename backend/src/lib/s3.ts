import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';

export const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET!;

export const uploadToS3 = async (
  buffer: Buffer,
  key: string,
  contentType = 'image/webp',
): Promise<string> => {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
  return `https://${BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
};

export const deleteFromS3 = async (key: string): Promise<void> => {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
};

export const keyFromUrl = (url: string): string | null => {
  try {
    const u = new URL(url);
    // Handle both regular S3 URLs and already-signed URLs (strip query params)
    return u.pathname.replace(/^\//, '');
  } catch {
    return null;
  }
};

const SIGNED_URL_TTL = 6 * 60 * 60; // 6 hours in seconds
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export const signUrl = async (url: string | null | undefined): Promise<string | null> => {
  if (!url) return null;
  const key = keyFromUrl(url);
  if (!key) return null;

  const cached = signedUrlCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const signed = await awsGetSignedUrl(s3, command, { expiresIn: SIGNED_URL_TTL });
  signedUrlCache.set(key, { url: signed, expiresAt: Date.now() + CACHE_TTL_MS });

  // Evict stale entries periodically (every 500 entries)
  if (signedUrlCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of signedUrlCache) {
      if (v.expiresAt < now) signedUrlCache.delete(k);
    }
  }

  return signed;
};

export const signUrls = async (urls: (string | null | undefined)[]): Promise<(string | null)[]> => {
  return Promise.all(urls.map(signUrl));
};
