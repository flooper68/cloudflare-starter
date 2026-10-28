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
  user: TestUser,
  params: Record<string, string> = {}
) {
  return {
    request,
    url: new URL(request.url),
    params,
    locals: {
      user: { id: user.id, email: user.email, name: user.name },
      requestContext: testRequestContext(),
    },
  } as unknown as APIContext;
}

/** Uploads through the binding route into a workspace; returns the file id and its URL. */
async function upload(user: TestUser, workspaceId: string, name: string) {
  const form = new FormData();
  form.set(
    "file",
    new File([`contents of ${name}`], name, { type: "text/plain" })
  );
  const response = await POST(
    context(
      new Request(`${APP_URL}/api/files?workspaceId=${workspaceId}`, {
        method: "POST",
        body: form,
        headers: { origin: APP_URL },
      }),
      user
    )
  );
  expect(response.status).toBe(201);
  return (await response.json()) as { fileId: string; url: string };
}

async function download(user: TestUser, file: { fileId: string; url: string }) {
  const response = await GET(
    context(new Request(`${APP_URL}${file.url}`), user, { id: file.fileId })
  );
  return response.status;
}

describe("trash procedures", () => {
  it("move to trash, list, restore, delete permanently and empty: members and owners", async () => {
    const owner = await signUp("Ada Lovelace", "ada@trash.test");
    const member = await signUp("Grace Hopper", "grace@trash.test");
    const team = await callerFor(owner).workspace.create({ name: "Acme" });
    const workspaceId = team.id;
    const token = await inviteByMail(owner, workspaceId, member.email);
    await callerFor(member).workspace.invitations.accept({ token });
    const asOwner = callerFor(owner);
    const asMember = callerFor(member);

    const roadmap = await upload(owner, workspaceId, "roadmap.txt");
    const notes = await upload(owner, workspaceId, "notes.txt");
    const budget = await upload(owner, workspaceId, "budget.txt");

    // A member moves a file to the trash: gone from the list and from downloads.
    const trashed = await asMember.storage.deleteFile({
      workspaceId,
      fileId: roadmap.fileId,
    });
    expect(trashed).toMatchObject({ type: "file", id: roadmap.fileId });
    const listed = await asOwner.storage.listFiles({ workspaceId });
    expect(listed.items.map((file) => file.id)).not.toContain(roadmap.fileId);
    expect(await download(owner, roadmap)).toBe(404);

    const ownerView = await asOwner.trash.list({ workspaceId });
    expect(ownerView.items).toEqual([
      expect.objectContaining({
        type: "file",
        id: roadmap.fileId,
        label: "roadmap.txt",
        deletedBy: { userId: member.id, name: "Grace Hopper" },
      }),
    ]);
    expect(ownerView.can).toEqual({ restore: true, purge: true });
    const memberView = await asMember.trash.list({ workspaceId, type: "file" });
    expect(memberView.can).toEqual({ restore: true, purge: false });

    // Restore: back in the list and downloadable.
    expect(
      await asMember.trash.restore({
        workspaceId,
        items: [{ type: "file", id: roadmap.fileId }],
      })
    ).toEqual({ restored: [{ type: "file", id: roadmap.fileId }] });
    expect(await download(owner, roadmap)).toBe(200);
    await expect(
      asMember.trash.restore({
        workspaceId,
        items: [{ type: "file", id: roadmap.fileId }],
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Deleting for good is the owner's.
    await asMember.storage.deleteFile({ workspaceId, fileId: notes.fileId });
    await expect(
      asMember.trash.deletePermanently({
        workspaceId,
        items: [{ type: "file", id: notes.fileId }],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(asMember.trash.empty({ workspaceId })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(
      await asOwner.trash.deletePermanently({
        workspaceId,
        items: [{ type: "file", id: notes.fileId }],
      })
    ).toEqual({ purged: [{ type: "file", id: notes.fileId }] });

    await asOwner.storage.deleteFile({ workspaceId, fileId: budget.fileId });
    expect(await asOwner.trash.empty({ workspaceId })).toEqual({ purged: 1 });
    expect((await asOwner.trash.list({ workspaceId })).items).toEqual([]);
    expect(
      (await asOwner.storage.listFiles({ workspaceId })).items.map(
        (file) => file.id
      )
    ).toEqual([roadmap.fileId]);
    await expect(
      asOwner.storage.deleteFile({ workspaceId, fileId: budget.fileId })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses anonymous callers and invalid input", async () => {
    const anonymous = callerFor(null);
    const fileId = "00000000-0000-4000-8000-000000000001";
    await expect(
      anonymous.storage.deleteFile({ fileId })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonymous.trash.list({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      anonymous.trash.restore({ items: [{ type: "file", id: fileId }] })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      anonymous.trash.deletePermanently({
        items: [{ type: "file", id: fileId }],
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonymous.trash.empty({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    const user = await signUp("Alan Turing", "alan@trash.test");
    await expect(
      callerFor(user).trash.restore({ items: [] })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      callerFor(user).trash.list({ type: "note" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("trash procedures refuse other workspaces", async () => {
    const items = [
      { type: "file", id: "00000000-0000-4000-8000-000000000001" },
    ];
    await expectCrossWorkspaceDenied("storage.deleteFile", {
      fileId: "00000000-0000-4000-8000-000000000001",
    });
    await expectCrossWorkspaceDenied("trash.list", {});
    await expectCrossWorkspaceDenied("trash.restore", { items });
    await expectCrossWorkspaceDenied("trash.deletePermanently", { items });
    await expectCrossWorkspaceDenied("trash.empty", {});
  });
});
