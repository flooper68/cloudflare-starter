import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DEFAULT_DEV_PORT, devPort } from "./dev-port.mjs";

function devVars(content: string): string {
  const path = join(mkdtempSync(join(tmpdir(), "dev-port-")), ".dev.vars");
  writeFileSync(path, content);
  return path;
}

describe("devPort", () => {
  it("is the port of APP_URL in .dev.vars", () => {
    expect(
      devPort(devVars("# comment\nAPP_URL=http://localhost:4567\nX=1\n"))
    ).toBe(4567);
  });

  it("falls back to 4321 without the file, the key, a port or a valid URL", () => {
    expect(devPort("/nonexistent/.dev.vars")).toBe(DEFAULT_DEV_PORT);
    expect(devPort(devVars("BETTER_AUTH_SECRET=x\n"))).toBe(4321);
    expect(devPort(devVars("APP_URL=http://localhost\n"))).toBe(4321);
    expect(devPort(devVars("APP_URL=not a url\n"))).toBe(4321);
  });
});
