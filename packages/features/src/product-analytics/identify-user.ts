import type { AnalyticsContext, ProductAnalytics } from "../platform";
import {
  IDENTIFY_TRAITS_LAYOUT,
  type IdentifyTraitValues,
  identifyTraitsSchema,
} from "./domain";

/**
 * Records the user's current traits in their workspace (Segment `identify`): only the
 * catalog's traits (role, workspace size bucket, plan), never a name or an email. Call it
 * when they change: a new workspace, joining one. Invalid traits or an anonymous context
 * are dropped (returns false), like `trackEvent`.
 */
export function identifyUser(
  deps: { readonly analytics: ProductAnalytics },
  context: AnalyticsContext,
  traits: IdentifyTraitValues
): boolean {
  const parsed = identifyTraitsSchema.safeParse(traits);
  if (!parsed.success || !context.userId) return false;
  deps.analytics.identify(context, {
    traits: parsed.data,
    layout: IDENTIFY_TRAITS_LAYOUT,
  });
  return true;
}
