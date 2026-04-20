import { describe, expect, it, vi } from "vitest";
import type { Context } from "./init";
import { appRouter } from "./router";

const caller = appRouter.createCaller;

function createContext(overrides: Partial<Context> = {}): Context {
  return {
    db: {} as Context["db"],
    config: {
      APP_URL: "http://localhost:4321",
      DATABASE_URL:
        "postgresql://postgres:postgres@127.0.0.1:54329/cloudflare_starter",
      PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test",
      CLERK_SECRET_KEY: "sk_test",
      MAILJET_SANDBOX: true,
      APP_ENV: "local",
    },
    email: {
      enabled: true,
      reason: null,
      value: { sendTestEmail: vi.fn().mockResolvedValue(undefined) },
    },
    r2: {
      enabled: true,
      reason: null,
      value: {
        accountId: "id",
        accessKeyId: "key",
        secretAccessKey: "secret",
        filesBucketName: "bucket",
      },
    },
    queue: {
      send: vi.fn().mockResolvedValue(undefined),
    } as unknown as Queue<
      import("@cloudflare-starter/features").AppQueueMessage
    >,
    clerkUser: {
      id: "user_123",
      firstName: "Nicole",
      lastName: "Example",
      primaryEmailAddress: { emailAddress: "nicole@example.com" },
    } as never,
    appUser: {
      id: "9f4c17b6-e154-4db2-b97b-08e09ec90f4e",
      email: "nicole@example.com",
      name: "Nicole Example",
    },
    ...overrides,
  };
}

describe("appRouter", () => {
  it("requires auth for protected procedures", async () => {
    const api = caller(
      createContext({
        clerkUser: null,
        appUser: null,
      })
    );

    await expect(api.email.sendTest()).rejects.toThrow();
  });

  it("queues hello messages", async () => {
    const ctx = createContext();
    const api = caller(ctx);

    const result = await api.queue.enqueueHello({ name: "Nicole" });

    expect(result).toEqual({ queued: true });
    expect(
      (ctx.queue as unknown as { send: ReturnType<typeof vi.fn> }).send
    ).toHaveBeenCalled();
  });

  it("rejects download URLs for missing or unowned files", async () => {
    const ctx = createContext({
      db: {
        query: {
          files: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      } as unknown as Context["db"],
    });
    const api = caller(ctx);

    await expect(
      api.storage.getDownloadUrl({
        fileId: "9f4c17b6-e154-4db2-b97b-08e09ec90f4e",
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "File not found",
    });
  });

  it("sends test email to the signed-in user", async () => {
    const ctx = createContext();
    const api = caller(ctx);

    const result = await api.email.sendTest();

    expect(result).toEqual({ sent: true });
    expect(ctx.email.value?.sendTestEmail).toHaveBeenCalled();
  });
});
