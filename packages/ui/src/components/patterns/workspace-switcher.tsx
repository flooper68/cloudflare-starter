import { Check, Plus } from "lucide-react";
import { type FormEvent, type ReactNode, useRef, useState } from "react";

import { Button } from "../button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../dialog";
import { errorMessage } from "../error-state";
import { Field } from "../field";
import { Input } from "../input";
import {
  SidebarMenuItem,
  SidebarMenuLabel,
  SidebarMenuSeparator,
  SidebarWorkspaceSwitcher,
} from "./app-shell";

export interface WorkspaceOption {
  readonly id: string;
  readonly name: string;
  readonly kind: "personal" | "shared";
  /** The user's role there, shown next to the name. */
  readonly role: string;
}

export interface WorkspaceSwitcherProps {
  readonly workspaces: readonly WorkspaceOption[];
  readonly activeId: string;
  /** Called with the chosen workspace's id. Without it, no workspace list is shown. */
  readonly onSwitch?: (workspaceId: string) => void;
  /** Creates a workspace by name; shows "Create workspace" when given. Rejects to show an error. */
  readonly onCreate?: (name: string) => Promise<void>;
  /** Account items after the workspaces: SidebarMenuItem, SidebarMenuLabel, SidebarMenuSeparator. */
  readonly children?: ReactNode;
}

/**
 * The sidebar's workspace menu for apps where people belong to several workspaces: the
 * current workspace's name as the trigger, the other workspaces to switch to, "Create
 * workspace" (a small dialog), then the account items. Without `onSwitch` it is just the
 * workspace name with the account items, for apps with one workspace per user or app.
 * Lives inside `AppShell`.
 */
export function WorkspaceSwitcher({
  workspaces,
  activeId,
  onSwitch,
  onCreate,
  children,
}: WorkspaceSwitcherProps) {
  const [creating, setCreating] = useState(false);
  // The menu returns focus to its trigger as it closes; not when it opened the dialog.
  const keepFocus = useRef(false);
  const active = workspaces.find((workspace) => workspace.id === activeId);

  return (
    <>
      <SidebarWorkspaceSwitcher
        name={active?.name}
        onCloseAutoFocus={(event) => {
          if (keepFocus.current) event.preventDefault();
          keepFocus.current = false;
        }}
      >
        {onSwitch ? (
          <>
            <SidebarMenuLabel>Workspaces</SidebarMenuLabel>
            {workspaces.map((workspace) => (
              <SidebarMenuItem
                key={workspace.id}
                icon={
                  workspace.id === activeId ? (
                    <Check aria-hidden />
                  ) : (
                    <span aria-hidden className="size-4" />
                  )
                }
                shortcut={
                  <span className="text-xs text-fg-muted">
                    {workspace.kind === "personal"
                      ? "Personal"
                      : workspace.role}
                  </span>
                }
                onSelect={() => {
                  if (workspace.id !== activeId) onSwitch(workspace.id);
                }}
              >
                {workspace.name}
              </SidebarMenuItem>
            ))}
            {onCreate ? (
              <SidebarMenuItem
                icon={<Plus aria-hidden />}
                onSelect={() => {
                  keepFocus.current = true;
                  setCreating(true);
                }}
              >
                Create workspace
              </SidebarMenuItem>
            ) : null}
            {children ? <SidebarMenuSeparator /> : null}
          </>
        ) : null}
        {children}
      </SidebarWorkspaceSwitcher>
      {onCreate ? (
        <CreateWorkspaceDialog
          open={creating}
          onOpenChange={setCreating}
          onCreate={onCreate}
        />
      ) : null}
    </>
  );
}

function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give the workspace a name");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate(name.trim());
      setName("");
      onOpenChange(false);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form onSubmit={(event) => void submit(event)}>
          <DialogHeader>
            <DialogTitle>Create workspace</DialogTitle>
            <DialogDescription>
              A shared space for a team's files and members. You will be its
              owner.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field label="Name" error={error}>
              <Input
                value={name}
                maxLength={80}
                placeholder="Acme Robotics"
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
