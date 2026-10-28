import { describe, expect, it } from "vitest";
import { z } from "zod";

import { defineEvent } from "../../kernel";
import {
  eventDefinitionProblems,
  layoutProblems,
  PERSONAL_DATA_PROPERTY,
} from "./event-rules";

describe("PERSONAL_DATA_PROPERTY", () => {
  it.each([
    "email",
    "user_email",
    "phone",
    "name",
    "full_name",
    "first_seen",
    "last_login",
    "address",
    "ip",
    "client_ip",
    "user_id",
    "userid",
    "ssn",
    "birth_year",
    "password",
    "token",
    "lat",
    "lng",
    "location",
  ])("flags %s", (name) => {
    expect(PERSONAL_DATA_PROPERTY.test(name)).toBe(true);
  });

  it.each([
    "content_category",
    "size_bytes",
    "kind",
    "role",
    "via",
    "route",
    "method",
    "provider",
    "workspace_size",
    "plan",
  ])("lets %s through", (name) => {
    expect(PERSONAL_DATA_PROPERTY.test(name)).toBe(false);
  });
});

describe("layoutProblems", () => {
  it("accepts a layout within the limits", () => {
    expect(
      layoutProblems({ strings: ["kind"], numbers: ["size_bytes"] })
    ).toEqual([]);
  });

  it("refuses personal data, bad names, duplicates and too many slots", () => {
    expect(
      layoutProblems({ strings: ["email", "Kind", "kind"], numbers: ["kind"] })
    ).toEqual([
      'property "email" looks like personal data: rename it (or drop it)',
      'property "Kind" is not lowercase snake case',
      "properties listed twice: kind",
    ]);
    const strings = Array.from({ length: 15 }, (_, i) => `s${i}`);
    const numbers = Array.from({ length: 21 }, (_, i) => `n${i}`);
    expect(layoutProblems({ strings, numbers })).toEqual([
      "15 string properties (at most 14)",
      "21 numeric properties (at most 20)",
    ]);
  });
});

describe("eventDefinitionProblems", () => {
  const schema = z.object({ kind: z.string(), size_bytes: z.number() });

  it("accepts a well-formed event", () => {
    expect(
      eventDefinitionProblems(
        defineEvent(
          "files.uploaded",
          { strings: ["kind"], numbers: ["size_bytes"] },
          schema,
          { client: false, description: "A file was stored" }
        )
      )
    ).toEqual([]);
  });

  it("refuses a bad name, a layout that differs from the schema, and no description", () => {
    expect(
      eventDefinitionProblems(
        defineEvent(
          "File Uploaded",
          { strings: ["kind"], numbers: [] },
          schema,
          {
            client: false,
            description: " ",
          }
        )
      )
    ).toEqual([
      'File Uploaded: name "File Uploaded" is not <feature>.<object>_<verb> in lowercase snake case',
      "File Uploaded: layout lists kind but the schema has kind, size_bytes",
      "File Uploaded: description is empty",
    ]);
    expect(
      eventDefinitionProblems(
        defineEvent(
          `files.${"x".repeat(60)}`,
          { strings: ["kind"], numbers: ["size_bytes"] },
          schema,
          { client: false, description: "Long" }
        )
      )
    ).toEqual([`files.${"x".repeat(60)}: name is longer than 64 characters`]);
  });
});
