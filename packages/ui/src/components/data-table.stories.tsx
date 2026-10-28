import type { Meta, StoryObj } from "@storybook/react-vite";
import { format } from "date-fns";
import { Archive, Inbox, Plus } from "lucide-react";
import { useState } from "react";
import { Avatar } from "./avatar";
import type { Tone } from "./badge";
import { Button } from "./button";
import {
  createDataTableColumnHelper,
  DataTable,
  type DataTableColumnDef,
} from "./data-table";
import {
  type IssuePriority,
  type IssueStatus,
  issuePriorities,
  issuePriorityLabel,
  issueStatuses,
  issueStatusLabel,
  PriorityIcon,
  StatusIcon,
} from "./issue-icons";
import { Tag } from "./tag";

interface Issue {
  id: string;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  assignee: string | null;
  labels: Array<{ name: string; color: Tone }>;
  due: Date | null;
}

const titles = [
  "Sync stalls when the device goes offline mid-upload",
  "Keyboard shortcut for moving issues between cycles",
  "Remove legacy webhooks v1 endpoints",
  "Dark mode contrast on the roadmap timeline",
  "Invite flow drops the workspace name in the email",
  "Paginate the audit log API",
  "Slack notification shows raw markdown",
  "Add SAML just-in-time provisioning",
  "Cycle burndown ignores issues moved mid-cycle",
  "Rate limit GraphQL mutations per token",
  "Duplicate detection for new bug reports",
  "Project updates editor loses focus on paste",
  "CSV import fails on UTF-16 files",
  "Show estimate totals in the board column header",
  "Migrate attachments to R2",
  "Crash when opening an archived project",
  "Customer request: export roadmap as PDF",
  "Search does not match issue keys without dash",
  "Bulk edit: set priority for 100+ issues times out",
  "Reduce cold start of the sync worker",
  "Triage inbox: snooze until next cycle",
  "Mentions autocomplete lags in large teams",
  "Billing page shows wrong seat count after downgrade",
  "Mobile: swipe to archive notification",
  "Document the public API rate limits",
  "Two-factor recovery codes download",
  "Sub-issue progress not shown on parent",
  "GitHub PR link not detected in branch names with slashes",
  "Timezone bug in due date reminders",
  "Add Figma embed preview",
  "Label groups: allow nesting one level",
  "Speed up initial load of the issue list",
  "Webhook retries should back off exponentially",
  "Empty state for filtered views",
  "Copy issue URL with title on ⌘⇧C",
  "SCIM deprovisioning leaves sessions active",
  "Roadmap zoom resets on navigation",
  "Inline code formatting in comments",
  "Support custom fields on projects",
  "Activity feed groups consecutive edits",
];

const people = [
  "Ada Lovelace",
  "Grace Hopper",
  "Alan Turing",
  "Katherine Johnson",
  "Margaret Hamilton",
  "Barbara Liskov",
];

const labelSet: Array<{ name: string; color: Tone }> = [
  { name: "Bug", color: "danger" },
  { name: "Feature", color: "accent" },
  { name: "Improvement", color: "info" },
  { name: "Performance", color: "warning" },
  { name: "Design", color: "success" },
];

const issues: Issue[] = titles.map((title, index) => ({
  id: `ENG-${412 - index * 7}`,
  title,
  status: issueStatuses[(index * 5) % issueStatuses.length],
  priority: issuePriorities[(index * 3) % issuePriorities.length],
  assignee: index % 7 === 3 ? null : people[index % people.length],
  labels:
    index % 4 === 0
      ? [
          labelSet[index % labelSet.length],
          labelSet[(index + 2) % labelSet.length],
        ]
      : [labelSet[index % labelSet.length]],
  due: index % 3 === 2 ? null : new Date(2026, 10, 1 + ((index * 11) % 45)),
}));

const statusOrder = (status: IssueStatus) => issueStatuses.indexOf(status);
const priorityOrder = (priority: IssuePriority) =>
  issuePriorities.indexOf(priority);

const helper = createDataTableColumnHelper<Issue>();

const columns: DataTableColumnDef<Issue>[] = [
  helper.accessor((issue) => priorityOrder(issue.priority), {
    id: "priority",
    header: "Priority",
    meta: { label: "Priority", headerClassName: "w-20" },
    enableGlobalFilter: false,
    cell: ({ row }) => (
      <PriorityIcon
        priority={row.original.priority}
        label={issuePriorityLabel[row.original.priority]}
      />
    ),
  }),
  helper.accessor("id", {
    header: "ID",
    meta: { cellClassName: "text-fg-muted tabular-nums whitespace-nowrap" },
  }),
  helper.accessor((issue) => statusOrder(issue.status), {
    id: "status",
    header: "Status",
    enableGlobalFilter: false,
    cell: ({ row }) => (
      <span className="flex items-center gap-2 whitespace-nowrap text-fg-muted">
        <StatusIcon status={row.original.status} label="" />
        {issueStatusLabel[row.original.status]}
      </span>
    ),
  }),
  helper.accessor("title", {
    header: "Title",
    meta: { cellClassName: "max-w-0 w-full" },
    cell: ({ getValue }) => (
      <span className="block truncate font-medium">{getValue()}</span>
    ),
  }),
  helper.display({
    id: "labels",
    header: "Labels",
    cell: ({ row }) => (
      <span className="flex gap-1">
        {row.original.labels.map((label) => (
          <Tag key={label.name} size="sm" color={label.color}>
            {label.name}
          </Tag>
        ))}
      </span>
    ),
  }),
  helper.accessor((issue) => issue.assignee ?? "", {
    id: "assignee",
    header: "Assignee",
    cell: ({ row }) =>
      row.original.assignee ? (
        <span className="flex items-center gap-2 whitespace-nowrap text-fg-muted">
          <Avatar name={row.original.assignee} size="sm" />
          {row.original.assignee}
        </span>
      ) : (
        <span className="text-fg-subtle">Unassigned</span>
      ),
  }),
  helper.accessor((issue) => issue.due?.getTime() ?? Number.POSITIVE_INFINITY, {
    id: "due",
    header: "Due",
    enableGlobalFilter: false,
    meta: { align: "right", cellClassName: "whitespace-nowrap text-fg-muted" },
    cell: ({ row }) =>
      row.original.due ? format(row.original.due, "MMM d") : "—",
  }),
];

/**
 * A full-featured table on TanStack Table 9. Click headers to sort (Shift-click to
 * multi-sort), tick rows (Shift-click for a range), filter with the search field, hide
 * columns from "View", and page through results. Columns are TanStack column
 * definitions built with `createDataTableColumnHelper<Row>()`.
 */
const meta = {
  title: "Data display/DataTable",
  component: DataTable,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    data: issues,
    columns,
    getRowId: (issue: Issue) => issue.id,
    enableRowSelection: true,
    enableGlobalFilter: true,
    enableColumnVisibility: true,
    pageSize: 10,
    loading: false,
    stickyHeader: false,
    searchPlaceholder: "Filter issues…",
  },
} satisfies Meta<typeof DataTable<Issue>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Loading: Story = {
  args: { loading: true },
};

export const Empty: Story = {
  args: {
    data: [],
    emptyState: (
      <span className="flex flex-col items-center gap-1">
        <Inbox className="size-5 text-fg-subtle" />
        No issues in this view
      </span>
    ),
  },
};

export const Minimal: Story = {
  args: {
    enableRowSelection: false,
    enableGlobalFilter: false,
    enableColumnVisibility: false,
    pageSize: 5,
  },
};

export const StickyHeader: Story = {
  args: {
    pageSize: 50,
    stickyHeader: true,
    containerClassName: "max-h-96",
  },
};

export const InContext: Story = {
  render: (args) => {
    const [data, setData] = useState(issues);
    const [opened, setOpened] = useState<Issue | null>(null);
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-fg">
            Engineering · All issues
          </h2>
          {opened ? (
            <span className="text-xs text-fg-muted">
              Opened {opened.id}: {opened.title}
            </span>
          ) : null}
        </div>
        <DataTable
          {...args}
          data={data}
          columns={columns}
          getRowId={(issue) => issue.id}
          onRowClick={setOpened}
          toolbar={
            <Button size="sm" variant="primary" icon={<Plus />}>
              New issue
            </Button>
          }
          selectionActions={(rows, clear) => (
            <Button
              size="xs"
              variant="secondary"
              icon={<Archive />}
              onClick={() => {
                const ids = new Set(rows.map((row) => row.id));
                setData((all) => all.filter((issue) => !ids.has(issue.id)));
                clear();
              }}
            >
              Archive
            </Button>
          )}
        />
      </div>
    );
  },
};
