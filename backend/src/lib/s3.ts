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

export const signUrl = async (url: string | null | undefined): Promise<string | null> => {
  if (!url) return null;
  const key = keyFromUrl(url);
  if (!key) return null;
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return awsGetSignedUrl(s3, command, { expiresIn: SIGNED_URL_TTL });
};

export const signUrls = async (urls: (string | null | undefined)[]): Promise<(string | null)[]> => {
  return Promise.all(urls.map(signUrl));
};
