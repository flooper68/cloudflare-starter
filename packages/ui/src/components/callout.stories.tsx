import type { Meta, StoryObj } from "@storybook/react-vite";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";
import { Banner, Callout } from "./callout";
import { Card, CardDescription, CardHeader, CardTitle } from "./card";

/**
 * Persistent messages. `Callout` is a box inside content (an explanation, a warning
 * before a risky setting); `Banner` is a full-width strip at the top of a page or panel
 * (a trial ending, a failed sync). Tones: info, success, warning, danger, neutral. Both
 * take a title, a description, actions and `onDismiss`.
 */
const meta = {
  title: "Feedback/Banner",
  component: Callout,
  tags: ["autodocs"],
  args: {
    tone: "info",
    title: "Cycles start on Monday",
    description:
      "Issues not finished by Sunday move to the next cycle automatically.",
  },
  argTypes: {
    tone: {
      control: "inline-radio",
      options: ["info", "success", "warning", "danger", "neutral"],
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[32rem]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Callout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Tones: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Callout tone="info" title="Cycles start on Monday" />
      <Callout tone="success" title="GitHub connected">
        Pull requests now link to issues by branch name.
      </Callout>
      <Callout tone="warning" title="3 issues have no estimate">
        The cycle’s scope can’t be calculated until every issue is estimated.
      </Callout>
      <Callout tone="danger" title="Sync failed">
        We couldn’t reach Jira. Imported issues may be out of date.
      </Callout>
      <Callout tone="neutral" title="Keyboard first">
        Press ? to see every shortcut.
      </Callout>
    </div>
  ),
};

export const DescriptionOnly: Story = {
  args: { title: undefined, icon: false },
};

export const WithActions: Story = {
  args: {
    tone: "warning",
    title: "Your GitHub token expires in 3 days",
    description: "Reconnect to keep pull requests linked to issues.",
    actions: (
      <>
        <Button size="xs" icon={<RefreshCw />}>
          Reconnect
        </Button>
        <Button size="xs" variant="ghost">
          Remind me later
        </Button>
      </>
    ),
  },
};

export const Dismissible: Story = {
  render: function Render(args) {
    const [visible, setVisible] = useState(true);
    return visible ? (
      <Callout {...args} onDismiss={() => setVisible(false)} />
    ) : (
      <Button size="sm" onClick={() => setVisible(true)}>
        Show again
      </Button>
    );
  },
};

export const Banners: Story = {
  decorators: [
    (Story) => (
      <div className="w-[48rem]">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div className="flex flex-col gap-3">
      <Banner
        tone="info"
        title="Your trial ends in 5 days."
        description="Upgrade to keep unlimited issues and cycles."
        actions={
          <Button size="xs" variant="primary">
            Upgrade
          </Button>
        }
        onDismiss={() => {}}
      />
      <Banner
        tone="danger"
        description="Slack notifications are failing. Reconnect Slack in Settings."
      />
      <Banner
        tone="neutral"
        description="Scheduled maintenance on Sunday, 02:00–02:30 UTC."
      />
    </div>
  ),
};

/** A Callout inside a settings card, warning before a risky option. */
export const InContext: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Public issue submission</CardTitle>
        <CardDescription>
          Anyone with the link can file issues into the Triage queue.
        </CardDescription>
      </CardHeader>
      <Callout
        className="mt-4"
        tone="warning"
        title="Spam protection is off"
        description="Turn on Turnstile before sharing the link publicly."
      />
    </Card>
  ),
};
