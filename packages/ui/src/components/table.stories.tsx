import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "./avatar";
import { Badge } from "./badge";
import { StatusIcon } from "./issue-icons";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

const projects = [
  {
    name: "Mobile app v3",
    lead: "Margaret Hamilton",
    status: "in_progress",
    health: "At risk",
    issues: 32,
    target: "Nov 14",
  },
  {
    name: "Billing v2",
    lead: "Grace Hopper",
    status: "in_review",
    health: "On track",
    issues: 18,
    target: "Nov 2",
  },
  {
    name: "Search relevance",
    lead: "Alan Turing",
    status: "todo",
    health: "On track",
    issues: 9,
    target: "Dec 5",
  },
  {
    name: "SSO for enterprise",
    lead: "Barbara Liskov",
    status: "done",
    health: "Done",
    issues: 24,
    target: "Oct 20",
  },
  {
    name: "Onboarding checklist",
    lead: "Katherine Johnson",
    status: "backlog",
    health: "No updates",
    issues: 6,
    target: "—",
  },
] as const;

const healthTone = {
  "At risk": "warning",
  "On track": "success",
  Done: "accent",
  "No updates": "neutral",
} as const;

/**
 * Styled table primitives for static data: dense rows, hairline separators, hover, and
 * an optional sticky header. For sorting, selection and pagination use `DataTable`.
 */
const meta = {
  title: "Data display/Table",
  component: Table,
  tags: ["autodocs"],
  args: { stickyHeader: false },
  parameters: { layout: "padded" },
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

function ProjectRows() {
  return (
    <>
      {projects.map((project) => (
        <TableRow key={project.name}>
          <TableCell>
            <span className="flex items-center gap-2">
              <StatusIcon status={project.status} />
              <span className="font-medium">{project.name}</span>
            </span>
          </TableCell>
          <TableCell>
            <span className="flex items-center gap-2 text-fg-muted">
              <Avatar name={project.lead} size="sm" />
              {project.lead}
            </span>
          </TableCell>
          <TableCell>
            <Badge size="sm" dot tone={healthTone[project.health]}>
              {project.health}
            </Badge>
          </TableCell>
          <TableCell className="text-right tabular-nums text-fg-muted">
            {project.issues}
          </TableCell>
          <TableCell className="text-fg-muted">{project.target}</TableCell>
        </TableRow>
      ))}
    </>
  );
}

function ProjectHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Project</TableHead>
        <TableHead>Lead</TableHead>
        <TableHead>Health</TableHead>
        <TableHead className="text-right">Issues</TableHead>
        <TableHead>Target</TableHead>
      </TableRow>
    </TableHeader>
  );
}

export const Playground: Story = {
  render: (args) => (
    <div className="rounded-lg border border-line">
      <Table {...args}>
        <ProjectHeader />
        <TableBody>
          <ProjectRows />
        </TableBody>
      </Table>
    </div>
  ),
};

export const WithCaptionAndFooter: Story = {
  render: () => (
    <Table>
      <TableCaption>Active projects in the Platform team.</TableCaption>
      <ProjectHeader />
      <TableBody>
        <ProjectRows />
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total</TableCell>
          <TableCell className="text-right tabular-nums">89</TableCell>
          <TableCell />
        </TableRow>
      </TableFooter>
    </Table>
  ),
};

export const SelectedRow: Story = {
  render: () => (
    <Table>
      <ProjectHeader />
      <TableBody>
        {projects.slice(0, 3).map((project, index) => (
          <TableRow key={project.name} selected={index === 1}>
            <TableCell className="font-medium">{project.name}</TableCell>
            <TableCell className="text-fg-muted">{project.lead}</TableCell>
            <TableCell className="text-fg-muted">{project.health}</TableCell>
            <TableCell className="text-right tabular-nums">
              {project.issues}
            </TableCell>
            <TableCell className="text-fg-muted">{project.target}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

export const StickyHeader: Story = {
  render: () => (
    <div className="rounded-lg border border-line">
      <Table stickyHeader containerClassName="max-h-64">
        <ProjectHeader />
        <TableBody>
          <ProjectRows />
          <ProjectRows />
          <ProjectRows />
        </TableBody>
      </Table>
    </div>
  ),
};
