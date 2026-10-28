import { z } from "zod";

/** A workspace name as people type it: trimmed, 1 to 80 characters. */
export const workspaceNameSchema = z.string().trim().min(1).max(80);

/** The name of each user's personal workspace. */
export const PERSONAL_WORKSPACE_NAME = "Personal";
