import type { Meta, StoryObj } from "@storybook/react-vite";

import { Kbd, Shortcut } from "./kbd";
import { Separator } from "./separator";
import { Spinner } from "./spinner";
import { Heading, Text } from "./typography";

/** Small building blocks: keys, separators, spinner, headings and text. */
const meta = {
  title: "Foundations/Primitives",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Keys: Story = {
  render: () => (
    <div className="flex flex-col gap-3 text-sm text-fg-muted">
      <span className="flex items-center gap-2">
        Command menu <Shortcut keys={["⌘", "K"]} />
      </span>
      <span className="flex items-center gap-2">
        Create issue <Kbd>C</Kbd>
      </span>
      <span className="flex items-center gap-2">
        Go to inbox <Kbd>G</Kbd> then <Kbd>I</Kbd>
      </span>
    </div>
  ),
};

export const Spinners: Story = {
  render: () => (
    <div className="flex items-center gap-4 text-fg-muted">
      <Spinner className="size-3" />
      <Spinner />
      <Spinner className="size-6 text-accent" label="Loading issues" />
    </div>
  ),
};

export const Separators: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-3">
      <Text>Above</Text>
      <Separator />
      <div className="flex h-5 items-center gap-3 text-sm text-fg-muted">
        Issues <Separator orientation="vertical" /> Projects{" "}
        <Separator orientation="vertical" /> Views
      </div>
    </div>
  ),
};

export const HeadingsAndText: Story = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-3">
      <Heading level={1}>Engineering</Heading>
      <Heading level={2}>Current cycle</Heading>
      <Heading level={3}>Billing migration</Heading>
      <Heading level={4}>Acceptance criteria</Heading>
      <Text>Body text in the default tone.</Text>
      <Text tone="muted">Muted text for secondary information.</Text>
      <Text tone="subtle" size="xs">
        Subtle metadata · updated 2h ago
      </Text>
      <Text tone="danger" size="xs">
        Something went wrong.
      </Text>
    </div>
  ),
};
