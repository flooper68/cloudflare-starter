import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  type ChecklistStep,
  DataState,
  GettingStartedChecklist,
  GettingStartedChecklistSkeleton,
} from "@cloudflare-starter/ui";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  FileText,
  FlaskConical,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";

import { useAuth } from "@/components/shared/spa/auth-context";
import { useWorkspace } from "@/components/shared/spa/workspace-context";
import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

/** What the checklist reads: the user's security state and the workspace's members. */
function useChecklist(workspaceId: string, shared: boolean) {
  return useAsync(async () => {
    const [security, members, notes] = await Promise.all([
      trpc.account.security.status.query(),
      shared
        ? trpc.workspace.members.list.query({ workspaceId })
        : Promise.resolve({ items: [] }),
      trpc.notes.list.query({ workspaceId, limit: 1 }),
    ]);
    return {
      emailVerified: security.emailVerified,
      secondFactor: security.enrolled || security.passkeys.length > 0,
      members: members.items.length,
      notes: notes.items.length,
    };
  }, `checklist:${workspaceId}:${shared}`);
}

function action(
  to:
    | "/app/members"
    | "/app/settings/security"
    | "/app/notes"
    | "/verify-email",
  label: string
) {
  return (
    <Button asChild size="sm">
      {/* /verify-email is an Astro page: a full load, not an SPA route. */}
      {to === "/verify-email" ? (
        <a href={to}>{label}</a>
      ) : (
        <Link to={to}>{label}</Link>
      )}
    </Button>
  );
}

function Destination({
  icon,
  title,
  description,
  children,
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-fg-muted [&_svg]:size-4">
        {icon}
        <CardTitle>{title}</CardTitle>
      </div>
      <CardDescription className="grow">{description}</CardDescription>
      <div>{children}</div>
    </Card>
  );
}

/**
 * `/app/dashboard`: a getting-started checklist that walks through the starter's
 * account and workspace features, and the places to go next. A project replaces it with
 * its own home page.
 */
export function DashboardPage() {
  const { user, admin, workspace } = useAuth();
  const { active } = useWorkspace();
  const shared = workspace.mode !== "personal" && active?.kind === "shared";
  const checklist = useChecklist(active?.id ?? "", shared);

  return (
    <section className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-fg">
          Welcome{user?.name ? `, ${user.name}` : ""}
        </h2>
        <p className="text-sm text-fg-muted">
          Everything the starter sets up, working in{" "}
          {active?.name ?? "your workspace"}.
        </p>
      </div>

      <DataState
        status={checklist.status}
        data={checklist.data}
        error={checklist.error}
        onRetry={checklist.refetch}
        isEmpty={() => false}
        loading={<GettingStartedChecklistSkeleton rows={4} />}
        empty={null}
      >
        {(state) => {
          const steps: ChecklistStep[] = [
            {
              id: "verify-email",
              title: "Verify your email",
              description:
                "Confirms the address that password resets and notifications go to.",
              done: state.emailVerified,
              action: action("/verify-email", "Verify"),
            },
            ...(workspace.mode === "personal"
              ? []
              : [
                  {
                    id: "invite",
                    title: "Invite a teammate",
                    description: shared
                      ? "Members share the workspace's files and trash, and get notified."
                      : "Create a shared workspace from the workspace menu, then invite people to it.",
                    done: state.members > 1,
                    action: shared
                      ? action("/app/members", "Invite")
                      : undefined,
                  },
                ]),
            {
              id: "two-factor",
              title: "Turn on two-factor authentication",
              description:
                "An authenticator app or a passkey protects your account.",
              done: state.secondFactor,
              action: action("/app/settings/security", "Set up"),
            },
            {
              id: "note",
              title: "Write your first note",
              description:
                "Notes is a placeholder app: a full feature with its API, MCP tools, audit, limits and trash.",
              done: state.notes > 0,
              action: action("/app/notes", "Open Notes"),
            },
          ];
          return (
            <GettingStartedChecklist
              steps={steps}
              description="A few steps that show each part of the starter working."
            />
          );
        }}
      </DataState>

      <div className="grid gap-4 md:grid-cols-2">
        <Destination
          icon={<FlaskConical />}
          title="Developer demos"
          description="Upload to R2, a queued job and a test email: the platform's bindings at work."
        >
          <Button asChild size="sm">
            <Link to="/app/demos">Open demos</Link>
          </Button>
        </Destination>
        <Destination
          icon={<BookOpen />}
          title="Component library"
          description="Every UI component and screen state, with its accessibility checks, in Storybook."
        >
          <Button asChild size="sm">
            <a href="/_storybook/" target="_blank" rel="noreferrer">
              Open Storybook
            </a>
          </Button>
        </Destination>
        <Destination
          icon={<FileText />}
          title="Docs and changelog"
          description="Guides for every part of the starter, and what changed in each release."
        >
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <a href="/docs/">Read the docs</a>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <a href="/docs/changelog/">Changelog</a>
            </Button>
          </div>
        </Destination>
        <Destination
          icon={<UserRound />}
          title="Settings"
          description="Profile, appearance, security, privacy exports and the workspace."
        >
          <Button asChild size="sm">
            <Link to="/app/settings/account">Open settings</Link>
          </Button>
        </Destination>
        {admin ? (
          <Destination
            icon={<ShieldCheck />}
            title="Admin portal"
            description="Users, workspaces, plans, audit log, feature flags and health."
          >
            <Button asChild size="sm">
              {/* A full load: the server checks the portal before serving /admin. */}
              <a href="/admin/overview">Open admin</a>
            </Button>
          </Destination>
        ) : null}
      </div>
    </section>
  );
}
