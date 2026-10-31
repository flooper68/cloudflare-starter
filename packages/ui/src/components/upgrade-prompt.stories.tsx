import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { Button } from "./button";
import { Card, CardDescription, CardTitle } from "./card";
import { UpgradePrompt } from "./upgrade-prompt";

const storageLimit = {
  kind: "limit",
  subject: "storage",
  limit: "100 MB",
} as const;

const options = [
  { id: "plan:pro", label: "Upgrade to Pro" },
  { id: "addon:extra_storage", label: "Add Extra 10 GB" },
];

/**
 * Tells someone their plan stops them, and what to do: upgrade (BILLING=provider, for
 * owners), ask an owner, or contact the admin (BILLING=manual). Renders nothing with
 * BILLING=off. Callout next to what was refused, banner for trials in the app shell,
 * dialog after a refused action.
 */
const meta = {
  title: "Feedback/UpgradePrompt",
  component: UpgradePrompt,
  tags: ["autodocs"],
  args: {
    reason: storageLimit,
    mode: "provider",
    canUpgrade: true,
    options,
    onUpgrade: fn(async () => {}),
  },
  argTypes: {
    mode: { control: "inline-radio", options: ["off", "manual", "provider"] },
    variant: {
      control: "inline-radio",
      options: ["callout", "banner", "dialog"],
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[36rem]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UpgradePrompt>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** A limit reached, for an owner with online checkout: the first option is primary. */
export const LimitReachedUpgrade: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("You've reached the storage limit")
    ).toBeVisible();
    await expect(
      canvas.getByText(/uses all 100 MB of storage its plan includes/)
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Upgrade to Pro" })
    );
    await waitFor(() =>
      expect(args.onUpgrade).toHaveBeenCalledWith(options[0])
    );
  },
};

/** A feature the plan does not include. */
export const FeatureNotIncluded: Story = {
  args: {
    reason: { kind: "feature", feature: "Direct uploads" },
    options: [
      { id: "plan:pro", label: "Upgrade to Pro" },
      { id: "addon:direct_uploads", label: "Add Direct uploads" },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(
        "Direct uploads is not included in your plan"
      )
    ).toBeVisible();
  },
};

/** Provider mode, but a member: no buttons, ask an owner. */
export const MemberAsksOwner: Story = {
  args: { canUpgrade: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(/Ask a workspace owner to upgrade/)
    ).toBeVisible();
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

/** Manual billing: nothing to buy, contact the admin. */
export const ManualContactAdmin: Story = {
  args: { mode: "manual" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Contact your admin/)).toBeVisible();
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

/** BILLING=off: renders nothing. */
export const BillingOff: Story = {
  args: { mode: "off" },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.textContent).toBe("");
  },
};

/** Trial ending: the app shell's banner, dismissible. */
export const TrialEndingBanner: Story = {
  args: {
    variant: "banner",
    reason: { kind: "trial-ending", planName: "Pro", daysLeft: 3 },
    options: [{ id: "plan:pro", label: "Choose a plan" }],
    onDismiss: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("Your Pro trial ends in 3 days")
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Dismiss" }));
    await expect(args.onDismiss).toHaveBeenCalled();
  },
};

/** Trial ends today, manual billing. */
export const TrialEndsTodayManual: Story = {
  args: {
    variant: "banner",
    mode: "manual",
    reason: { kind: "trial-ending", planName: "Pro", daysLeft: 0 },
  },
};

/** Trial ended: the workspace is on its fallback plan. */
export const TrialEnded: Story = {
  args: {
    variant: "banner",
    reason: { kind: "trial-ended", planName: "Free" },
    options: [{ id: "plan:pro", label: "Upgrade to Pro" }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Your trial has ended")).toBeVisible();
    await expect(canvas.getByText(/now on the Free plan/)).toBeVisible();
  },
};

/** While the checkout opens, the chosen button spins and the others wait. */
export const UpgradeInProgress: Story = {
  args: {
    onUpgrade: fn(() => new Promise<void>(() => {})),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Upgrade to Pro" })
    );
    await expect(
      canvas.getByRole("button", { name: "Upgrade to Pro" })
    ).toHaveAttribute("aria-busy", "true");
    await expect(
      canvas.getByRole("button", { name: "Add Extra 10 GB" })
    ).toBeDisabled();
  },
};

/** The dialog after an action was refused: seats, for an owner. */
export const SeatsDialog: Story = {
  args: {
    variant: "dialog",
    open: true,
    reason: { kind: "limit", subject: "seats", limit: "3" },
    options: [
      { id: "plan:pro", label: "Upgrade to Pro" },
      { id: "addon:extra_seats", label: "Add 5 more seats" },
    ],
  },
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const dialog = await page.findByRole("dialog", {
      name: "You've reached the seats limit",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add 5 more seats" })
    );
    await waitFor(() =>
      expect(args.onUpgrade).toHaveBeenCalledWith({
        id: "addon:extra_seats",
        label: "Add 5 more seats",
      })
    );
  },
};

function ManualDialog() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Invite people</Button>
      <UpgradePrompt
        variant="dialog"
        mode="manual"
        reason={{ kind: "limit", subject: "seats", limit: "3" }}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

/** The dialog in manual mode: only "OK", which closes it. */
export const ManualDialogCloses: Story = {
  render: () => <ManualDialog />,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const dialog = await page.findByRole("dialog", {
      name: "You've reached the seats limit",
    });
    await waitFor(() =>
      expect(within(dialog).getByText(/Contact your admin/)).toBeVisible()
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "OK" }));
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
  },
};

/** In context: next to the upload that was refused, with a link to the billing page. */
export const InUploadCard: Story = {
  args: { mode: "manual" },
  render: (args) => (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <CardTitle>Through the Worker (binding)</CardTitle>
        <CardDescription>
          POST to /api/files; the Worker writes to the FILES binding.
        </CardDescription>
      </div>
      <UpgradePrompt
        {...args}
        extraActions={
          <Button size="xs" variant="ghost">
            View plan and usage
          </Button>
        }
      />
    </Card>
  ),
};
