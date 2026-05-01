import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { requireEnv } from "@/lib/env";

export function createR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

export function getR2PublicUrl(objectKey: string) {
  const baseUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

  if (!baseUrl) {
    return `r2://${requireEnv("R2_BUCKET_NAME")}/${objectKey}`;
  }

  return `${baseUrl}/${objectKey}`;
}

export async function getR2ObjectBlob(objectKey: string): Promise<Blob> {
  const response = await createR2Client().send(
    new GetObjectCommand({
      Bucket: requireEnv("R2_BUCKET_NAME"),
      Key: objectKey,
    }),
  );

  if (!response.Body) {
    throw new Error("R2 object was empty.");
  }

  const bytes = await response.Body.transformToByteArray();
  const audioBytes = new Uint8Array(bytes);

  return new Blob([audioBytes.buffer], {
    type: response.ContentType ?? "audio/webm",
  });
}
