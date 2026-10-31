import { describe, expect, it } from "vitest";
import {
  type SecuritySettings,
  securityDecision,
  securitySettingsSchema,
} from "./security-policy";

const settings: SecuritySettings = {
  mode: "optional",
  emailOtp: false,
  trustedDeviceDays: 0,
  passkeys: true,
};
describe("second-factor policy", () => {
  it("keeps optional enrollment optional but never treats enrollment as session verification", () => {
    expect(
      securityDecision(settings, {
        role: "user",
        enrolled: false,
        verified: false,
      })
    ).toBe("allowed");
    expect(
      securityDecision(settings, {
        role: "user",
        enrolled: true,
        verified: false,
      })
    ).toBe("step_up_required");
    expect(
      securityDecision(settings, {
        role: "user",
        enrolled: true,
        verified: true,
      })
    ).toBe("allowed");
  });
  it("requires enrollment for the configured roles", () => {
    expect(
      securityDecision(
        { ...settings, mode: "required" },
        { role: "user", enrolled: false, verified: false }
      )
    ).toBe("enrollment_required");
    expect(
      securityDecision(
        { ...settings, mode: "required-for-admins" },
        { role: "admin", enrolled: false, verified: false }
      )
    ).toBe("enrollment_required");
    expect(
      securityDecision(
        { ...settings, mode: "required-for-admins" },
        { role: "user", enrolled: false, verified: false }
      )
    ).toBe("allowed");
    expect(
      securityDecision(
        { ...settings, mode: "off" },
        { role: "admin", enrolled: true, verified: false }
      )
    ).toBe("allowed");
  });
  it("requires explicit valid settings and bounds device trust", () => {
    expect(securitySettingsSchema.safeParse({}).success).toBe(false);
    const env = {
      TWO_FACTOR: "optional",
      TWO_FACTOR_EMAIL_OTP: "off",
      TWO_FACTOR_TRUSTED_DEVICE_DAYS: "0",
      PASSKEYS: "on",
    };
    expect(securitySettingsSchema.parse(env)).toEqual(settings);
    expect(
      securitySettingsSchema.safeParse({
        ...env,
        TWO_FACTOR_TRUSTED_DEVICE_DAYS: "31",
      }).success
    ).toBe(false);
    expect(
      securitySettingsSchema.safeParse({
        ...env,
        TWO_FACTOR_TRUSTED_DEVICE_DAYS: undefined,
      }).success
    ).toBe(false);
  });
});
