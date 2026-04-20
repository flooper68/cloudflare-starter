import { createDb, type Database } from "@cloudflare-starter/features";
import { buildRequiredConfig } from "@/lib/env";

let localDb: Database | null = null;

export function getDb(
  runtimeEnv?: Record<string, unknown>,
  hyperdrive?: Hyperdrive
): Database {
  if (hyperdrive) {
    return createDb(hyperdrive.connectionString);
  }

  localDb ??= createDb(buildRequiredConfig(runtimeEnv).DATABASE_URL);
  return localDb;
}
