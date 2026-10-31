import { env } from "cloudflare:workers";
import { vi } from "vitest";
import { DATA_CATALOG } from "../src/data-catalog";
import {
  createMemoryEmail,
  createMemoryErrorReporter,
  createMemoryZip,
} from "../src/platform";
import { seedUser, seedWorkspace, useCaseDeps } from "./fixtures";

let n = 0;
export async function privacyFixture() {
  const person = await seedUser(`Privacy ${++n}`, `privacy-${n}@example.test`);
  const actor = await seedWorkspace(person.id, { kind: "personal" });
  const deps = {
    ...useCaseDeps("2026-10-31T12:00:00.000Z"),
    bucket: env.FILES,
    catalog: DATA_CATALOG,
    app: { secret: "privacy-test-secret-000000000000000000" },
    zip: createMemoryZip(),
    email: createMemoryEmail(),
    errors: createMemoryErrorReporter(),
    notify: vi.fn().mockResolvedValue({
      status: "enqueued",
      eventId: "notice",
      recipients: 1,
    }),
  };
  return { person, actor, deps };
}
