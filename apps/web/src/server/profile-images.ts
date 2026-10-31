import { DomainError } from "@cloudflare-starter/features";

/** Cap the stream, including chunked requests; Content-Length alone cannot bound it. */
export async function readProfileImage(request: Request): Promise<Uint8Array> {
  if (!request.body) throw new DomainError("invalid_input", "Choose an image");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 1024 * 1024) {
        await reader.cancel();
        throw new DomainError(
          "invalid_input",
          "Choose an image no larger than 1 MB",
          "INVALID_PROFILE_IMAGE"
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** Private immutable versions: the object is authorized before sending cache headers. */
export function profileImageResponse(object: R2ObjectBody): Response {
  return new Response(object.body, {
    headers: {
      "content-type":
        object.httpMetadata?.contentType ?? "application/octet-stream",
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      ETag: object.httpEtag,
    },
  });
}
