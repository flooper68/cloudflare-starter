import type { inferRouterOutputs } from "@trpc/server";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react";

import { useAuth } from "@/components/shared/spa/auth-context";
import { trpc } from "@/lib/trpc/client";
import { type AsyncState, useAsync } from "@/lib/use-async";
import type { AppRouter } from "@/server/trpc/router";

type WorkspaceList = inferRouterOutputs<AppRouter>["workspace"]["list"];
export type WorkspaceSummary = WorkspaceList["items"][number];
export type WorkspaceMode = "personal" | "single" | "multi";

export interface WorkspaceContextValue {
  readonly mode: WorkspaceMode;
  readonly list: AsyncState<WorkspaceList>;
  /** The workspace every page acts in; pages pass its id with each call. */
  readonly active: WorkspaceSummary | null;
  readonly switchTo: (workspaceId: string) => Promise<void>;
  readonly create: (name: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/**
 * The signed-in user's workspaces and the active one. The server keeps the default
 * (the workspace switched to last, shared with MCP clients); the SPA reads it once and
 * passes `workspaceId` explicitly on every workspace call.
 */
export function WorkspaceProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const { workspace } = useAuth();
  const list = useAsync(() => trpc.workspace.list.query(), "workspaces");
  const { refetch } = list;

  const switchTo = useCallback(
    async (workspaceId: string) => {
      await trpc.workspace.switch.mutate({ workspaceId });
      await refetch();
    },
    [refetch]
  );
  const create = useCallback(
    async (name: string) => {
      await trpc.workspace.create.mutate({ name });
      await refetch();
    },
    [refetch]
  );

  const value = useMemo<WorkspaceContextValue>(() => {
    const active =
      list.data?.items.find(
        (item) => item.id === list.data?.activeWorkspaceId
      ) ?? null;
    return { mode: workspace.mode, list, active, switchTo, create };
  }, [workspace.mode, list, switchTo, create]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}
