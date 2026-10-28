import { describe, expect, it } from "vitest";

import {
  FLAG_KEY_PATTERN,
  FLAGS,
  findFlagDefinition,
  flagDefinitionSchema,
} from "./catalog";

describe("flag catalog", () => {
  it.each(Object.entries(FLAGS))(
    "%s has a kebab-case key, an owner, a removal condition and a default of its type",
    (key, definition) => {
      expect(key).toMatch(FLAG_KEY_PATTERN);
      expect(flagDefinitionSchema.safeParse(definition).success).toBe(true);
    }
  );

  it("rejects entries without an owner or removal condition, or with a default of another type", () => {
    const valid = {
      type: "string",
      default: "table",
      owner: "files",
      removeWhen: "cards are the only layout for two weeks",
      rolloutBy: "user",
      client: false,
      description: "Layout of the file list.",
    };
    expect(flagDefinitionSchema.safeParse(valid).success).toBe(true);
    for (const broken of [
      { ...valid, owner: " " },
      { ...valid, removeWhen: "" },
      { ...valid, default: 3 },
      { ...valid, rolloutBy: "team" },
      { ...valid, type: "json" },
    ]) {
      expect(flagDefinitionSchema.safeParse(broken).success).toBe(false);
    }
  });

  it("accepts kebab-case keys only", () => {
    for (const key of ["upload-demo-presigned", "v2-editor", "beta"])
      expect(key).toMatch(FLAG_KEY_PATTERN);
    for (const key of ["Upload", "upload_demo", "-x", "x-", "a--b", "a.b"])
      expect(key).not.toMatch(FLAG_KEY_PATTERN);
  });

  it("finds catalog entries and nothing else", () => {
    expect(findFlagDefinition("upload-demo-presigned")).toMatchObject({
      key: "upload-demo-presigned",
      type: "boolean",
    });
    expect(findFlagDefinition("not-a-flag")).toBeUndefined();
    expect(findFlagDefinition("constructor")).toBeUndefined();
  });
});
