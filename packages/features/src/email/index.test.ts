import { describe, expect, it, vi } from "vitest";

import { createCloudflareEmailService } from "./index";

describe("email", () => {
  it("sends through the binding with sender and recipient names", async () => {
    const binding = { send: vi.fn().mockResolvedValue({ messageId: "m1" }) };
    const service = createCloudflareEmailService({
      binding: binding as unknown as SendEmail,
      from: { email: "noreply@example.com", name: "Cloudflare Starter" },
    });

    await service.sendTestEmail({
      to: { email: "test@example.com", name: "Nicole" },
      environment: "local",
    });

    expect(binding.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { email: "noreply@example.com", name: "Cloudflare Starter" },
        to: { email: "test@example.com", name: "Nicole" },
        subject: "[local] Starter kit test email",
      })
    );
  });
});
