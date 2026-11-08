// Accounts domain: the security notifications, the new-sign-in rule and connected agents.

export { AgentNotFoundError } from "./agent-errors";
export { SIGN_UP_METHODS, signedUpEvent } from "./analytics-events";
export {
  type AgentGrantRow,
  type AgentRefreshTokenRow,
  type AgentSessionRow,
  agentHost,
  type ConnectedAgent,
  consentCoversToken,
  summarizeConnectedAgents,
} from "./connected-agents";
export {
  isNewSignIn,
  NEW_ACCOUNT_GRACE_MS,
  type OtherSession,
} from "./new-sign-in";
export {
  newSignInNotification,
  passwordChangedNotification,
  securityFactorChangedNotification,
} from "./notifications";
export {
  type AccountSettingsInput,
  accountSettingsSchema,
} from "./preferences";
export { SecondFactorRequiredError } from "./security-error";
export {
  type SecurityDecision,
  type SecuritySettings,
  securityDecision,
  securitySettingsSchema,
  TWO_FACTOR_MODES,
} from "./security-policy";
