import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { DocsNav, type DocsNavSection } from "./docs-nav";

const sections: DocsNavSection[] = [
  {
    title: "Start",
    items: [
      { label: "Overview", href: "/docs/" },
      { label: "Start a project", href: "/docs/start/" },
    ],
  },
  {
    title: "Guides",
    items: [
      {
        label: "Set up authentication (Better Auth)",
        href: "/docs/guides/how-to-setup-auth/",
      },
      {
        label: "Set up the D1 database",
        href: "/docs/guides/how-to-setup-d1/",
      },
      {
        label: "Configure workspaces, sign-up and roles",
        href: "/docs/guides/how-to-configure-workspaces/",
      },
      {
        label: "Configure plans and billing",
        href: "/docs/guides/how-to-configure-plans-and-billing/",
      },
      {
        label: "Account security",
        href: "/docs/guides/how-to-configure-account-security/",
      },
    ],
  },
  {
    title: "Architecture",
    items: [
      { label: "Architecture Overview", href: "/docs/architecture/overview/" },
      { label: "Testing Strategy", href: "/docs/architecture/testing/" },
      { label: "Performance", href: "/docs/architecture/performance/" },
    ],
  },
];

/**
 * The sidebar of the docs site: titled sections of page links with the current page
 * marked `aria-current="page"`. Plain links, no JavaScript.
 */
const meta = {
  title: "Navigation/DocsNav",
  component: DocsNav,
  tags: ["autodocs"],
  args: {
    sections,
    currentHref: "/docs/guides/how-to-configure-workspaces/",
  },
  decorators: [
    (Story) => (
      <div className="w-62">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DocsNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The current page is highlighted and announced as the current page. */
export const CurrentPage: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const current = canvas.getByRole("link", {
      name: "Configure workspaces, sign-up and roles",
    });
    await expect(current).toHaveAttribute("aria-current", "page");
    await expect(
      canvas.getByRole("list", { name: "Guides" })
    ).toBeInTheDocument();
  },
};

/** No page of the navigation is open (the docs 404). */
export const NothingCurrent: Story = { args: { currentHref: undefined } };

/** In the docs layout: a bordered sidebar next to the page. */
export const InSidebar: Story = {
  decorators: [
    (Story) => (
      <div className="flex h-[520px] w-[720px] overflow-hidden rounded-lg border border-line bg-canvas">
        <aside className="w-62 shrink-0 border-r border-line px-4 py-6">
          <Story />
        </aside>
        <div className="flex-1 p-8 text-sm text-fg-muted">Page content</div>
      </div>
    ),
  ],
};
