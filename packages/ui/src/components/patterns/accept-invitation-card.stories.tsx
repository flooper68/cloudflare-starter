import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { AcceptInvitationCard } from "./accept-invitation-card";

/**
 * The card on the invitation page (`/invite/<token>`): the workspace and who invited you,
 * then the one next step for your situation.
 */
const meta = {
  title: "Patterns/AcceptInvitationCard",
  component: AcceptInvitationCard,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    state: "valid",
    workspaceName: "Acme Robotics",
    inviterName: "Ada Lovelace",
    invitedEmail: "grace@acme.test",
    role: "member",
    currentEmail: "grace@acme.test",
    onAccept: fn(async () => {}),
    onSignOut: fn(),
    signInHref: "/sign-in?next=/invite/abc",
    signUpHref: "/sign-up?next=/invite/abc",
  },
  argTypes: {
    state: {
      control: "inline-radio",
      options: [
        "valid",
        "signed-out",
        "wrong-account",
        "expired",
        "invalid",
        "accepted",
      ],
    },
  },
} satisfies Meta<typeof AcceptInvitationCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Signed in with the invited address: one click joins. */
export const Valid: Story = {};

/** Not signed in: create an account or sign in with the invited address. */
export const SignedOut: Story = { args: { state: "signed-out" } };

/** Signed in as someone else. */
export const WrongAccount: Story = {
  args: { state: "wrong-account", currentEmail: "alan@acme.test" },
};

export const Expired: Story = { args: { state: "expired" } };

/** Unknown, revoked or already used. */
export const Invalid: Story = { args: { state: "invalid" } };

export const Accepted: Story = { args: { state: "accepted" } };

/** "Accept and join" calls onAccept. */
export const AcceptInvitation: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Accept and join" })
    );
    await expect(args.onAccept).toHaveBeenCalledOnce();
  },
};

/** A failed accept shows why and keeps the button. */
export const AcceptFails: Story = {
  args: {
    onAccept: fn(async () => {
      throw new Error("This invitation has expired");
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Accept and join" })
    );
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "This invitation has expired"
    );
    await expect(
      canvas.getByRole("button", { name: "Accept and join" })
    ).toBeEnabled();
  },
};

/** Wrong account: "Sign out" calls onSignOut. */
export const SwitchAccount: Story = {
  args: { state: "wrong-account", currentEmail: "alan@acme.test" },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Sign out" })
    );
    await expect(args.onSignOut).toHaveBeenCalledOnce();
  },
};
