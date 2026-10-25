import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Private files (receipts, thesis and synopsis, admission documents, scholars' and supervisors'
 * uploads) are kept in an Amazon S3 bucket when the S3 settings are present in `.env.local`.
 * Without them the ERP keeps using Supabase Storage as before.
 */
let client: S3Client | null = null;

export function s3Bucket() {
  return process.env.S3_BUCKET?.trim() || "";
}

export function s3Enabled() {
  return Boolean(
    s3Bucket() &&
      process.env.S3_REGION &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY,
  );
}

export function s3Client() {
  if (!s3Enabled()) return null;
  client ??= new S3Client({
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
    },
  });
  return client;
}

export async function putS3(key: string, bytes: Uint8Array, contentType: string) {
  const s3 = s3Client();
  if (!s3) return false;
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: s3Bucket(),
        Key: key,
        Body: bytes,
        ContentType: contentType,
        ServerSideEncryption: "AES256",
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export async function existsS3(key: string) {
  const s3 = s3Client();
  if (!s3) return false;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: s3Bucket(), Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** A link to the file that stops working after two minutes. */
export async function signedS3Url(key: string) {
  const s3 = s3Client();
  if (!s3) return null;
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: s3Bucket(), Key: key }), {
    expiresIn: 120,
  });
}
