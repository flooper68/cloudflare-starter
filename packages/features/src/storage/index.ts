import { AwsClient } from "aws4fetch";
import { z } from "zod";

import { type Database, desc, eq, type FileBucket, files } from "../db";

export const uploadInputSchema = z.object({
  filename: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[A-Za-z0-9._-]+$/, "Only simple filenames are allowed"),
  mimeType: z.string().min(1).max(150),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
});

export type UploadInput = z.infer<typeof uploadInputSchema>;

export interface R2Config {
  readonly accountId: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly filesBucketName: string;
}

export interface CreatedFileRecord {
  readonly fileId: string;
  readonly bucket: FileBucket;
  readonly r2Key: string;
}

export function buildFileKey(fileId: string, date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `uploads/${year}/${month}/${fileId}`;
}

function getClient(r2: R2Config): AwsClient {
  return new AwsClient({
    accessKeyId: r2.accessKeyId,
    secretAccessKey: r2.secretAccessKey,
    region: "auto",
  });
}

function r2Url(r2: R2Config, key: string): string {
  return `https://${r2.accountId}.r2.cloudflarestorage.com/${r2.filesBucketName}/${key}`;
}

export async function createFileRecord(
  db: Database,
  input: UploadInput & { readonly ownerUserId: string }
): Promise<CreatedFileRecord> {
  const parsed = uploadInputSchema.parse(input);
  const fileId = crypto.randomUUID();
  const r2Key = buildFileKey(fileId);
  const [file] = await db
    .insert(files)
    .values({
      id: fileId,
      bucket: "files",
      r2Key,
      filename: parsed.filename,
      contentType: parsed.mimeType,
      sizeBytes: parsed.sizeBytes,
      ownerUserId: input.ownerUserId,
    })
    .returning({
      id: files.id,
      bucket: files.bucket,
    });

  if (!file) {
    throw new Error("Failed to create file record");
  }

  return {
    fileId: file.id,
    bucket: file.bucket,
    r2Key,
  };
}

export async function presignUpload(
  r2: R2Config,
  key: string,
  input: Pick<UploadInput, "mimeType" | "sizeBytes">,
  expiresIn = 3600
): Promise<string> {
  const client = getClient(r2);
  const url = new URL(r2Url(r2, key));
  url.searchParams.set("X-Amz-Expires", String(expiresIn));

  const request = new Request(url.toString(), {
    method: "PUT",
    headers: {
      "Content-Type": input.mimeType,
      "Content-Length": String(input.sizeBytes),
    },
  });

  const signed = await client.sign(request, {
    aws: { signQuery: true, allHeaders: true },
  });

  return signed.url;
}

export async function presignDownload(
  r2: R2Config,
  key: string,
  expiresIn = 3600
): Promise<string> {
  const client = getClient(r2);
  const url = new URL(r2Url(r2, key));
  url.searchParams.set("X-Amz-Expires", String(expiresIn));

  const signed = await client.sign(
    new Request(url.toString(), { method: "GET" }),
    {
      aws: { signQuery: true },
    }
  );

  return signed.url;
}

export async function listOwnedFiles(
  db: Database,
  input: { readonly ownerUserId: string; readonly limit?: number }
) {
  return db.query.files.findMany({
    where: eq(files.ownerUserId, input.ownerUserId),
    orderBy: desc(files.createdAt),
    limit: input.limit ?? 50,
  });
}

export async function findOwnedFile(
  db: Database,
  input: { readonly fileId: string; readonly ownerUserId: string }
) {
  return db.query.files.findFirst({
    where: (current, operators) =>
      operators.and(
        operators.eq(current.id, input.fileId),
        operators.eq(current.ownerUserId, input.ownerUserId)
      ),
  });
}

/*
 * Binding path: the bytes go through the Worker and `env.FILES`. No S3 keys, the
 * Worker checks ownership on every read, and it runs simulated in local dev.
 * Use it for server-written files and anything that must stay behind auth.
 * The presigned path above sends bytes browser ↔ R2 directly; use it for large
 * uploads or links handed to someone outside the app.
 */

export async function storeFile(
  db: Database,
  bucket: R2Bucket,
  input: UploadInput & {
    readonly ownerUserId: string;
    readonly body: ArrayBuffer;
  }
): Promise<CreatedFileRecord> {
  const file = await createFileRecord(db, input);

  try {
    await bucket.put(file.r2Key, input.body, {
      httpMetadata: { contentType: input.mimeType },
    });
  } catch (error) {
    // No object, no record: keep the table and the bucket in step.
    await db.delete(files).where(eq(files.id, file.fileId));
    throw error;
  }

  return file;
}

export async function getOwnedFileObject(
  db: Database,
  bucket: R2Bucket,
  input: { readonly fileId: string; readonly ownerUserId: string }
) {
  const file = await findOwnedFile(db, input);
  if (!file) return null;

  const object = await bucket.get(file.r2Key);
  return object ? { file, object } : null;
}
