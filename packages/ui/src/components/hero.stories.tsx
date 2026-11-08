import type { Meta, StoryObj } from "@storybook/react-vite";
import { BookOpen, GitBranch, Layers } from "lucide-react";
import { expect, within } from "storybook/test";

import { Badge } from "./badge";
import { buttonVariants } from "./button";
import { Card } from "./card";
import { Hero } from "./hero";

const actions = (
  <>
    <a
      href="/docs/"
      className={buttonVariants({ variant: "primary", size: "lg" })}
    >
      <BookOpen />
      Read the docs
    </a>
    <a
      href="https://github.com/flooper68/cloudflare-starter"
      className={buttonVariants({ variant: "secondary", size: "lg" })}
    >
      <GitBranch />
      View on GitHub
    </a>
    <a
      href="/_storybook/"
      className={buttonVariants({ variant: "ghost", size: "lg" })}
    >
      <Layers />
      Open Storybook
    </a>
  </>
);

const commands = (
  <pre className="overflow-x-auto rounded-lg border border-line bg-surface p-3.5 font-mono text-xs leading-5 text-fg">
    {`git clone https://github.com/flooper68/cloudflare-starter my-product
cd my-product && bun install
bun run dev:web`}
  </pre>
);

/**
 * The opening section of a public page: badges, the one `h1`, a paragraph, the main
 * actions, an optional block under them and a visual beside them (stacked on phones).
 */
const meta = {
  title: "Patterns/Hero",
  component: Hero,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    eyebrow: (
      <>
        <Badge>Template</Badge>
        <Badge tone="accent">Bun monorepo</Badge>
      </>
    ),
    title: "The Cloudflare-first SaaS starter",
    description:
      "One Astro Worker for the site, the app, the API, queues and cron. Auth, workspaces, billing, admin, notifications and an MCP server, built, tested and documented.",
    actions,
    footer: commands,
  },
  argTypes: {
    eyebrow: { control: false },
    actions: { control: false },
    footer: { control: false },
    aside: { control: false },
  },
} satisfies Meta<typeof Hero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** With a visual beside the text, as on the landing page. */
export const WithAside: Story = {
  args: {
    aside: (
      <Card className="flex h-72 items-center justify-center text-sm text-fg-muted">
        Product preview
      </Card>
    ),
  },
};

/** Only the title and one action. */
export const Minimal: Story = {
  args: {
    eyebrow: undefined,
    description: undefined,
    footer: undefined,
    actions: (
      <a href="/docs/" className={buttonVariants({ variant: "primary" })}>
        Read the docs
      </a>
    ),
  },
};

/** The title is the page's only level-1 heading; the actions are links. */
export const Structure: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    await expect(
      canvas.getByRole("link", { name: "Read the docs" })
    ).toHaveAttribute("href", "/docs/");
  },
};
