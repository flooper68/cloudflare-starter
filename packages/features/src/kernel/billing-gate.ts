/**
 * What a feature asks of billing: whether the workspace's plan includes a feature, whether
 * a usage limit allows more, and to count usage. Implemented by the billing feature
 * (`createBillingGate`) and passed to use cases as a dependency, so features that billing
 * itself builds on (workspaces, files) call it without an import cycle.
 *
 * Keys are the catalog's (`packages/features/src/billing/domain/catalog.ts`); an unknown
 * key is a programming error and throws. Check order in a use case: the permission
 * (`requirePermission`) first, then `requireFeature` / `requireLimit`, then flags.
 */
export interface BillingGate {
  /** Throws a `limit_reached` DomainError unless the workspace's plan includes `feature`. */
  requireFeature(workspaceId: string, feature: string): Promise<void>;
  /**
   * Throws a `limit_reached` DomainError when adding `increment` to the workspace's
   * current value of `metric` would exceed its limit.
   */
  requireLimit(
    workspaceId: string,
    metric: string,
    increment: number
  ): Promise<void>;
  /** Adds `amount` to a period metric's counter for the current period. */
  recordUsage(
    workspaceId: string,
    metric: string,
    amount: number
  ): Promise<void>;
  /** A workspace was just created: starts its plan (and trial) when billing is on. */
  workspaceCreated(workspaceId: string): Promise<void>;
}
