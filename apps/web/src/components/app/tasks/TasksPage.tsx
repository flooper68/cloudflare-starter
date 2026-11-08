import {
  type Issue,
  type IssuePerson,
  TaskBoard,
} from "@cloudflare-starter/ui";
import { PlaceholderHeader } from "@/components/app/notes/PlaceholderHeader";
import { useAuth } from "@/components/shared/spa/auth-context";
import { useWorkspace } from "@/components/shared/spa/workspace-context";

const grace: IssuePerson = { id: "sample-grace", name: "Grace Hopper" };
const charles: IssuePerson = { id: "sample-charles", name: "Charles Babbage" };

/** Sample tasks, in the browser only: the Tasks placeholder has no backend. */
function sampleTasks(you: IssuePerson): Issue[] {
  return [
    {
      id: "t41",
      identifier: "ACM-41",
      title: "Import contacts from CSV",
      status: "backlog",
      priority: "low",
      assignee: charles,
    },
    {
      id: "t38",
      identifier: "ACM-38",
      title: "Dark mode for emails",
      status: "backlog",
      priority: "none",
      assignee: null,
    },
    {
      id: "t44",
      identifier: "ACM-44",
      title: "Invite flow copy review",
      status: "todo",
      priority: "medium",
      assignee: you,
    },
    {
      id: "t43",
      identifier: "ACM-43",
      title: "Seat limit on invitations",
      status: "todo",
      priority: "high",
      assignee: grace,
    },
    {
      id: "t39",
      identifier: "ACM-39",
      title: "Passkey rename",
      status: "in_progress",
      priority: "medium",
      assignee: you,
    },
    {
      id: "t35",
      identifier: "ACM-35",
      title: "Workspace logo upload",
      status: "done",
      priority: "medium",
      assignee: grace,
    },
  ];
}

/**
 * `/app/tasks`: the placeholder Tasks app. Sample tasks in the browser only (nothing is
 * saved), to show IssueList, KanbanBoard and FilterBar from the component library; a
 * project replaces it with its own feature, built like Notes.
 */
export function TasksPage() {
  const { user } = useAuth();
  const { active } = useWorkspace();
  const you: IssuePerson = {
    id: user?.id ?? "you",
    name: user?.name || "You",
    avatarUrl: user?.image ?? undefined,
  };
  return (
    <section className="space-y-6">
      <PlaceholderHeader
        title="Tasks"
        description={`Track work in ${active?.name ?? "the workspace"}.`}
        notice="Sample tasks in your browser only: nothing is saved, and a reload starts over. It shows the board, list and filter components; build a real module like Notes."
      />
      <TaskBoard tasks={sampleTasks(you)} people={[you, grace, charles]} />
    </section>
  );
}
