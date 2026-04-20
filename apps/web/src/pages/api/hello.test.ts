import { describe, expect, it } from "vitest";

import { GET } from "./hello";

describe("/api/hello", () => {
  it("returns hello world", async () => {
    const response = await GET({} as never);
    expect(await response.json()).toEqual({ message: "hello world" });
  });
});
