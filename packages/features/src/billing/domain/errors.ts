import { DomainError } from "../../kernel";
import type { FeatureKey, MetricKey } from "./catalog";
import type { UpgradeOptions } from "./upgrade";

/**
 * Adding to a metric would pass the workspace's limit. `details` tell a client or an agent
 * what was refused and what would lift it.
 */
export class LimitReachedError extends DomainError {
  static readonly CODE = "LIMIT_REACHED";

  constructor(input: {
    readonly metric: MetricKey;
    readonly limit: number;
    readonly current: number;
    readonly increment: number;
    readonly planId: string;
    readonly upgrade: UpgradeOptions;
  }) {
    super(
      "limit_reached",
      `This workspace has reached its ${input.metric} limit (${input.limit}) on the ${input.planId} plan`,
      LimitReachedError.CODE,
      input
    );
  }
}

/** The workspace's plan does not include a gated feature. */
export class FeatureNotIncludedError extends DomainError {
  static readonly CODE = "FEATURE_NOT_INCLUDED";

  constructor(input: {
    readonly feature: FeatureKey;
    readonly planId: string;
    readonly upgrade: UpgradeOptions;
  }) {
    super(
      "limit_reached",
      `The ${input.planId} plan does not include ${input.feature}`,
      FeatureNotIncludedError.CODE,
      input
    );
  }
}

/** A plan, add-on, feature or metric id that is not in the catalog. */
export class UnknownCatalogKeyError extends DomainError {
  constructor(
    kind: "plan" | "addon" | "feature" | "metric" | "key",
    key: string
  ) {
    super("invalid_input", `Unknown ${kind}: ${key}`);
  }
}

/** A trial on a plan that is its own fallback could never end. */
export class TrialWithoutFallbackError extends DomainError {
  constructor(planId: string) {
    super(
      "invalid_input",
      `The ${planId} plan cannot be a trial: it has no other plan to fall back to`
    );
  }
}

/** Checkout and the customer portal need BILLING=provider and a provider adapter. */
export class BillingUnavailableError extends DomainError {
  constructor(reason: string) {
    super("unavailable", reason);
  }
}

/** The workspace has no subscription with the billing provider yet. */
export class NoProviderCustomerError extends DomainError {
  constructor() {
    super(
      "unavailable",
      "This workspace has no subscription with the billing provider yet: start a checkout first"
    );
  }
}
