import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { OAuthConsentCard } from "./oauth-consent-card";

/**
 * The consent page `/consent` an MCP client opens: who asks, as whom, where the browser
 * returns, the scopes in plain words, and where to revoke the access later.
 */
const meta = {
  title: "Patterns/OAuthConsentCard",
  component: OAuthConsentCard,
  tags: ["autodocs"],
  args: {
    clientName: "Claude",
    returnHost: "claude.ai",
    accountEmail: "ada@analytical.example",
    permissions: [
      "Use the app's tools as you, in your workspaces",
      "See your name and email address",
      "Stay connected until you revoke it",
    ],
    revokeHint: "Disconnect it any time in Settings › Connected agents.",
    onDecide: fn(async () => {}),
  },
} satisfies Meta<typeof OAuthConsentCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default request of an MCP client. */
export const Default: Story = {};

/** While the client's name loads, its id stands in. */
export const UnknownClient: Story = {
  args: { clientName: "mcp-client-7f3a", accountEmail: undefined },
};

/** Allow saves the decision and disables both buttons while it runs. */
export const AllowDecides: Story = {
  args: { onDecide: fn(() => new Promise<void>(() => {})) },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Allow" }));
    await expect(args.onDecide).toHaveBeenCalledWith(true);
    await expect(canvas.getByRole("button", { name: "Deny" })).toBeDisabled();
  },
};

/** A failed decision shows its message and lets the user decide again. */
export const DecisionFails: Story = {
  args: {
    onDecide: fn(async () => {
      throw new Error("The authorization request expired. Start again.");
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Deny" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("expired");
    await expect(canvas.getByRole("button", { name: "Allow" })).toBeEnabled();
  },
};
