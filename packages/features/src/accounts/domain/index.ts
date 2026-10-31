// Accounts domain: the security notifications and the new-sign-in rule.

export { SIGN_UP_METHODS, signedUpEvent } from "./analytics-events";
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
