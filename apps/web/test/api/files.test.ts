import type { APIContext } from "astro";
import { describe, expect, it } from "vitest";

import { GET } from "@/pages/api/files/[id]";
import { POST } from "@/pages/api/files/index";

import {
  APP_URL,
  callerFor,
  signUp,
  type TestUser,
  testRequestContext,
} from "./helpers";

function context(
  request: Request,
  user: TestUser | null,
  params: Record<string, string> = {}
) {
  return {
    request,
    url: new URL(request.url),
    params,
    locals: {
      user: user ? { id: user.id, email: user.email, name: user.name } : null,
      requestContext: testRequestContext(),
    },
  } as unknown as APIContext;
}

function upload(content: string, origin = APP_URL) {
  const form = new FormData();
  form.set("file", new File([content], "notes.txt", { type: "text/plain" }));
  return new Request(`${APP_URL}/api/files`, {
    method: "POST",
    body: form,
    headers: { origin },
  });
}

describe("file routes (FILES binding)", () => {
  it("uploads, lists and serves a file to its owner only", async () => {
    const owner = await signUp("Nicole Example", "nicole@example.test");
    const stranger = await signUp("Alan Turing", "alan@example.test");

    const created = await POST(context(upload("Q4 roadmap"), owner));
    expect(created.status).toBe(201);
    const { fileId, url } = (await created.json()) as {
      fileId: string;
      url: string;
    };
    expect(url).toBe(`/api/files/${fileId}`);

    const listed = await callerFor(owner).storage.listFiles({});
    expect(listed.items.map((file) => file.id)).toEqual([fileId]);

    const read = await GET(
      context(new Request(`${APP_URL}${url}`), owner, { id: fileId })
    );
    expect(read.status).toBe(200);
    expect(read.headers.get("content-type")).toBe("text/plain");
    expect(await read.text()).toBe("Q4 roadmap");

    const hidden = await GET(
      context(new Request(`${APP_URL}${url}`), stranger, { id: fileId })
    );
    expect(hidden.status).toBe(404);
  });

  it("refuses anonymous and cross-origin uploads and invalid files", async () => {
    const user = await signUp("Ada Lovelace", "ada@example.test");
    expect((await POST(context(upload("x"), null))).status).toBe(401);
    expect(
      (await POST(context(upload("x", "https://evil.example"), user))).status
    ).toBe(403);
    const empty = new Request(`${APP_URL}/api/files`, {
      method: "POST",
      body: new FormData(),
      headers: { origin: APP_URL },
    });
    expect((await POST(context(empty, user))).status).toBe(400);
  });

  it("answers 404 for unknown ids and anonymous reads", async () => {
    const user = await signUp("Grace Hopper", "grace@example.test");
    const request = new Request(`${APP_URL}/api/files/unknown`);
    expect((await GET(context(request, user, { id: "unknown" }))).status).toBe(
      404
    );
    expect((await GET(context(request, null, { id: "unknown" }))).status).toBe(
      404
    );
  });
});
