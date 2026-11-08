import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { ConnectedAgents, ConnectedAgentsSkeleton } from "./connected-agents";

const claude = {
  clientId: "claude-desktop",
  name: "Claude",
  host: "claude.ai",
  connectedAt: "2026-11-03T09:12:00Z",
  permissions: [
    "Use the app's tools as you, in your workspaces",
    "See your name and profile picture",
    "See your email address",
    "Stay connected until you revoke it",
  ],
  session: { device: "Chrome on macOS", current: true },
};
const claudeCode = {
  clientId: "claude-code",
  name: "Claude Code",
  host: "localhost:33418",
  connectedAt: "2026-11-06T17:40:00Z",
  permissions: ["Use the app's tools as you, in your workspaces"],
  session: null,
};

const meta = {
  title: "Patterns/Security/ConnectedAgents",
  component: ConnectedAgents,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    status: "success",
    items: [claude, claudeCode],
    onDisconnect: fn(async () => {}),
    onRetry: fn(),
    docsHref: "/docs/guides/how-to-setup-mcp/",
    formatDate: (date: Date) =>
      new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(date),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConnectedAgents>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Two agents: one approved in this browser, one whose approving session is unknown. */
export const List: Story = {};

export const Empty: Story = {
  args: { items: [] },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("No agents connected")).toBeVisible();
    await expect(
      c.getByRole("link", { name: "How to connect an agent" })
    ).toHaveAttribute("href", "/docs/guides/how-to-setup-mcp/");
  },
};

export const Loading: Story = { args: { status: "pending", items: undefined } };

/** The skeleton on its own, as other pages can show it. */
export const Skeleton: Story = { render: () => <ConnectedAgentsSkeleton /> };

export const LoadError: Story = {
  args: {
    status: "error",
    items: undefined,
    error: new Error("The connected agents could not be loaded."),
  },
  play: async ({ args, canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: /try again/i }));
    await expect(args.onRetry).toHaveBeenCalled();
  },
};

/** The confirmation, open: nothing happens until the person confirms. */
export const ConfirmDialogOpen: Story = {
  play: async ({ args, canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "Disconnect Claude" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "Disconnect Claude?",
    });
    await expect(dialog).toHaveTextContent("must ask you again");
    await expect(args.onDisconnect).not.toHaveBeenCalled();
  },
};

export const CancelKeepsTheAgent: Story = {
  play: async ({ args, canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(
      c.getByRole("button", { name: "Disconnect Claude Code" })
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Cancel" })
    );
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    );
    await expect(args.onDisconnect).not.toHaveBeenCalled();
  },
};

export const ConfirmDisconnects: Story = {
  play: async ({ args, canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "Disconnect Claude" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Disconnect" })
    );
    await expect(args.onDisconnect).toHaveBeenCalledWith("claude-desktop");
  },
};

/** An agent without a registered name falls back to a neutral label. */
export const UnnamedAgent: Story = {
  args: {
    items: [{ ...claudeCode, clientId: "anon", name: null, host: null }],
  },
};
