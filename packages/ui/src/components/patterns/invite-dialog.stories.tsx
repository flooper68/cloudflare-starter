import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { InviteDialog } from "./invite-dialog";

/**
 * "Invite people": email and role, checked before sending; the API's refusal (already a
 * member, not allowed) shows inline; a successful send closes the dialog.
 */
const meta = {
  title: "Patterns/InviteDialog",
  component: InviteDialog,
  tags: ["autodocs"],
  args: {
    roles: [
      { value: "owner", label: "Owner" },
      { value: "member", label: "Member" },
    ],
    defaultRole: "member",
    workspaceName: "Acme Robotics",
    onInvite: fn(async () => {}),
  },
  parameters: {
    docs: { story: { inline: false, iframeHeight: 420 } },
  },
} satisfies Meta<typeof InviteDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Rendered open, for the docs page. */
export const Open: Story = { args: { defaultOpen: true } };

/** A malformed address is refused before sending; a valid one is sent with the role. */
export const SendInvitation: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: "Invite people" })
    );
    const dialog = await page.findByRole("dialog", { name: "Invite people" });
    const email = within(dialog).getByLabelText("Email");

    await userEvent.type(email, "grace");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Send invitation" })
    );
    await expect(
      await within(dialog).findByText(/Enter an email address/)
    ).toBeVisible();
    await expect(args.onInvite).not.toHaveBeenCalled();

    await userEvent.type(email, "@acme.test");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Send invitation" })
    );
    await expect(args.onInvite).toHaveBeenCalledWith({
      email: "grace@acme.test",
      role: "member",
    });
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
  },
};

/** The API refuses: the message stays in the dialog so the user can fix it. */
export const ApiError: Story = {
  args: {
    onInvite: fn(async () => {
      throw new Error("That person is already a member");
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: "Invite people" })
    );
    const dialog = await page.findByRole("dialog", { name: "Invite people" });
    await userEvent.type(
      within(dialog).getByLabelText("Email"),
      "ada@acme.test"
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Send invitation" })
    );
    await expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "That person is already a member"
    );
  },
};
