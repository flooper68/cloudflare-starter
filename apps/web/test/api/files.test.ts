import type { APIContext } from "astro";
import { describe, expect, it } from "vitest";

import { GET } from "@/pages/api/files/[id]";
import { POST } from "@/pages/api/files/index";

import {
  APP_URL,
  callerFor,
  expectCrossWorkspaceDenied,
  inviteByMail,
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

function upload(content: string, origin = APP_URL, query = "") {
  const form = new FormData();
  form.set("file", new File([content], "notes.txt", { type: "text/plain" }));
  return new Request(`${APP_URL}/api/files${query}`, {
    method: "POST",
    body: form,
    headers: { origin },
  });
}

const read = (url: string, user: TestUser | null, id: string) =>
  GET(context(new Request(`${APP_URL}${url}`), user, { id }));

describe("file routes (FILES binding)", () => {
  it("uploads into the current workspace and serves the file to its members only", async () => {
    const owner = await signUp("Nicole Example", "nicole@example.test");
    const colleague = await signUp("Grace Hopper", "grace@example.test");
    const stranger = await signUp("Alan Turing", "alan@example.test");

    const created = await POST(context(upload("Q4 roadmap"), owner));
    expect(created.status).toBe(201);
    const { fileId, url } = (await created.json()) as {
      fileId: string;
      url: string;
    };
    const { activeWorkspaceId } = await callerFor(owner).workspace.list();
    expect(url).toBe(`/api/files/${fileId}?workspaceId=${activeWorkspaceId}`);

    const listed = await callerFor(owner).storage.listFiles({});
    expect(listed.items.map((file) => file.id)).toEqual([fileId]);

    const served = await read(url, owner, fileId);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("text/plain");
    expect(await served.text()).toBe("Q4 roadmap");

    // Another user: not a member of that workspace, and not in their own either.
    expect((await read(url, stranger, fileId)).status).toBe(404);
    expect((await read(`/api/files/${fileId}`, stranger, fileId)).status).toBe(
      404
    );

    // A shared workspace: a file one member uploads, another member reads.
    const team = await callerFor(owner).workspace.create({ name: "Acme" });
    const shared = await POST(
      context(upload("shared notes", APP_URL, `?workspaceId=${team.id}`), owner)
    );
    const sharedFile = (await shared.json()) as { fileId: string; url: string };
    expect(
      (await read(sharedFile.url, colleague, sharedFile.fileId)).status
    ).toBe(404);

    const token = await inviteByMail(owner, team.id, colleague.email);
    await callerFor(colleague).workspace.invitations.accept({ token });
    const joined = await read(sharedFile.url, colleague, sharedFile.fileId);
    expect(joined.status).toBe(200);
    expect(await joined.text()).toBe("shared notes");
    // Membership in the team does not open the owner's personal workspace.
    expect((await read(url, colleague, fileId)).status).toBe(404);
  });

  it("refuses an upload into a workspace the user is not a member of", async () => {
    const user = await signUp("Ken Thompson", "ken@example.test");
    const response = await POST(
      context(upload("x", APP_URL, "?workspaceId=not-mine"), user)
    );
    expect(response.status).toBe(404);
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
    const user = await signUp("Grace Example", "grace.example@example.test");
    expect((await read("/api/files/unknown", user, "unknown")).status).toBe(
      404
    );
    expect((await read("/api/files/unknown", null, "unknown")).status).toBe(
      404
    );
  });

  it("storage procedures refuse other workspaces", async () => {
    await expectCrossWorkspaceDenied("storage.listFiles", {});
    await expectCrossWorkspaceDenied("storage.createUpload", {
      filename: "plan.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
    });
    await expectCrossWorkspaceDenied("storage.getDownloadUrl", {
      fileId: "00000000-0000-4000-8000-000000000001",
    });
  });
});
