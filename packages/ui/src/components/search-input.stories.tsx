import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { StatusIcon } from "./issue-icons";
import { SearchInput } from "./search-input";

/**
 * A search field with a clear button and an optional focus shortcut (`/` or ⌘K) shown as a
 * hint while empty. Escape clears, then leaves the field.
 */
const meta = {
  title: "Forms/SearchInput",
  component: SearchInput,
  tags: ["autodocs"],
  args: {
    placeholder: "Search issues…",
    size: "md",
    disabled: false,
    "aria-label": "Search issues",
    className: "w-72",
  },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    shortcut: { control: "inline-radio", options: [undefined, "/", "mod+k"] },
  },
} satisfies Meta<typeof SearchInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Press "/" anywhere on the page to focus the field. */
export const SlashShortcut: Story = {
  args: { shortcut: "/" },
};

/** Press ⌘K (Ctrl+K) to focus the field. */
export const CommandKShortcut: Story = {
  args: { shortcut: "mod+k", placeholder: "Search or jump to…" },
};

export const WithValue: Story = {
  args: { defaultValue: "people picker" },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <SearchInput {...args} size="sm" />
      <SearchInput {...args} size="md" />
      <SearchInput {...args} size="lg" />
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
};

const issues = [
  {
    id: "ENG-2148",
    title: "Slow people picker in large workspaces",
    status: "in_progress",
  },
  {
    id: "ENG-2131",
    title: "Sync conflicts when editing offline",
    status: "todo",
  },
  {
    id: "DES-412",
    title: "New empty state for the inbox",
    status: "in_review",
  },
  {
    id: "ENG-2090",
    title: "Rate limit the public API per token",
    status: "done",
  },
  {
    id: "MOB-77",
    title: "Push notifications open the wrong issue",
    status: "backlog",
  },
] as const;

/** Filtering a list as you type; "No results" when nothing matches. */
export const FilteringAList: Story = {
  render: function Render() {
    const [query, setQuery] = useState("");
    const needle = query.trim().toLowerCase();
    const matches = issues.filter(
      (issue) =>
        issue.title.toLowerCase().includes(needle) ||
        issue.id.toLowerCase().includes(needle)
    );
    return (
      <div className="flex w-[420px] flex-col gap-2">
        <SearchInput
          value={query}
          onValueChange={setQuery}
          shortcut="/"
          placeholder="Filter issues…"
          aria-label="Filter issues"
        />
        <ul className="flex flex-col rounded-lg border border-line bg-surface-raised p-1">
          {matches.map((issue) => (
            <li
              key={issue.id}
              className="flex h-8 items-center gap-2 rounded-md px-2 text-sm hover:bg-hover"
            >
              <StatusIcon status={issue.status} label="" />
              <span className="w-16 shrink-0 text-fg-subtle text-xs">
                {issue.id}
              </span>
              <span className="truncate text-fg">{issue.title}</span>
            </li>
          ))}
          {matches.length === 0 ? (
            <li className="px-2 py-6 text-center text-fg-subtle text-sm">
              No issues match "{query}"
            </li>
          ) : null}
        </ul>
      </div>
    );
  },
};
