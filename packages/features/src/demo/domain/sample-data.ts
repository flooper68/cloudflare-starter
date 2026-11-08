/**
 * The sample notes a new demo workspace gets (DEMO_SAMPLE_DATA=on). Every title starts
 * with SAMPLE_PREFIX and every body says it is a sample, so nobody mistakes them for
 * someone's data. The Tasks placeholder needs no seed: its board is sample data in the
 * browser for everyone.
 */
export const SAMPLE_PREFIX = "Sample:";

export interface SampleNote {
  readonly title: string;
  readonly body: string;
  readonly comments: readonly string[];
}

export const DEMO_SAMPLE_NOTES: readonly SampleNote[] = [
  {
    title: `${SAMPLE_PREFIX} Welcome to the demo`,
    body: "This is a sample note, added to your workspace because this is a demo instance.\n\nNotes are saved in D1, scoped to your workspace, and go through the same permissions, plan limits, trash and audit log as a real feature. Edit this note, add a comment, or move it to the trash and restore it.\n\nYour account and everything in it are deleted automatically at the end of the demo period.",
    comments: [
      "Sample comment: comments live with their note and are part of your data export.",
    ],
  },
  {
    title: `${SAMPLE_PREFIX} Launch checklist`,
    body: "This is a sample note.\n\n- Pick a name, logo and accent colour\n- Choose the workspace mode and who may sign up\n- Set up email and Turnstile for each environment\n- Run bun run doctor before the first deploy\n- Point an uptime monitor at /health/ready",
    comments: [],
  },
  {
    title: `${SAMPLE_PREFIX} Product sync notes`,
    body: "This is a sample note.\n\nAttendees: Grace, Charles, you\n\n1. Pricing: keep the free plan at 50 notes.\n2. Invite flow: copy review before the release.\n3. Next sync in two weeks.",
    comments: [],
  },
];
