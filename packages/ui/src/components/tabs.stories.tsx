import type { Meta, StoryObj } from "@storybook/react-vite";
import { Columns3, List as ListIcon, Map as MapIcon } from "lucide-react";
import { SegmentedControl, SegmentedControlItem } from "./segmented-control";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

/** Every tab controls a panel (`aria-controls` must point at one); one line each here. */
function Panels({ panels }: { readonly panels: Record<string, string> }) {
  return Object.entries(panels).map(([value, text]) => (
    <TabsContent key={value} value={value} className="text-sm text-fg-muted">
      {text}
    </TabsContent>
  ));
}

/**
 * Switch between views of the same thing. `underline` for page sections (Overview /
 * Issues / Updates), `pill` (segmented) for compact view switches in a toolbar. Arrow
 * keys move between tabs.
 */
const meta = {
  title: "Navigation/Tabs",
  component: TabsList,
  tags: ["autodocs"],
  args: { variant: "underline", size: "md" },
  argTypes: {
    variant: { control: "inline-radio", options: ["underline", "pill"] },
    size: { control: "inline-radio", options: ["sm", "md"] },
  },
} satisfies Meta<typeof TabsList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <Tabs defaultValue="issues" className="w-[480px]">
      <TabsList {...args}>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="issues" count={32}>
          Issues
        </TabsTrigger>
        <TabsTrigger value="updates" count={4}>
          Updates
        </TabsTrigger>
        <TabsTrigger value="settings" disabled>
          Settings
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="text-sm text-fg-muted">
        Mobile app v3 ships offline sync and a new tablet layout.
      </TabsContent>
      <TabsContent value="issues" className="text-sm text-fg-muted">
        32 issues, 14 done.
      </TabsContent>
      <TabsContent value="updates" className="text-sm text-fg-muted">
        Latest update: “Offline sync slipped a week.”
      </TabsContent>
    </Tabs>
  ),
};

export const Underline: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {(["sm", "md"] as const).map((size) => (
        <Tabs key={size} defaultValue="all">
          <TabsList size={size}>
            <TabsTrigger value="all">All issues</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="backlog">Backlog</TabsTrigger>
          </TabsList>
          <Panels
            panels={{
              all: "Every issue in the team.",
              active: "Issues in progress or in review.",
              backlog: "Issues nobody has started.",
            }}
          />
        </Tabs>
      ))}
    </div>
  ),
};

export const Pill: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(["sm", "md"] as const).map((size) => (
        <Tabs key={size} defaultValue="list">
          <TabsList variant="pill" size={size}>
            <TabsTrigger value="list" icon={<ListIcon />}>
              List
            </TabsTrigger>
            <TabsTrigger value="board" icon={<Columns3 />}>
              Board
            </TabsTrigger>
            <TabsTrigger value="timeline" icon={<MapIcon />}>
              Timeline
            </TabsTrigger>
          </TabsList>
          <Panels
            panels={{
              list: "Issues as rows.",
              board: "Issues as cards per status.",
              timeline: "Projects on a timeline.",
            }}
          />
        </Tabs>
      ))}
    </div>
  ),
};

export const WithCounts: Story = {
  render: () => (
    <Tabs defaultValue="assigned">
      <TabsList variant="pill">
        <TabsTrigger value="assigned" count={12}>
          Assigned
        </TabsTrigger>
        <TabsTrigger value="created" count={48}>
          Created
        </TabsTrigger>
        <TabsTrigger value="subscribed" count={3}>
          Subscribed
        </TabsTrigger>
      </TabsList>
      <Panels
        panels={{
          assigned: "12 issues assigned to you.",
          created: "48 issues you created.",
          subscribed: "3 issues you follow.",
        }}
      />
    </Tabs>
  ),
};

export const InContext: Story = {
  render: () => (
    <div className="w-[640px] rounded-lg border border-line bg-surface">
      <Tabs defaultValue="issues" className="gap-0">
        <div className="flex items-center justify-between px-4">
          <TabsList className="border-b-0">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="issues" count={32}>
              Issues
            </TabsTrigger>
            <TabsTrigger value="updates">Updates</TabsTrigger>
          </TabsList>
          {/* A view switch changes how the panel renders, it controls no panel of its
              own: a SegmentedControl (radio group), not a second Tabs. */}
          <SegmentedControl defaultValue="list" size="sm" aria-label="Layout">
            <SegmentedControlItem
              value="list"
              icon={<ListIcon />}
              label="List view"
            />
            <SegmentedControlItem
              value="board"
              icon={<Columns3 />}
              label="Board view"
            />
          </SegmentedControl>
        </div>
        <div className="border-t border-line p-4 text-sm text-fg-muted">
          <TabsContent value="overview">
            Project brief and milestones.
          </TabsContent>
          <TabsContent value="issues">
            The issue list for this project.
          </TabsContent>
          <TabsContent value="updates">Weekly project updates.</TabsContent>
        </div>
      </Tabs>
    </div>
  ),
};
