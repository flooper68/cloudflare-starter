import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  BookOpen,
  Building2,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  NotebookPen,
  Plus,
  Settings,
  SquareKanban,
  SunMoon,
  UserPlus,
} from "lucide-react";
import { useRef, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { CommandPaletteTrigger } from "../command-palette";
import {
  AppCommandPalette,
  type AppCommandPaletteProps,
  type PaletteCommand,
  type PaletteGroup,
  type PaletteSearchGroup,
} from "./app-command-palette";

/**
 * The app shell's search-and-jump palette (⌘K / Ctrl+K, or the Search button in the top
 * bar). Groups in a fixed order: **Navigate** (every page the user may open), async
 * **search groups** such as Notes (debounced server search with loading, error and
 * no-match states), **Workspaces** (multi mode) and **Actions**. Command groups filter as
 * you type; search groups show what their provider found. Full screen on phones, with a
 * Cancel button. The app builds the groups (permissions, routes); this renders them.
 */
const meta = {
  title: "Patterns/AppCommandPalette",
  component: AppCommandPalette,
  tags: ["autodocs"],
  parameters: { docs: { story: { inline: false, iframeHeight: 640 } } },
  args: {
    open: true,
    onOpenChange: fn(),
    query: "",
    onQueryChange: fn(),
    groups: [],
  },
} satisfies Meta<typeof AppCommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

const go = fn();

const navigate: PaletteCommand[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard /> },
  { id: "notes", label: "Notes", icon: <NotebookPen /> },
  { id: "tasks", label: "Tasks", icon: <SquareKanban /> },
  { id: "billing", label: "Billing", icon: <CreditCard /> },
  {
    id: "settings-account",
    label: "Settings: Account",
    icon: <Settings />,
    keywords: ["profile", "name", "email"],
  },
  {
    id: "settings-security",
    label: "Settings: Security",
    icon: <Settings />,
    keywords: ["password", "passkey", "two-factor"],
  },
].map((command) => ({ ...command, onSelect: () => go(command.id) }));

const workspaces: PaletteCommand[] = [
  { id: "ws-lab", label: "Switch to Analytical Engines", icon: <Building2 /> },
].map((command) => ({ ...command, onSelect: () => go(command.id) }));

const actions: PaletteCommand[] = [
  { id: "new-note", label: "New note", icon: <Plus /> },
  { id: "invite", label: "Invite member", icon: <UserPlus /> },
  { id: "theme", label: "Switch to the light theme", icon: <SunMoon /> },
  { id: "docs", label: "Open the docs", icon: <BookOpen /> },
  { id: "changelog", label: "Open the changelog", icon: <FileText /> },
  { id: "sign-out", label: "Sign out", icon: <LogOut /> },
].map((command) => ({ ...command, onSelect: () => go(command.id) }));

const launchNotes: PaletteCommand[] = [
  {
    id: "n1",
    label: "Q3 launch checklist",
    hint: "Freeze the pricing page",
  },
  { id: "n2", label: "Weekly sync", hint: "Agenda: the launch plan" },
].map((command) => ({
  ...command,
  icon: <NotebookPen />,
  onSelect: () => go(command.id),
}));

function notes(
  status: PaletteSearchGroup["status"],
  results: readonly PaletteCommand[] = [],
  onRetry?: () => void
): PaletteSearchGroup {
  return {
    type: "search",
    id: "notes",
    heading: "Notes",
    status,
    results,
    onRetry,
  };
}

function groupsWith(search: PaletteSearchGroup): PaletteGroup[] {
  return [
    {
      type: "commands",
      id: "navigate",
      heading: "Navigate",
      commands: navigate,
    },
    search,
    {
      type: "commands",
      id: "workspaces",
      heading: "Workspaces",
      commands: workspaces,
    },
    { type: "commands", id: "actions", heading: "Actions", commands: actions },
  ];
}

/** The palette with its own query state, so typing works in every story. */
function Stateful(args: AppCommandPaletteProps) {
  const [query, setQuery] = useState(args.query);
  return (
    <AppCommandPalette
      {...args}
      query={query}
      onQueryChange={(next) => {
        setQuery(next);
        args.onQueryChange(next);
      }}
    />
  );
}

/** Opened, nothing typed: every page and action, no search yet. */
export const Empty: Story = {
  args: { groups: groupsWith(notes("idle")) },
  render: (args) => <Stateful {...args} />,
};

/** Interaction: typing filters pages and actions; arrows, Home, End and Enter pick. */
export const Typing: Story = {
  args: { groups: groupsWith(notes("idle")) },
  render: (args) => <Stateful {...args} />,
  play: async ({ canvasElement, step }) => {
    const page = within(canvasElement.ownerDocument.body);
    const input = await page.findByRole("combobox");

    await step("Typing filters, best match first", async () => {
      await userEvent.type(input, "settings");
      await waitFor(() =>
        expect(page.getAllByRole("option").map((o) => o.textContent)).toEqual([
          "Settings: Account",
          "Settings: Security",
        ])
      );
      await expect(await page.findByText("2 results")).toBeInTheDocument();
      // The input names the selected option, which exists (screen readers read it).
      await waitFor(() => {
        const options = page.getAllByRole("option");
        expect(options.map((o) => o.getAttribute("aria-selected"))).toEqual([
          "true",
          "false",
        ]);
        expect(input).toHaveAttribute("aria-activedescendant", options[0]?.id);
      });
    });

    await step("A keyword matches too", async () => {
      await userEvent.clear(input);
      await userEvent.type(input, "passkey");
      await waitFor(() =>
        expect(page.getAllByRole("option").map((o) => o.textContent)).toEqual([
          "Settings: Security",
        ])
      );
    });

    await step("End, Home and Enter pick an item", async () => {
      await userEvent.clear(input);
      await userEvent.type(input, "o");
      await userEvent.keyboard("{End}");
      const options = page.getAllByRole("option");
      await waitFor(() =>
        expect(options.at(-1)).toHaveAttribute("aria-selected", "true")
      );
      await userEvent.keyboard("{Home}");
      await waitFor(() =>
        expect(options[0]).toHaveAttribute("aria-selected", "true")
      );
      await userEvent.keyboard("{ArrowDown}");
      await waitFor(() =>
        expect(options[1]).toHaveAttribute("aria-selected", "true")
      );
      go.mockClear();
      await userEvent.keyboard("{Enter}");
      await waitFor(() => expect(go).toHaveBeenCalledTimes(1));
    });
  },
};

/** A query with note hits from the server, between Navigate and Actions. */
export const Results: Story = {
  args: { query: "launch", groups: groupsWith(notes("ready", launchNotes)) },
  render: (args) => <Stateful {...args} />,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const notesGroup = await page.findByRole("group", { name: "Notes" });
    await expect(
      within(notesGroup)
        .getAllByRole("option")
        .map((o) => o.textContent)
    ).toEqual([
      expect.stringContaining("Q3 launch checklist"),
      expect.stringContaining("Weekly sync"),
    ]);
    // Server hits are shown as found, even when only the body matched.
    await expect(page.getByText("2 results")).toBeInTheDocument();
  },
};

/** Nothing matches anywhere: one message, no empty listbox. */
export const NoResults: Story = {
  args: { query: "zebra", groups: groupsWith(notes("ready", [])) },
  render: (args) => <Stateful {...args} />,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(page.getByText("No results for “zebra”")).toBeVisible()
    );
    await expect(page.queryByRole("option")).toBeNull();
  },
};

/** Pages match while the notes search is still running. */
export const Loading: Story = {
  args: { query: "settings", groups: groupsWith(notes("loading")) },
  render: (args) => <Stateful {...args} />,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(page.getByText("Searching notes…")).toBeVisible()
    );
    await expect(page.getAllByRole("option")).toHaveLength(2);
  },
};

const retry = fn();

/** The notes search failed: a safe message and Try again; pages still match. */
export const SearchError: Story = {
  name: "Error",
  args: { query: "launch", groups: groupsWith(notes("error", [], retry)) },
  render: (args) => <Stateful {...args} />,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(page.getByText("Couldn't search notes")).toBeVisible()
    );
    await userEvent.click(page.getByRole("button", { name: "Try again" }));
    await expect(retry).toHaveBeenCalled();
    await expect(page.queryByText(/No results/)).toBeNull();
  },
};

/** Phones: full screen, a Cancel button instead of key hints. */
export const Mobile: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
  args: { query: "launch", groups: groupsWith(notes("ready", launchNotes)) },
  render: (args) => <Stateful {...args} />,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const dialog = await page.findByRole("dialog");
    await waitFor(() =>
      expect(page.getByRole("button", { name: "Cancel" })).toBeVisible()
    );
    // Full screen once the open animation settles.
    await waitFor(() =>
      expect(Math.round(dialog.getBoundingClientRect().top)).toBe(0)
    );
    await expect(Math.round(dialog.getBoundingClientRect().left)).toBe(0);
  },
};

/**
 * In context: the top bar's Search trigger opens it and Escape returns focus to the
 * trigger. The key hint shows only on devices with a fine pointer.
 */
export const WithTrigger: Story = {
  args: { open: false, groups: groupsWith(notes("idle")) },
  render: function Render(args) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const trigger = useRef<HTMLButtonElement>(null);
    return (
      <>
        <CommandPaletteTrigger
          ref={trigger}
          shortcut={["⌘", "K"]}
          aria-keyshortcuts="Meta+K"
          onClick={() => setOpen(true)}
        />
        <AppCommandPalette
          {...args}
          open={open}
          onOpenChange={setOpen}
          query={query}
          onQueryChange={setQuery}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        />
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "Search" });
    await userEvent.click(trigger);
    await waitFor(() => expect(page.getByRole("combobox")).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
