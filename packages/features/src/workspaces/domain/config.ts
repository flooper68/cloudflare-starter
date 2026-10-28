import { z } from "zod";

import { normalizeEmail } from "./invitation";
import { WORKSPACE_MODES, type WorkspaceMode } from "./mode";
import { SIGN_UP_POLICIES, type SignUpPolicy } from "./sign-up-policy";

/** The workspace and sign-up settings of one environment, parsed from its vars. */
export interface WorkspaceSettings {
  readonly mode: WorkspaceMode;
  readonly signUp: SignUpPolicy;
  readonly signUpDomains: readonly string[];
  readonly bootstrapAdminEmail: string | null;
}

const DOMAIN = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** `"example.com, Example.org"` → `["example.com", "example.org"]`; blank means none. */
function parseDomains(value: string | undefined, ctx: z.RefinementCtx) {
  const domains = (value ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
  for (const domain of domains) {
    if (!DOMAIN.test(domain)) {
      ctx.addIssue({
        code: "custom",
        message: `SIGN_UP_DOMAINS: "${domain}" is not a domain`,
      });
    }
  }
  return domains;
}

/**
 * The vars, required and without defaults: an environment states its mode and sign-up
 * policy explicitly, and settings that would lock everyone out fail at startup.
 */
export const workspaceSettingsSchema = z
  .object({
    WORKSPACE_MODE: z.enum(WORKSPACE_MODES, {
      error: "WORKSPACE_MODE must be personal, single or multi",
    }),
    SIGN_UP: z.enum(SIGN_UP_POLICIES, {
      error: "SIGN_UP must be open or invite",
    }),
    SIGN_UP_DOMAINS: z.string().optional().transform(parseDomains),
    BOOTSTRAP_ADMIN_EMAIL: z
      .email({ error: "BOOTSTRAP_ADMIN_EMAIL must be an email address" })
      .optional(),
  })
  .transform((raw, ctx): WorkspaceSettings => {
    const settings: WorkspaceSettings = {
      mode: raw.WORKSPACE_MODE,
      signUp: raw.SIGN_UP,
      signUpDomains: raw.SIGN_UP_DOMAINS,
      bootstrapAdminEmail: raw.BOOTSTRAP_ADMIN_EMAIL
        ? normalizeEmail(raw.BOOTSTRAP_ADMIN_EMAIL)
        : null,
    };
    if (settings.mode === "single" && !settings.bootstrapAdminEmail) {
      ctx.addIssue({
        code: "custom",
        message:
          "WORKSPACE_MODE=single needs BOOTSTRAP_ADMIN_EMAIL: the owner of the app's workspace",
      });
    }
    if (
      settings.signUp === "invite" &&
      !settings.bootstrapAdminEmail &&
      settings.signUpDomains.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "SIGN_UP=invite needs BOOTSTRAP_ADMIN_EMAIL or SIGN_UP_DOMAINS, or nobody can ever sign up",
      });
    }
    return settings;
  });
