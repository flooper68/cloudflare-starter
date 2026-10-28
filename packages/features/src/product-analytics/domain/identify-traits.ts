import { z } from "zod";

import type { AnalyticsEventLayout } from "../../kernel";

/** Workspace sizes as buckets: enough to segment by, too coarse to single anyone out. */
export const WORKSPACE_SIZE_BUCKETS = [
  "1",
  "2-5",
  "6-20",
  "21-100",
  "101+",
] as const;

export type WorkspaceSizeBucket = (typeof WORKSPACE_SIZE_BUCKETS)[number];

/** The bucket of a workspace with `members` members. */
export function workspaceSizeBucket(members: number): WorkspaceSizeBucket {
  if (members <= 1) return "1";
  if (members <= 5) return "2-5";
  if (members <= 20) return "6-20";
  if (members <= 100) return "21-100";
  return "101+";
}

/**
 * The traits an identify call may carry (Segment `identify` traits), catalog-only like
 * event properties: the user's role in the workspace, its size bucket and its plan.
 */
export const identifyTraitsSchema = z
  .object({
    role: z.string().min(1).max(32),
    workspace_size: z.enum(WORKSPACE_SIZE_BUCKETS),
    // The plan in effect (billing), its catalog id.
    plan: z.string().min(1).max(32),
  })
  .strict();

export type IdentifyTraitValues = z.infer<typeof identifyTraitsSchema>;

/** Slot order of the traits (blob7.. of a `$identify` data point). */
export const IDENTIFY_TRAITS_LAYOUT: AnalyticsEventLayout<
  keyof IdentifyTraitValues
> = {
  strings: ["role", "workspace_size", "plan"],
  numbers: [],
};
