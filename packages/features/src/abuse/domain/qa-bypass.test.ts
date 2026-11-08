import { describe, expect, it } from "vitest";

import { isQaEmail } from "./qa-bypass";

describe("isQaEmail", () => {
  it.each([
    "qa-20261108abcd-owner@qa.example.com",
    "QA-Run-A@QA.Example.Com",
    "  qa-x@qa.example.com ",
  ])("accepts %s", (email) => {
    expect(isQaEmail(email, "qa.example.com")).toBe(true);
  });

  it.each([
    ["another domain", "someone@example.com"],
    ["a subdomain of the QA domain", "a@x.qa.example.com"],
    ["a lookalike domain", "a@evilqa.example.com"],
    ["the domain in the local part", "qa.example.com@example.com"],
    ["two at signs", "a@qa.example.com@example.com"],
    ["no local part", "@qa.example.com"],
    ["no email", null],
    [
      "an address whose first 320 characters end in the QA domain",
      `${"a".repeat(306)}@qa.example.com.attacker.example`,
    ],
    ["an address over 254 characters", `${"a".repeat(250)}@qa.example.com`],
    ["an empty email", ""],
  ])("refuses %s", (_, email) => {
    expect(isQaEmail(email, "qa.example.com")).toBe(false);
  });
});
