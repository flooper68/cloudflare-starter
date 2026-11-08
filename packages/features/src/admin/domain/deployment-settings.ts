/** Sign-in methods a deployment can offer. */
export type SignInMethod = "email_password" | "google";

/** What the admin settings page shows: the environment's settings, read-only. */
export interface DeploymentSettings {
  readonly environment: string;
  readonly workspaceMode: "personal" | "single" | "multi";
  readonly signUp: "open" | "invite";
  readonly signUpDomains: readonly string[];
  readonly bootstrapAdminEmail: string | null;
  readonly signInMethods: readonly SignInMethod[];
  readonly emailVerificationRequired: boolean;
  readonly emailEnabled: boolean;
  readonly adminPortal: "on" | "off";
  /** DEMO_MODE and, with on, its retention, sample data and the accounts it never erases. */
  readonly demo:
    | { readonly mode: "off" }
    | {
        readonly mode: "on";
        readonly retentionDays: number;
        readonly sampleData: boolean;
        readonly protectedEmails: readonly string[];
        readonly qaEmailDomain: string | null;
      };
}

export interface DeploymentSettingsInput
  extends Omit<
    DeploymentSettings,
    "signInMethods" | "emailVerificationRequired"
  > {
  readonly methods: {
    readonly emailPassword: boolean;
    readonly google: boolean;
    readonly requireEmailVerification: boolean;
  };
}

/**
 * The settings as the admin portal shows them. Changing any of them is a deploy
 * (`bun run setup:auth`), never an action in the portal.
 */
export function deploymentSettings(
  input: DeploymentSettingsInput
): DeploymentSettings {
  const { methods, ...settings } = input;
  const signInMethods: SignInMethod[] = [];
  if (methods.emailPassword) signInMethods.push("email_password");
  if (methods.google) signInMethods.push("google");
  return {
    ...settings,
    signInMethods,
    emailVerificationRequired:
      methods.emailPassword && methods.requireEmailVerification,
  };
}
