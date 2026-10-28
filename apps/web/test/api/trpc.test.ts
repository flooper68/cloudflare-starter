import { TRPCError } from "@trpc/server";
import { beforeAll, describe, expect, it } from "vitest";

import { callerFor, signUp, type TestUser } from "./helpers";

describe("tRPC procedures (real D1, real bindings)", () => {
  // One user per file: sign-up is rate limited (5 a minute) like in production.
  let user: TestUser;
  beforeAll(async () => {
    user = await signUp("Nicole Example", "nicole@example.test");
  });

  it("public.hello answers anyone", async () => {
    expect(await callerFor(null).public.hello()).toEqual({
      message: "hello world",
    });
  });

  it("protected procedures refuse anonymous callers", async () => {
    await expect(callerFor(null).health.hello()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(callerFor(null).storage.listFiles({})).rejects.toBeInstanceOf(
      TRPCError
    );
  });

  it("health.hello names the signed-in user and environment", async () => {
    expect(await callerFor(user).health.hello()).toEqual({
      message: "hello world",
      user: "nicole@example.test",
      environment: "develop",
    });
  });

  it("storage.listFiles starts empty for a new user", async () => {
    expect(await callerFor(user).storage.listFiles({})).toEqual({ items: [] });
  });

  it("presigned storage procedures report missing R2 credentials as PRECONDITION_FAILED", async () => {
    await expect(
      callerFor(user).storage.createUpload({
        filename: "video.mp4",
        mimeType: "video/mp4",
        sizeBytes: 100,
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "R2 presigned URLs are not configured",
    });
    await expect(
      callerFor(user).storage.getDownloadUrl({
        fileId: "00000000-0000-4000-8000-000000000001",
      })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("storage.createUpload validates input before anything else", async () => {
    await expect(
      callerFor(user).storage.createUpload({
        filename: "../x",
        mimeType: "text/plain",
        sizeBytes: 1,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("queue.enqueueHello sends to the real APP_QUEUE binding", async () => {
    expect(
      await callerFor(user).queue.enqueueHello({ name: "Barbara" })
    ).toEqual({
      queued: true,
      jobId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

  it("email.sendTest sends through the simulated send_email binding", async () => {
    expect(await callerFor(user).email.sendTest()).toEqual({ sent: true });
  });
});
