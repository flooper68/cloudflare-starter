import type { Meta, StoryObj } from "@storybook/react-vite";
import { Link } from "./link";

/**
 * Inline text links. `default` (accent) in running text, `subtle` where accent is too
 * loud, `muted` for footers. `external` opens a new tab and shows ↗.
 */
const meta = {
  title: "Navigation/Link",
  component: Link,
  tags: ["autodocs"],
  args: {
    children: "cycle settings",
    href: "#settings",
    variant: "default",
    external: false,
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["default", "subtle", "muted"],
    },
  },
} satisfies Meta<typeof Link>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex items-center gap-4 text-sm">
      <Link href="#a">Default</Link>
      <Link href="#b" variant="subtle">
        Subtle
      </Link>
      <Link href="#c" variant="muted">
        Muted
      </Link>
    </div>
  ),
};

export const External: Story = {
  args: {
    children: "Cloudflare docs",
    href: "https://developers.cloudflare.com",
    external: true,
  },
};

export const InText: Story = {
  render: () => (
    <p className="w-96 text-sm text-fg-muted">
      Unfinished issues move to the next cycle automatically. Change this in{" "}
      <Link href="#settings">cycle settings</Link>, or read how{" "}
      <Link href="https://example.com/guides/cycles" external>
        other teams run cycles
      </Link>
      .
    </p>
  ),
};

export const AsChild: Story = {
  render: () => (
    <Link asChild variant="subtle">
      <button type="button">Rendered as a button via asChild</button>
    </Link>
  ),
};
