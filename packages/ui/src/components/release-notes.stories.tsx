import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { type ReleaseEntry, ReleaseNotes } from "./release-notes";

const releases: ReleaseEntry[] = [
  {
    id: "unreleased",
    version: "Unreleased",
    href: "https://github.com/flooper68/cloudflare-starter/compare/v0.2.0...HEAD",
    groups: [
      {
        type: "Added",
        items: [
          <>
            <strong>Notes.</strong> A placeholder app with rich text, sharing
            and an MCP tool, at <code>/app/notes</code>.
          </>,
        ],
      },
    ],
  },
  {
    id: "v0-2-0",
    version: "0.2.0",
    date: "2026-12-01",
    href: "https://github.com/flooper68/cloudflare-starter/compare/v0.1.0...v0.2.0",
    summary: "Sharper admin tools and a faster docs search.",
    groups: [
      {
        type: "Added",
        items: [
          "Admins can export the audit log as CSV.",
          <>
            A{" "}
            <a href="/docs/guides/how-to-monitor-health/">status page guide</a>{" "}
            for the health endpoints.
          </>,
        ],
      },
      {
        type: "Changed",
        items: ["The docs search loads its index only when the dialog opens."],
      },
      {
        type: "Deprecated",
        items: [
          <>
            <code>BILLING=manual</code> will be renamed in 0.3.0.
          </>,
        ],
      },
      { type: "Removed", items: ["The Container demo's old health route."] },
      {
        type: "Fixed",
        items: ["Invitations to an address in another case are accepted."],
      },
      {
        type: "Security",
        items: ["Password reset links expire after one hour instead of a day."],
      },
    ],
  },
  {
    id: "v0-1-0",
    version: "0.1.0",
    date: "2026-11-08",
    href: "https://github.com/flooper68/cloudflare-starter/releases/tag/v0.1.0",
    summary: "The first release.",
    groups: [
      {
        type: "Added",
        items: [
          "Sign-in with email and password or Google.",
          "Workspaces, invitations and roles.",
        ],
      },
    ],
  },
];

/**
 * Release notes rendered from a Keep a Changelog file: one section per release with its
 * version and date, and the changes grouped by type, each type with its own tone.
 */
const meta = {
  title: "Data display/ReleaseNotes",
  component: ReleaseNotes,
  tags: ["autodocs"],
  args: { releases },
  argTypes: { releases: { control: false } },
  decorators: [
    (Story) => (
      <div className="max-w-[52rem]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ReleaseNotes>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Every change type has its label; versions are headings, dates are machine-readable. */
export const ChangeTypes: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const type of [
      "Added",
      "Changed",
      "Deprecated",
      "Removed",
      "Fixed",
      "Security",
    ])
      await expect(canvas.getAllByText(type).length).toBeGreaterThan(0);
    await expect(
      canvas.getByRole("heading", { level: 2, name: "0.2.0" })
    ).toBeInTheDocument();
    await expect(canvas.getByText("December 1, 2026")).toHaveAttribute(
      "datetime",
      "2026-12-01"
    );
    await expect(canvas.getByText("In progress")).toBeInTheDocument();
  },
};

/** Right after a release: Unreleased has no entries yet. */
export const NothingUnreleased: Story = {
  args: {
    releases: [
      { id: "unreleased", version: "Unreleased", groups: [] },
      releases[2],
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Nothing yet.")
    ).toBeInTheDocument();
  },
};

/** At phone width the version and date stack above the changes. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[360px]">
        <Story />
      </div>
    ),
  ],
};
