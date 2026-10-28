/** Story data for the patterns: one product team's people, labels and issues. Not exported. */
import {
  Box,
  CircleDashed,
  CircleHelp,
  CircleUserRound,
  Copy,
  Inbox,
  Layers,
  LogOut,
  RefreshCcw,
  Search,
  Settings,
  SignalHigh,
  SquarePen,
  Tag,
  UserPlus,
} from "lucide-react";

import { brand, LogoMark } from "../../brand/brand";
import { IconButton } from "../button";
import { Shortcut } from "../kbd";
import { Tooltip } from "../tooltip";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarMenuItem,
  SidebarMenuLabel,
  SidebarMenuSeparator,
  SidebarSection,
  SidebarTeam,
  SidebarWorkspaceSwitcher,
  TeamIcon,
} from "./app-shell";
import type { FilterProperty } from "./filter-bar";
import { labelDot, PersonAvatar } from "./internal";
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  type Issue,
  type IssueLabel,
  type IssuePerson,
  PriorityIcon,
  StatusIcon,
} from "./issue-glyphs";

export const people = {
  ada: { id: "u-ada", name: "Ada Novak" },
  ben: { id: "u-ben", name: "Ben Okafor" },
  chloe: { id: "u-chloe", name: "Chloé Martin" },
  dan: { id: "u-dan", name: "Dan Whitfield" },
  eva: { id: "u-eva", name: "Eva Lindqvist" },
} satisfies Record<string, IssuePerson>;

export const allPeople: readonly IssuePerson[] = Object.values(people);

export const labels = {
  bug: { id: "l-bug", name: "Bug", color: "danger" },
  feature: { id: "l-feature", name: "Feature", color: "accent" },
  improvement: { id: "l-improvement", name: "Improvement", color: "info" },
  design: { id: "l-design", name: "Design", color: "warning" },
  perf: { id: "l-perf", name: "Performance", color: "success" },
  infra: { id: "l-infra", name: "Infra", color: "neutral" },
} satisfies Record<string, IssueLabel>;

export const allLabels: readonly IssueLabel[] = Object.values(labels);

/** Due dates relative to today, so overdue styling is always visible. */
function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const issues: readonly Issue[] = [
  {
    id: "i-142",
    identifier: "ENG-142",
    title: "Sign-in link expires before the email arrives on Outlook",
    status: "in_progress",
    priority: "urgent",
    labels: [labels.bug],
    assignee: people.ada,
    dueDate: inDays(-1),
  },
  {
    id: "i-138",
    identifier: "ENG-138",
    title: "Move session storage from KV to D1",
    status: "in_progress",
    priority: "high",
    labels: [labels.infra, labels.perf],
    assignee: people.ben,
    dueDate: inDays(3),
  },
  {
    id: "i-151",
    identifier: "ENG-151",
    title: "Keyboard shortcuts cheat sheet (⌘/)",
    status: "in_review",
    priority: "medium",
    labels: [labels.feature],
    assignee: people.chloe,
  },
  {
    id: "i-149",
    identifier: "ENG-149",
    title: "Board view: drag cards between columns",
    status: "in_review",
    priority: "high",
    labels: [labels.feature, labels.design],
    assignee: people.dan,
    dueDate: inDays(1),
  },
  {
    id: "i-155",
    identifier: "ENG-155",
    title: "Filter issues by assignee and label",
    status: "todo",
    priority: "high",
    labels: [labels.feature],
    assignee: people.eva,
    dueDate: inDays(6),
  },
  {
    id: "i-157",
    identifier: "ENG-157",
    title: "Empty states for inbox and my issues",
    status: "todo",
    priority: "low",
    labels: [labels.design],
    assignee: people.chloe,
  },
  {
    id: "i-160",
    identifier: "ENG-160",
    title: "Rate-limit the MCP token endpoint",
    status: "todo",
    priority: "urgent",
    labels: [labels.infra, labels.bug],
    assignee: null,
    dueDate: inDays(2),
  },
  {
    id: "i-161",
    identifier: "ENG-161",
    title: "Comment reactions don't update without reload",
    status: "todo",
    priority: "medium",
    labels: [labels.bug],
    assignee: people.ben,
  },
  {
    id: "i-163",
    identifier: "ENG-163",
    title: "Dark mode contrast on label chips",
    status: "backlog",
    priority: "low",
    labels: [labels.design, labels.improvement],
    assignee: null,
  },
  {
    id: "i-164",
    identifier: "ENG-164",
    title: "Export issues to CSV",
    status: "backlog",
    priority: "none",
    labels: [labels.feature],
    assignee: null,
  },
  {
    id: "i-166",
    identifier: "ENG-166",
    title: "Cache the workspace switcher list",
    status: "backlog",
    priority: "medium",
    labels: [labels.perf],
    assignee: people.dan,
  },
  {
    id: "i-131",
    identifier: "ENG-131",
    title: "Set up preview deployments per pull request",
    status: "done",
    priority: "high",
    labels: [labels.infra],
    assignee: people.ada,
  },
  {
    id: "i-127",
    identifier: "ENG-127",
    title: "Password reset email template",
    status: "done",
    priority: "medium",
    labels: [labels.feature],
    assignee: people.eva,
  },
  {
    id: "i-120",
    identifier: "ENG-120",
    title: "Self-hosted analytics prototype",
    status: "canceled",
    priority: "low",
    labels: [labels.improvement],
    assignee: people.ben,
  },
];

/* Demo sidebar shared by the AppShell and Issue tracker stories. */

export function DemoSidebar({
  active = "active-issues",
}: {
  readonly active?: string;
}) {
  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarWorkspaceSwitcher
          actions={
            <>
              <Tooltip content="Search" shortcut={["/"]}>
                <IconButton label="Search" size="sm">
                  <Search />
                </IconButton>
              </Tooltip>
              <Tooltip content="New issue" shortcut={["C"]}>
                <IconButton label="New issue" size="sm" variant="secondary">
                  <SquarePen />
                </IconButton>
              </Tooltip>
            </>
          }
        >
          <SidebarMenuLabel>{people.ada.name}</SidebarMenuLabel>
          <SidebarMenuItem
            icon={<Settings />}
            shortcut={<Shortcut keys={["G", "S"]} />}
          >
            Settings
          </SidebarMenuItem>
          <SidebarMenuItem icon={<UserPlus />}>
            Invite and manage members
          </SidebarMenuItem>
          <SidebarMenuSeparator />
          <SidebarMenuLabel>Switch workspace</SidebarMenuLabel>
          <SidebarMenuItem icon={<LogoMark />}>{brand.name}</SidebarMenuItem>
          <SidebarMenuItem icon={<TeamIcon name="Northwind" tone="success" />}>
            Northwind
          </SidebarMenuItem>
          <SidebarMenuSeparator />
          <SidebarMenuItem icon={<LogOut />}>Log out</SidebarMenuItem>
        </SidebarWorkspaceSwitcher>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSection>
          <SidebarItem icon={<Inbox />} count={4} active={active === "inbox"}>
            Inbox
          </SidebarItem>
          <SidebarItem
            icon={<CircleUserRound />}
            active={active === "my-issues"}
          >
            My issues
          </SidebarItem>
          <SidebarItem icon={<Layers />} active={active === "views"}>
            Views
          </SidebarItem>
        </SidebarSection>
        <SidebarSection label="Your teams" collapsible>
          <SidebarTeam name="Engineering">
            <SidebarItem
              icon={<Copy />}
              inset
              active={active === "active-issues"}
            >
              Issues
            </SidebarItem>
            <SidebarItem icon={<RefreshCcw />} inset>
              Cycles
            </SidebarItem>
            <SidebarItem icon={<Box />} inset>
              Projects
            </SidebarItem>
          </SidebarTeam>
          <SidebarTeam
            name="Design"
            icon={<TeamIcon name="Design" tone="warning" />}
            defaultOpen={false}
          >
            <SidebarItem icon={<Copy />} inset>
              Issues
            </SidebarItem>
            <SidebarItem icon={<Box />} inset>
              Projects
            </SidebarItem>
          </SidebarTeam>
        </SidebarSection>
      </SidebarContent>
      <SidebarFooter>
        <Tooltip content="Help and feedback">
          <IconButton label="Help and feedback" size="sm">
            <CircleHelp />
          </IconButton>
        </Tooltip>
      </SidebarFooter>
    </Sidebar>
  );
}

export const filterProperties: readonly FilterProperty[] = [
  {
    id: "status",
    label: "Status",
    pluralLabel: "statuses",
    icon: <CircleDashed />,
    options: ISSUE_STATUSES.map((s) => ({
      value: s.value,
      label: s.label,
      icon: <StatusIcon status={s.value} />,
    })),
  },
  {
    id: "priority",
    label: "Priority",
    pluralLabel: "priorities",
    icon: <SignalHigh />,
    options: ISSUE_PRIORITIES.map((p) => ({
      value: p.value,
      label: p.label,
      icon: <PriorityIcon priority={p.value} />,
    })),
  },
  {
    id: "assignee",
    label: "Assignee",
    icon: <CircleUserRound />,
    options: [
      {
        value: "none",
        label: "No assignee",
        icon: <PersonAvatar person={null} size="xs" />,
      },
      ...allPeople.map((p) => ({
        value: p.id,
        label: p.name,
        icon: <PersonAvatar person={p} size="xs" />,
      })),
    ],
  },
  {
    id: "label",
    label: "Label",
    icon: <Tag />,
    options: allLabels.map((l) => ({
      value: l.id,
      label: l.name,
      icon: <span className={`size-2 rounded-full ${labelDot[l.color]}`} />,
    })),
  },
];

/** Reads a filter property from an issue, for matchesFilters. */
export function issueProperty(issue: Issue, property: string) {
  switch (property) {
    case "status":
      return issue.status;
    case "priority":
      return issue.priority;
    case "assignee":
      return issue.assignee?.id ?? "none";
    case "label":
      return issue.labels?.map((l) => l.id) ?? [];
    default:
      return null;
  }
}
