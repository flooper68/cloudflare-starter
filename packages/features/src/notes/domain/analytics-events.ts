import { z } from "zod";

import { defineEvent } from "../../kernel";

/** Coarse body sizes, so the event never carries the text or its exact length. */
export const NOTE_LENGTH_BUCKETS = ["empty", "short", "long"] as const;
export type NoteLengthBucket = (typeof NOTE_LENGTH_BUCKETS)[number];

/** The bucket of a body: empty, under 500 characters, or longer. */
export function noteLengthBucket(body: string): NoteLengthBucket {
  if (body.trim().length === 0) return "empty";
  return body.length < 500 ? "short" : "long";
}

/** A note was created in a workspace (the placeholder Notes app). */
export const noteCreatedEvent = defineEvent(
  "notes.created",
  { strings: ["length"], numbers: [] },
  z.object({ length: z.enum(NOTE_LENGTH_BUCKETS) }).strict(),
  {
    client: false,
    description:
      "A note was created in a workspace; the bucket of its body length",
  }
);
