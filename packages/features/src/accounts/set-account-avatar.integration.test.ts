import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { rows, seedUser, sequentialIds } from "../../test/fixtures";
import {
  gatedProfilePuts,
  png,
  profileDeps,
} from "../../test/profile-fixtures";
import { setAccountAvatar } from "./set-account-avatar";

describe("setAccountAvatar", () => {
  it("preserves ownership and the settings contract", async () => {
    const user = await seedUser();
    const deps = profileDeps();
    const first = await setAccountAvatar(deps, {
      userId: user.id,
      bytes: png,
      contentType: "image/png",
    });
    const key = (
      await rows(
        "SELECT avatar_key FROM user_settings WHERE user_id = ?",
        user.id
      )
    )[0]?.avatar_key as string;
    expect(await env.FILES.head(key)).not.toBeNull();
    const second = await setAccountAvatar(deps, {
      userId: user.id,
      bytes: png,
      contentType: "image/png",
    });
    expect(second.avatarUrl).not.toBe(first.avatarUrl);
    expect(await env.FILES.head(key)).toBeNull();
    await expect(
      setAccountAvatar(deps, {
        userId: user.id,
        bytes: png,
        contentType: "image/svg+xml",
      })
    ).rejects.toThrow();
  });
});

it.each([
  [0, 1],
  [1, 0],
])(
  "concurrent avatar publication (%s then %s) preserves the final image and other users",
  async (first, last) => {
    const owner = await seedUser(`Concurrent avatar ${first}`);
    const other = await seedUser(`Other avatar ${first}`);
    const deps = {
      ...profileDeps(),
      ids: sequentialIds(`1000000${first}-0000-4000-8000-`),
    };
    await setAccountAvatar(deps, {
      userId: owner.id,
      bytes: png,
      contentType: "image/png",
    });
    await setAccountAvatar(deps, {
      userId: other.id,
      bytes: png,
      contentType: "image/png",
    });
    const old = (
      await rows(
        "SELECT avatar_key FROM user_settings WHERE user_id = ?",
        owner.id
      )
    )[0]?.avatar_key as string;
    const untouched = (
      await rows(
        "SELECT avatar_key FROM user_settings WHERE user_id = ?",
        other.id
      )
    )[0]?.avatar_key as string;
    const gate = gatedProfilePuts(env.FILES);
    const content = [
      new Uint8Array([...png, 11]),
      new Uint8Array([...png, 22]),
    ];
    const pending = content.map((bytes) =>
      setAccountAvatar(
        { ...deps, bucket: gate.bucket },
        { userId: owner.id, bytes, contentType: "image/png" }
      )
    );
    await gate.arrived(2);
    gate.writes.find((write) => write.body === content[first])?.release();
    await pending[first];
    gate.writes.find((write) => write.body === content[last])?.release();
    await pending[last];
    const current = (
      await rows(
        "SELECT avatar_key FROM user_settings WHERE user_id = ?",
        owner.id
      )
    )[0]?.avatar_key as string;
    expect(current).toBe(
      gate.writes.find((write) => write.body === content[last])?.key
    );
    const object = await env.FILES.get(current);
    expect(object).not.toBeNull();
    if (!object) throw new Error("The winning image was removed");
    expect(new Uint8Array(await object.arrayBuffer())).toEqual(content[last]);
    expect(await env.FILES.head(old)).toBeNull();
    expect(await env.FILES.head(untouched)).not.toBeNull();
    expect(
      (
        await rows(
          "SELECT avatar_key FROM user_settings WHERE user_id = ?",
          other.id
        )
      )[0]?.avatar_key
    ).toBe(untouched);
  }
);
