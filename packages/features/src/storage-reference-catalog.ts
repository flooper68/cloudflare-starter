// Composition root: each owning feature supplies its current storage references.
import { findReferencedAvatarKeys } from "./accounts";
import {
  CONTAINER_RUN_RESULT_KEY,
  findReferencedContainerRunKeys,
} from "./container-runs";
import type { Database } from "./database";
import { findReferencedFileKeys } from "./files";
import type { StorageReferenceSource } from "./storage-reconciliation";
import { findReferencedLogoKeys } from "./workspaces";

export function storageReferenceCatalog(deps: {
  readonly db: Database;
}): readonly StorageReferenceSource[] {
  return [
    {
      matches: (key) => /^users\/[^/]+\/avatar\/[^/]+$/.test(key),
      referenced: (keys) => findReferencedAvatarKeys(deps, keys),
    },
    {
      matches: (key) => /^workspaces\/[^/]+\/logo\/[^/]+$/.test(key),
      referenced: (keys) => findReferencedLogoKeys(deps, keys),
    },
    {
      matches: (key) =>
        /^workspaces\/[^/]+\/uploads\/\d{4}\/\d{2}\/[^/]+$/.test(key),
      referenced: (keys) => findReferencedFileKeys(deps, keys),
    },
    {
      matches: (key) => CONTAINER_RUN_RESULT_KEY.test(key),
      referenced: (keys) => findReferencedContainerRunKeys(deps, keys),
    },
  ];
}
