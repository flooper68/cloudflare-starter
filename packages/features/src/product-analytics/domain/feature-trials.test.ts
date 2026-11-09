import { describe, expect, it } from "vitest";

import {
  FEATURE_TRIAL_AUTH_PATHS,
  FEATURE_TRIAL_CLIENT_EVENTS,
  FEATURE_TRIAL_PROCEDURES,
  featureTriedEvent,
  TRIED_FEATURE_LABELS,
  TRIED_FEATURES,
} from "./feature-trials";

describe("feature trials", () => {
  it("names a feature of the list for every trigger", () => {
    for (const feature of [
      ...Object.values(FEATURE_TRIAL_PROCEDURES),
      ...Object.values(FEATURE_TRIAL_CLIENT_EVENTS),
      ...Object.values(FEATURE_TRIAL_AUTH_PATHS),
    ])
      expect(TRIED_FEATURES).toContain(feature);
  });

  it("labels every feature", () => {
    expect(Object.keys(TRIED_FEATURE_LABELS).sort()).toEqual(
      [...TRIED_FEATURES].sort()
    );
  });

  it("accepts only listed features", () => {
    expect(
      featureTriedEvent.properties.safeParse({ feature: "notes" }).success
    ).toBe(true);
    expect(
      featureTriedEvent.properties.safeParse({ feature: "sudo" }).success
    ).toBe(false);
  });
});
