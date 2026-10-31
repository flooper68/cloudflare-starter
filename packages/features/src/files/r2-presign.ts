import { AwsClient } from "aws4fetch";
import { PRESIGNED_UPLOAD_CLEANUP_DELAY_SECONDS } from "./domain";

/** R2 S3-API credentials for presigned URLs (the binding path needs none). */
export interface R2Config {
  readonly accountId: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly filesBucketName: string;
}

/** A presigned URL for one request on one object, valid for `expiresIn` seconds. */
export async function presignR2Url(
  r2: R2Config,
  key: string,
  request: { readonly method: "GET" | "PUT"; readonly headers?: HeadersInit },
  expiresIn = PRESIGNED_UPLOAD_CLEANUP_DELAY_SECONDS
): Promise<string> {
  const client = new AwsClient({
    accessKeyId: r2.accessKeyId,
    secretAccessKey: r2.secretAccessKey,
    region: "auto",
  });
  const url = new URL(
    `https://${r2.accountId}.r2.cloudflarestorage.com/${r2.filesBucketName}/${key}`
  );
  url.searchParams.set("X-Amz-Expires", String(expiresIn));

  const signed = await client.sign(
    new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
    }),
    { aws: { signQuery: true, allHeaders: request.method === "PUT" } }
  );
  return signed.url;
}
