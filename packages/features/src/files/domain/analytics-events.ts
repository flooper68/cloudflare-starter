import { z } from "zod";

import { defineEvent } from "../../kernel";

/** Coarse kinds of file, so events never carry a filename or an exact type. */
export const CONTENT_CATEGORIES = [
  "image",
  "video",
  "audio",
  "text",
  "pdf",
  "archive",
  "other",
] as const;

export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

const ARCHIVES = new Set([
  "application/zip",
  "application/gzip",
  "application/x-tar",
  "application/x-7z-compressed",
]);

/** The category of a MIME type. */
export function contentCategory(mimeType: string): ContentCategory {
  const type = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (type === "application/pdf") return "pdf";
  if (ARCHIVES.has(type)) return "archive";
  const top = type.split("/")[0];
  if (top === "image" || top === "video" || top === "audio" || top === "text")
    return top;
  return "other";
}

/** A file was stored in a workspace (through the FILES binding). */
export const fileUploadedEvent = defineEvent(
  "files.uploaded",
  { strings: ["content_category"], numbers: ["size_bytes"] },
  z
    .object({
      content_category: z.enum(CONTENT_CATEGORIES),
      size_bytes: z.number().int().nonnegative(),
    })
    .strict(),
  {
    client: false,
    description:
      "A file was stored in a workspace through the Worker; its category and size",
  }
);
