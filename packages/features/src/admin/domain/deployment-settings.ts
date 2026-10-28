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
