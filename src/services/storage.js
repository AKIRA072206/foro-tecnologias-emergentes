import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { STORAGE } from "../config.js";

// Neon Object Storage es S3-compatible y exige path-style.
// Credenciales, endpoint y región llegan por las variables AWS_* del env pull.
export const s3 = new S3Client({ forcePathStyle: true });

export function storageKey(estudianteId) {
  return `certificados/${estudianteId}.pdf`;
}

export async function subirCertificado(estudianteId, buffer) {
  const key = storageKey(estudianteId);
  await s3.send(
    new PutObjectCommand({
      Bucket: STORAGE.bucket,
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
      CacheControl: "private, max-age=0, no-store",
    }),
  );
  return key;
}

export async function urlCertificado(key, expiresIn = 3600) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: STORAGE.bucket, Key: key }),
    { expiresIn },
  );
}

export async function estadoStorage() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: STORAGE.bucket }));
    return { ok: true, bucket: STORAGE.bucket, endpoint: STORAGE.endpoint, region: STORAGE.region };
  } catch (error) {
    return { ok: false, bucket: STORAGE.bucket, motivo: error.message };
  }
}
