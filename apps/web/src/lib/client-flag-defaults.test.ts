import { FLAGS } from "@cloudflare-starter/features";
import { describe, expect, it } from "vitest";

import { CLIENT_FLAG_DEFAULTS } from "./client-flag-defaults";

describe("CLIENT_FLAG_DEFAULTS", () => {
  it("equals the catalog defaults of the client flags", () => {
    const expected = Object.fromEntries(
      Object.entries(FLAGS)
        .filter(([, definition]) => definition.client)
        .map(([key, definition]) => [key, definition.default])
    );
    expect(CLIENT_FLAG_DEFAULTS).toEqual(expected);
  });
});
