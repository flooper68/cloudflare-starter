// Composition root: owning features expose erasers; the privacy feature imports no tables here.
import { purgeAccountImages } from "./accounts";
import { redactAuditSubject } from "./audit";
import type { Database } from "./database";
import { deleteWorkspaceFiles, rememberErasureStorage } from "./files";
import type { Clock } from "./kernel";
import { eraseIdentityReferences, eraseUserExports } from "./privacy";
import { purgeWorkspaceLogos } from "./workspaces";
export function buildErasureHandlers(deps: {
  readonly db: Database;
  readonly bucket: R2Bucket;
  readonly clock: Clock;
}) {
  return {
    async eraseWorkspaceArtifacts(
      workspaceIds: readonly string[],
      userId: string
    ) {
      await rememberErasureStorage(deps, { userId, workspaceIds });
      await eraseUserExports(deps, { workspaceIds });
      await deleteWorkspaceFiles(deps, { workspaceIds });
      await purgeWorkspaceLogos(deps, { workspaceIds });
    },
    async eraseUserArtifacts(input: { userId: string; email: string }) {
      await rememberErasureStorage(deps, {
        userId: input.userId,
        workspaceIds: [],
        includeAvatar: true,
      });
      await eraseUserExports(deps, { userId: input.userId });
      await purgeAccountImages(deps, input);
      await eraseIdentityReferences(deps, input);
      await redactAuditSubject(deps, input);
    },
  };
}
