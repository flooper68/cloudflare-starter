import {
  createMailjetEmailService,
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
  const entries = Object.entries(env ?? {}).map(([key, value]) => [
    key,
    typeof value === "string" ? value : undefined,
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
  return parseOptionalFeature("Mailjet", () => {
    const config = parseAppConfig(env);
    if (
      !config.MAILJET_API_KEY ||
      !config.MAILJET_SECRET_KEY ||
      !config.MAILJET_FROM_EMAIL ||
      !config.MAILJET_FROM_NAME
    ) {
      throw new Error("Missing one or more Mailjet environment variables");
    }

    return createMailjetEmailService({
      apiKey: config.MAILJET_API_KEY,
      secretKey: config.MAILJET_SECRET_KEY,
      fromEmail: config.MAILJET_FROM_EMAIL,
      fromName: config.MAILJET_FROM_NAME,
      sandbox: config.MAILJET_SANDBOX,
    });
  });
}
