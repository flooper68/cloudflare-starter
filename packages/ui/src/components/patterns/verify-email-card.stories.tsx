import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import {
  CheckInboxCard,
  EmailVerifiedCard,
  type ResendResult,
} from "./verify-email-card";

/**
 * Email verification: "Check your inbox" after sign-up (or for a signed-in user whose
 * address is not verified), and the page the link in the mail opens.
 */
const meta = {
  title: "Patterns/VerifyEmail",
  component: CheckInboxCard,
  tags: ["autodocs"],
  args: {
    email: "ada@analytical.example",
    onResend: fn(async (): Promise<ResendResult> => ({ status: "sent" })),
    onUseAnotherEmail: fn(),
  },
} satisfies Meta<typeof CheckInboxCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Right after sign-up with verification on. */
export const CheckInbox: Story = {};

/** A signed-in user: "Use another email" leads to the account settings. */
export const SignedIn: Story = {
  args: {
    onUseAnotherEmail: undefined,
    useAnotherEmailHref: "/app/settings/account",
  },
};

/** Resending confirms that a new link went out. */
export const ResendSends: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Resend link" }));
    await expect(args.onResend).toHaveBeenCalled();
    await expect(
      await canvas.findByText("Sent. Check your inbox again in a minute.")
    ).toBeVisible();
  },
};

/** Past the limit the server answers 429: the wait counts down instead of the button. */
export const ResendRateLimited: Story = {
  args: {
    onResend: fn(
      async (): Promise<ResendResult> => ({
        status: "rate-limited",
        retryAfterSeconds: 42,
      })
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Resend link" }));
    await expect(
      await canvas.findByText("Too many verification emails")
    ).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Resend link" })
    ).toBeNull();
  },
};

/** Any other failure shows its message and keeps the button. */
export const ResendFails: Story = {
  args: {
    onResend: fn(async () => {
      throw new Error("Email is not configured for this environment.");
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Resend link" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Email is not configured"
    );
  },
};

/** "Use another email" hands control back to the page (the sign-up form). */
export const UseAnotherEmail: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Use another email" })
    );
    await expect(args.onUseAnotherEmail).toHaveBeenCalled();
  },
};

/** The link worked. */
export const Verified: Story = {
  render: () => <EmailVerifiedCard state="verified" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Email verified" })
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "Continue to the app" })
    ).toHaveAttribute("href", "/app/dashboard");
  },
};

/** The link expired, was used or was cut off. */
export const LinkInvalid: Story = {
  render: () => <EmailVerifiedCard state="invalid" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("link", { name: "Send a new link" })
    ).toHaveAttribute("href", "/verify-email");
  },
};
