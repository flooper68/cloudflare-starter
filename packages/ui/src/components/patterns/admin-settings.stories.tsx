import type { Meta, StoryObj } from "@storybook/react-vite";
import { Settings } from "lucide-react";
import { expect, within } from "storybook/test";

import { DataState } from "../data-state";
import { EmptyState } from "../empty-state";
import { SkeletonText } from "../skeleton";
import { AdminSettings, type AdminSettingsData } from "./admin-settings";

const settings: AdminSettingsData = {
  environment: "production",
  workspaceMode: "multi",
  signUp: "invite",
  signUpDomains: ["acme.test", "acme-robotics.test"],
  bootstrapAdminEmail: "founder@acme.test",
  signInMethods: ["email_password", "google"],
  emailVerificationRequired: true,
  emailEnabled: true,
  adminPortal: "on",
};

/** The deployment's settings, read-only, with a link to Cloudflare Queues for jobs. */
const meta = {
  title: "Patterns/Admin/Settings",
  component: AdminSettings,
  tags: ["autodocs"],
  args: {
    settings,
    queuesDashboardUrl:
      "https://dash.cloudflare.com/?to=/:account/workers/queues",
  },
  render: (args) => (
    <div className="w-[760px]">
      <AdminSettings {...args} />
    </div>
  ),
} satisfies Meta<typeof AdminSettings>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Production: invite-only, two sign-in methods. */
export const Content: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Invitation only")).toBeVisible();
    await expect(canvas.getByText("Email + password, Google")).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: /Open Queues/ })
    ).toBeVisible();
  },
};

/** Local development: open sign-up, personal mode, no email, no dashboard link. */
export const Local: Story = {
  args: {
    settings: {
      ...settings,
      environment: "local",
      workspaceMode: "personal",
      signUp: "open",
      signUpDomains: [],
      bootstrapAdminEmail: null,
      signInMethods: ["email_password"],
      emailVerificationRequired: false,
      emailEnabled: false,
    },
    queuesDashboardUrl: undefined,
  },
};

function Page({ status }: { readonly status: "pending" | "error" }) {
  return (
    <div className="w-[760px]">
      <DataState
        status={status}
        data={undefined as AdminSettingsData | undefined}
        error={new Error("The server didn't answer. Check your connection.")}
        onRetry={() => {}}
        loading={<SkeletonText lines={8} />}
        empty={<EmptyState icon={<Settings />} title="No settings" />}
      >
        {(value) => <AdminSettings settings={value} />}
      </DataState>
    </div>
  );
}

/** Loading. */
export const Loading: Story = { render: () => <Page status="pending" /> };
/** Failed to load. */
export const Failed: Story = { render: () => <Page status="error" /> };
