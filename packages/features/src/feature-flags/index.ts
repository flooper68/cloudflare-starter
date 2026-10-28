// Feature flags: the catalog, the typed evaluation features call, and the admin use cases.
// The provider (D1, none, or a vendor) is the FeatureFlags port in platform/.
export {
  type ClientFlagKey,
  type ClientFlags,
  FLAGS,
  type FlagDefinition,
  type FlagKey,
  type FlagRolloutBy,
  type FlagRuleInput,
  FlagStoreUnavailableError,
  type FlagSubject,
  type FlagType,
  type FlagValueOf,
  FlagValueTypeError,
  flagRuleSchema,
  flagRulesSchema,
  flagUpdateSchema,
  UnknownFlagError,
} from "./domain";
export { evaluateClientFlags } from "./evaluate-client-flags";
export { evaluateFlag } from "./evaluate-flag";
export { type FlagOverview, listFlags } from "./list-flags";
export { setFlagRules } from "./set-flag-rules";
export { updateFlag } from "./update-flag";
