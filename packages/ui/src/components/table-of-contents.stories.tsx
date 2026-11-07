import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { TableOfContents, type TocHeading } from "./table-of-contents";

const headings: TocHeading[] = [
  {
    depth: 1,
    slug: "configure-workspaces",
    text: "How to configure workspaces",
  },
  { depth: 2, slug: "the-settings", text: "The settings" },
  { depth: 3, slug: "workspace_mode", text: "WORKSPACE_MODE" },
  { depth: 3, slug: "sign_up", text: "SIGN_UP" },
  { depth: 2, slug: "invitations", text: "Invitations" },
  { depth: 2, slug: "roles-and-permissions", text: "Roles and permissions" },
  { depth: 4, slug: "deep-detail", text: "A detail too deep to list" },
  { depth: 2, slug: "mcp-tools", text: "MCP tools" },
];

/**
 * "On this page": the second- and third-level headings of a docs page as links to their
 * ids. The page title (level 1) and anything deeper than level 3 are left out.
 */
const meta = {
  title: "Navigation/TableOfContents",
  component: TableOfContents,
  tags: ["autodocs"],
  args: { headings },
  decorators: [
    (Story) => (
      <div className="w-52">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TableOfContents>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Only levels 2 and 3 are listed, each a link to the heading's fragment. */
export const ListsSectionsOnly: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByRole("navigation", { name: "On this page" });
    const links = within(nav).getAllByRole("link");
    await expect(links).toHaveLength(6);
    await expect(
      canvas.getByRole("link", { name: "Invitations" })
    ).toHaveAttribute("href", "#invitations");
    await expect(
      canvas.queryByRole("link", { name: "A detail too deep to list" })
    ).toBeNull();
  },
};

/** A short page without sections renders nothing. */
export const NoSections: Story = {
  args: {
    headings: [{ depth: 1, slug: "performance", text: "Performance" }],
  },
};
