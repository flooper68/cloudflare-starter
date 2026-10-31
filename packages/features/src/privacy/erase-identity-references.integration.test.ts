import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { rows } from "../../test/fixtures";
import { privacyFixture } from "../../test/privacy-fixtures";
import { eraseIdentityReferences } from "./erase-identity-references";

describe("eraseIdentityReferences", () => {
  it("removes matching verification records without another person's record", async () => {
    const { deps, person } = await privacyFixture();
    await env.DB.prepare(
      "INSERT INTO verification(id,identifier,value,expires_at) VALUES ('one','reset-token',?,1),('two','other','other-user',1)"
    )
      .bind(person.id)
      .run();
    await eraseIdentityReferences(deps, {
      userId: person.id,
      email: person.email,
    });
    expect(await rows("SELECT id FROM verification")).toEqual([{ id: "two" }]);
  });
});
