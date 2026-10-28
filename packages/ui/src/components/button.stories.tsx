import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRight, Plus, Settings, Star, Trash2 } from "lucide-react";
import { Button, IconButton } from "./button";
import { Shortcut } from "./kbd";

/**
 * Buttons trigger actions. Use one `primary` per view for the main action, `secondary`
 * for everyday actions, `ghost` in toolbars and menus, `danger` only to confirm
 * something destructive.
 */
const meta = {
  title: "Actions/Button",
  component: Button,
  tags: ["autodocs"],
  args: {
    children: "Create issue",
    variant: "primary",
    size: "md",
    disabled: false,
    loading: false,
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "ghost", "danger", "link"],
    },
    size: { control: "inline-radio", options: ["xs", "sm", "md", "lg"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Delete</Button>
      <Button variant="link">Learn more</Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="xs">Extra small</Button>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary" icon={<Plus />}>
        New issue
      </Button>
      <Button trailing={<ArrowRight />}>Continue</Button>
      <Button
        variant="ghost"
        icon={<Star />}
        trailing={<Shortcut keys={["F"]} />}
      >
        Favorite
      </Button>
      <Button variant="danger" icon={<Trash2 />}>
        Delete project
      </Button>
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary" loading>
        Saving
      </Button>
      <Button loading>Syncing</Button>
      <Button variant="primary" disabled>
        Disabled
      </Button>
      <Button disabled>Disabled</Button>
    </div>
  ),
};

export const IconButtons: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <IconButton label="Settings" size="sm">
        <Settings />
      </IconButton>
      <IconButton label="Settings">
        <Settings />
      </IconButton>
      <IconButton label="Add" variant="secondary">
        <Plus />
      </IconButton>
      <IconButton label="Add" variant="primary">
        <Plus />
      </IconButton>
    </div>
  ),
};

export const AsLink: Story = {
  render: () => (
    <Button asChild variant="secondary">
      <a href="#docs">Open documentation</a>
    </Button>
  ),
};
