import {
  createCloudflareEmail,
  type EmailService,
  type R2Config,
} from "@cloudflare-starter/features";
import {
  type FeatureConfig,
  parseAppConfig,
  parseOptionalFeature,
  type RequiredAppConfig,
} from "@/lib/config";

interface RuntimeEnv {
  readonly [key: string]: unknown;
}

function asStrings(
  env: RuntimeEnv | undefined
): Record<string, string | undefined> {
  // Blank lines in .dev.vars (`R2_ACCOUNT_ID=`) count as unset.
  const entries = Object.entries(env ?? {}).map(([key, value]) => [
    key,
    typeof value === "string" && value !== "" ? value : undefined,
  ]);
  return Object.fromEntries(entries);
}

export function buildRawEnv(
  runtimeEnv?: RuntimeEnv
): Record<string, string | undefined> {
  return {
    ...process.env,
    ...asStrings(runtimeEnv),
  };
}

export function buildRequiredConfig(
  runtimeEnv?: RuntimeEnv
): RequiredAppConfig {
  return parseAppConfig(buildRawEnv(runtimeEnv));
}

export function buildR2Feature(
  runtimeEnv?: RuntimeEnv
): FeatureConfig<R2Config> {
  const env = buildRawEnv(runtimeEnv);
  return parseOptionalFeature("R2", () => {
    const parsed = parseAppConfig(env);
    if (
      !parsed.R2_ACCOUNT_ID ||
      !parsed.R2_ACCESS_KEY_ID ||
      !parsed.R2_SECRET_ACCESS_KEY ||
      !parsed.R2_FILES_BUCKET_NAME
    ) {
      throw new Error("Missing one or more R2 environment variables");
    }

    return {
      accountId: parsed.R2_ACCOUNT_ID,
      accessKeyId: parsed.R2_ACCESS_KEY_ID,
      secretAccessKey: parsed.R2_SECRET_ACCESS_KEY,
      filesBucketName: parsed.R2_FILES_BUCKET_NAME,
    };
  });
}

export function buildEmailFeature(
  runtimeEnv?: RuntimeEnv
): FeatureConfig<EmailService> {
  const env = buildRawEnv(runtimeEnv);
  return parseOptionalFeature("Email", () => {
    const config = parseAppConfig(env);
    const binding = runtimeEnv?.EMAIL as SendEmail | undefined;
    if (!binding || !config.EMAIL_FROM) {
      throw new Error("Needs the EMAIL send_email binding and EMAIL_FROM");
    }

    return createCloudflareEmail({
      binding,
      from: { email: config.EMAIL_FROM, name: config.EMAIL_FROM_NAME },
    });
  });
}
