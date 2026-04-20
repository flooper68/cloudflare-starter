import { describe, expect, it, vi } from "vitest";

import { createMailjetEmailService } from "./index";

describe("email", () => {
  it("builds a mailjet request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "",
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const service = createMailjetEmailService({
        apiKey: "key",
        secretKey: "secret",
        fromEmail: "noreply@example.com",
        fromName: "Cloudflare Starter",
        sandbox: true,
      });

      await service.sendTestEmail({
        to: { email: "test@example.com", name: "Nicole" },
        environment: "local",
      });

      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
