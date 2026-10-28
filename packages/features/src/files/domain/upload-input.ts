import { z } from "zod";

/** Largest file accepted by either upload path. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** What a client declares about a file before uploading it. */
export const uploadInputSchema = z.object({
  filename: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[A-Za-z0-9._-]+$/, "Only simple filenames are allowed"),
  mimeType: z.string().min(1).max(150),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export type UploadInput = z.infer<typeof uploadInputSchema>;
