import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties, ReactNode } from "react";

import { Prose } from "./prose";

/**
 * The markup the docs' Markdown pipeline renders around a table
 * (apps/web/src/docs/markdown-plugins.ts): a named, focusable scroll box.
 */
function TableScroll({ children }: { readonly children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: a scroll box must be reachable by keyboard (axe scrollable-region-focusable); the static docs HTML cannot add the tab stop at runtime.
    <section data-table-scroll="" tabIndex={0} aria-label="Table 1">
      {children}
    </section>
  );
}

/** Shiki's dual-theme output: each token carries both colours as variables. */
const token = (light: string, dark: string): CSSProperties =>
  ({ "--shiki-light": light, "--shiki-dark": dark }) as CSSProperties;

function Guide() {
  return (
    <>
      <h1 id="configure-workspaces">How to configure workspaces</h1>
      <p>
        Data belongs to workspaces, never to users. Two settings decide how
        people are grouped and who may join; choose them per environment before
        the first deploy. The rules behind it are in{" "}
        <a href="/docs/architecture/overview/#tenancy-and-authorization">
          the architecture overview
        </a>
        .
      </p>
      <h2 id="the-settings">The settings</h2>
      <p>
        Set <code>WORKSPACE_MODE</code> and <code>SIGN_UP</code> in{" "}
        <code>apps/web/wrangler.jsonc</code> with the setup script:
      </p>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: Shiki makes code blocks focusable so a long line can be scrolled by keyboard. */}
      <pre className="astro-code" tabIndex={0}>
        <code>
          <span className="line">
            <span style={token("#cf222e", "#ff7b72")}>bun</span>
            <span style={token("#1f2328", "#e6edf3")}>
              {" "}
              run setup:auth --env production
            </span>
            <span style={token("#6e7781", "#8b949e")}>
              {" "}
              # asks, then writes wrangler.jsonc
            </span>
          </span>
        </code>
      </pre>
      <TableScroll>
        <table>
          <thead>
            <tr>
              <th>WORKSPACE_MODE</th>
              <th>Who works together</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>personal</code>
              </td>
              <td>
                Everyone works alone in their own workspace; no members page.
              </td>
            </tr>
            <tr>
              <td>
                <code>single</code>
              </td>
              <td>One team in one workspace.</td>
            </tr>
            <tr>
              <td>
                <code>multi</code>
              </td>
              <td>
                Teams create and join workspaces; the switcher and invitations
                appear.
              </td>
            </tr>
          </tbody>
        </table>
      </TableScroll>
      <h3 id="invitations">Invitations</h3>
      <ul>
        <li>An owner invites by email; the link works once and expires.</li>
        <li>
          Invite-only sign-up accepts a <strong>domain allowlist</strong> and a
          bootstrap admin.
          <ul>
            <li>The first account can always get in.</li>
          </ul>
        </li>
      </ul>
      <ol>
        <li>Run the setup script for every environment.</li>
        <li>Deploy.</li>
      </ol>
      <blockquote>
        <p>A deploy refuses to start until you have chosen.</p>
      </blockquote>
      <hr />
      <p>
        Next:{" "}
        <a href="/docs/guides/how-to-configure-plans-and-billing/">
          plans and billing
        </a>
        .
      </p>
    </>
  );
}

/**
 * Typography for rendered Markdown: headings, lists, links, inline code, Shiki code
 * blocks (both themes from CSS variables) and tables in a keyboard-scrollable box.
 */
const meta = {
  title: "Data display/Prose",
  component: Prose,
  tags: ["autodocs"],
  args: { children: <Guide /> },
  argTypes: { children: { control: false } },
  decorators: [
    (Story) => (
      <div className="max-w-[52rem]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Prose>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** A table wider than the column scrolls inside its own box, reachable by keyboard. */
export const WideTable: Story = {
  args: {
    children: (
      <TableScroll>
        <table>
          <thead>
            <tr>
              <th>Var</th>
              <th>Values</th>
              <th>Effect</th>
              <th>Where it is read</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>WORKSPACE_MODE</code>
              </td>
              <td>
                <code>personal</code>, <code>single</code>, <code>multi</code>
              </td>
              <td>
                How people are grouped; personal hides members and invitations.
              </td>
              <td>
                <code>apps/web/src/lib/env.ts</code> and every workspace
                procedure
              </td>
            </tr>
            <tr>
              <td>
                <code>SIGN_UP</code>
              </td>
              <td>
                <code>open</code>, <code>invite-only</code>
              </td>
              <td>Who may create an account without an invitation.</td>
              <td>The sign-up hook in the auth adapter</td>
            </tr>
          </tbody>
        </table>
      </TableScroll>
    ),
  },
  decorators: [
    (Story) => (
      <div className="w-[360px]">
        <Story />
      </div>
    ),
  ],
};

/**
 * A diagram as the docs pipeline inlines it (apps/web/src/docs/diagrams.ts): the SVG in
 * a named, focusable figure that scrolls when the column is narrower than the diagram.
 */
export const Diagram: Story = {
  args: {
    children: (
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scroll box must be reachable by keyboard (axe scrollable-region-focusable); the static docs HTML cannot add the tab stop at runtime.
      <figure data-docs-diagram="" tabIndex={0} aria-label="Plan, then build">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="600"
          height="96"
          viewBox="0 0 600 96"
          role="img"
          aria-label="Plan, then build"
        >
          <title>Plan, then build</title>
          <rect
            className="fill-surface-raised"
            width="600"
            height="96"
            rx="12"
          />
          {["Plan", "Build"].map((label, i) => (
            <g key={label}>
              <rect
                className="fill-surface stroke-line-strong"
                x={24 + i * 312}
                y="20"
                width="240"
                height="56"
                rx="8"
              />
              <text
                className="fill-fg font-semibold text-sm"
                x={144 + i * 312}
                y="53"
                textAnchor="middle"
              >
                {label}
              </text>
            </g>
          ))}
          <path
            className="stroke-fg-subtle"
            d="M268 48H332"
            strokeWidth="1.5"
          />
        </svg>
      </figure>
    ),
  },
  decorators: [
    (Story) => (
      <div className="w-[360px]">
        <Story />
      </div>
    ),
  ],
};
