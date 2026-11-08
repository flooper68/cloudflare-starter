import {
  AppCommandPalette,
  CommandPaletteTrigger,
  type PaletteCommand,
  type PaletteGroup,
  toast,
  useCommandPalette,
} from "@cloudflare-starter/ui";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  Building2,
  FileText,
  LogOut,
  Plus,
  SunMoon,
  UserPlus,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/components/shared/spa/auth-context";
import { useWorkspace } from "@/components/shared/spa/workspace-context";
import { trackClientEvent } from "@/lib/analytics";
import { trpc } from "@/lib/trpc/client";
import { clientCan } from "@/lib/workspace-permissions";

import { navIcons } from "../nav-icons";
import { paletteDestinations } from "../navigation";
import { signOut, useNavContext } from "../use-nav-context";
import {
  type PaletteItemKind,
  paletteSearchProviders,
} from "./search-providers";
import { usePaletteSearch } from "./use-palette-search";

/** macOS and iOS say ⌘K; everyone else Ctrl+K (the shortcut accepts both everywhere). */
function shortcutKeys(): { readonly keys: string[]; readonly aria: string } {
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ?? navigator.platform;
  return /mac|iphone|ipad/i.test(platform)
    ? { keys: ["⌘", "K"], aria: "Meta+K" }
    : { keys: ["Ctrl", "K"], aria: "Control+K" };
}

function currentTheme(): "light" | "dark" {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

/**
 * The app shell's search-and-jump tool: the top bar's Search trigger and the ⌘K / Ctrl+K
 * palette. Groups, in order: Navigate (navigation.ts, filtered by permission), one group
 * per search provider (search-providers.ts), Workspaces (multi mode) and Actions. Reports
 * opening and the kind of item picked as product events, never the query.
 */
export function AppCommandMenu() {
  const { open, setOpen } = useCommandPalette();
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const auth = useAuth();
  const { mode, list, active, switchTo } = useWorkspace();
  const navContext = useNavContext();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openedBy = useRef<"shortcut" | "trigger">("shortcut");
  const closedBySelection = useRef(false);
  const [shortcut] = useState(shortcutKeys);
  const [theme, setTheme] = useState(currentTheme);
  const settings = useRef(auth.settings);

  useEffect(() => {
    if (!open) return;
    trackClientEvent("app.command_palette_opened", {
      source: openedBy.current,
    });
    openedBy.current = "shortcut";
    closedBySelection.current = false;
    setTheme(currentTheme());
  }, [open]);

  const providers = useMemo(
    () =>
      paletteSearchProviders.filter((provider) => provider.visible(navContext)),
    [navContext]
  );
  const { states, retry } = usePaletteSearch(
    providers,
    open ? query : "",
    active?.id ?? null
  );

  /** Every pick: the product event (kind only), close, then run it. */
  function pick(kind: PaletteItemKind, run: () => unknown) {
    trackClientEvent("app.command_palette_item_selected", { kind });
    closedBySelection.current = true;
    setOpen(false);
    void run();
  }

  async function toggleTheme() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    const saved = settings.current;
    if (!saved) return;
    try {
      await trpc.account.settings.update.mutate({ ...saved, theme: next });
      settings.current = { ...saved, theme: next };
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't save the theme"
      );
    }
  }

  const groups: PaletteGroup[] = [];

  groups.push({
    type: "commands",
    id: "navigate",
    heading: "Navigate",
    commands: paletteDestinations(navContext).map(
      (destination): PaletteCommand => ({
        id: destination.id,
        label: destination.label,
        icon: navIcons[destination.icon],
        keywords: destination.keywords,
        hint: destination.to === pathname ? "Current" : undefined,
        onSelect: () =>
          pick("navigate", () =>
            destination.document
              ? window.location.assign(destination.to)
              : navigate({ to: destination.to })
          ),
      })
    ),
  });

  for (const provider of providers) {
    const state = states[provider.id] ?? { status: "idle", hits: [] };
    groups.push({
      type: "search",
      id: provider.id,
      heading: provider.heading,
      status: state.status,
      onRetry: retry,
      results: state.hits.map((hit) => ({
        id: hit.id,
        label: hit.label,
        hint: hit.hint,
        icon: navIcons[provider.icon],
        onSelect: () => pick(provider.kind, () => navigate({ to: hit.to })),
      })),
    });
  }

  if (mode === "multi") {
    groups.push({
      type: "commands",
      id: "workspaces",
      heading: "Workspaces",
      commands: (list.data?.items ?? [])
        .filter((workspace) => workspace.id !== active?.id)
        .map((workspace) => ({
          id: workspace.id,
          label: `Switch to ${workspace.name}`,
          icon: <Building2 />,
          keywords: ["workspace"],
          onSelect: () =>
            pick("workspace", async () => {
              try {
                await switchTo(workspace.id);
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Switch failed"
                );
              }
            }),
        })),
    });
  }

  const role = active?.role;
  const actions: PaletteCommand[] = [];
  if (active && clientCan(role, "notes.write")) {
    actions.push({
      id: "new-note",
      label: "New note",
      icon: <Plus />,
      keywords: ["create", "write"],
      onSelect: () =>
        pick("action", () =>
          navigate({ to: "/app/notes", search: { new: true } })
        ),
    });
  }
  if (
    navContext.mode !== "personal" &&
    active?.kind === "shared" &&
    clientCan(role, "invitations.manage")
  ) {
    actions.push({
      id: "invite",
      label: "Invite member",
      icon: <UserPlus />,
      keywords: ["invite", "people", "teammate", "add"],
      onSelect: () =>
        pick("action", () =>
          navigate({ to: "/app/members", search: { invite: true } })
        ),
    });
  }
  actions.push(
    {
      id: "theme",
      label: `Switch to the ${theme === "dark" ? "light" : "dark"} theme`,
      icon: <SunMoon />,
      keywords: ["theme", "dark", "light", "appearance", "toggle"],
      onSelect: () => pick("action", toggleTheme),
    },
    {
      id: "docs",
      label: "Open the docs",
      icon: <BookOpen />,
      keywords: ["documentation", "help", "guide"],
      onSelect: () => pick("action", () => window.location.assign("/docs/")),
    },
    {
      id: "changelog",
      label: "Open the changelog",
      icon: <FileText />,
      keywords: ["release notes", "what's new", "changes"],
      onSelect: () =>
        pick("action", () => window.location.assign("/docs/changelog/")),
    },
    {
      id: "sign-out",
      label: "Sign out",
      icon: <LogOut />,
      keywords: ["log out", "logout"],
      onSelect: () => pick("action", signOut),
    }
  );
  groups.push({
    type: "commands",
    id: "actions",
    heading: "Actions",
    commands: actions,
  });

  return (
    <>
      <CommandPaletteTrigger
        ref={triggerRef}
        shortcut={shortcut.keys}
        aria-keyshortcuts={shortcut.aria}
        onClick={() => {
          openedBy.current = "trigger";
          setOpen(true);
        }}
      />
      <AppCommandPalette
        open={open}
        onOpenChange={setOpen}
        query={query}
        onQueryChange={setQuery}
        groups={groups}
        onCloseAutoFocus={(event) => {
          // A pick moved on (a new page sets its own focus); a dismissal goes back.
          event.preventDefault();
          if (!closedBySelection.current) triggerRef.current?.focus();
        }}
      />
    </>
  );
}
