import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";
import { Separator } from "./separator";
import { Switch } from "./switch";

/** An on/off setting that takes effect immediately. */
const meta = {
  title: "Forms/Switch",
  component: Switch,
  tags: ["autodocs"],
  args: {
    label: "Show sub-issues",
    size: "md",
    disabled: false,
    labelPosition: "after",
  },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md"] },
    labelPosition: { control: "inline-radio", options: ["after", "before"] },
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Switch size="sm" label="Small" defaultChecked />
      <Switch size="md" label="Medium" defaultChecked />
      <div className="flex items-center gap-3">
        <Switch size="sm" aria-label="Small, no label" />
        <Switch aria-label="Medium, no label" />
      </div>
    </div>
  ),
};

export const WithDescription: Story = {
  args: {
    label: "Auto-close stale issues",
    description: "Close issues with no activity for 6 months.",
    defaultChecked: true,
  },
};

export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Switch label="Off" />
      <Switch label="On" defaultChecked />
      <Switch label="Disabled" disabled />
      <Switch label="Disabled, on" disabled defaultChecked />
    </div>
  ),
};

/** Label first and the switch at the far right, like Linear's preferences. */
export const SettingsList: Story = {
  render: () => (
    <Card className="w-[440px]">
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Choose what reaches your inbox.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Switch
          labelPosition="before"
          label="Assigned to me"
          description="When someone assigns you an issue."
          defaultChecked
        />
        <Separator />
        <Switch
          labelPosition="before"
          label="Mentions"
          description="When someone @mentions you in a comment."
          defaultChecked
        />
        <Separator />
        <Switch
          labelPosition="before"
          label="Status changes"
          description="When an issue you created changes status."
        />
        <Separator />
        <Switch
          labelPosition="before"
          label="Weekly digest"
          description="Available on the Business plan."
          disabled
        />
      </CardContent>
    </Card>
  ),
};
