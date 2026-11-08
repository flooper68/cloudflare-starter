/**
 * The feature walkthrough videos, as data: which exist, which are scripted, and where the
 * site shows them. The recorder (apps/web/media/) has one script per `scripted` video
 * with the same id; `bun run media:record` writes their files and
 * src/content/media-manifest.json; the player (components/media/) reads the manifest.
 * Plain data, no Astro or DOM. Ids are stable once published: they are file names in R2
 * and the docs' `<!-- walkthrough: <id> -->` markers.
 * docs/guides/how-to-record-walkthrough-videos.md
 */
import type { PillarId } from "./features";

/** `walkthrough`: 30–90 s with captions and chapters. `loop`: a muted 6–10 s clip. */
export type VideoKind = "walkthrough" | "loop";

/**
 * `scripted`: a recorder script exists (apps/web/media/videos/<id>.ts).
 * `planned`: in the plan, not scripted yet (`followUp` says what it needs).
 */
export type VideoStatus = "scripted" | "planned";

/** UI work in flight that changes what a video shows: re-record it once it lands. */
export type PendingChange = "demo-mode" | "container-demo";

export interface Video {
  readonly id: string;
  readonly title: string;
  readonly kind: VideoKind;
  readonly status: VideoStatus;
  /** What it shows, for the transcript intro and the docs. */
  readonly summary: string;
  /** Re-record after these land. */
  readonly rerecordAfter: readonly PendingChange[];
  /** For a planned video: what scripting it needs. */
  readonly followUp?: string;
}

export const VIDEOS: readonly Video[] = [
  {
    id: "tour",
    title: "The starter in 90 seconds",
    kind: "walkthrough",
    status: "scripted",
    summary:
      "From the home page into the app: an agent connects and writes a note, a teammate is invited, plans, admin and health.",
    rerecordAfter: ["demo-mode"],
  },
  {
    id: "agents",
    title: "Agents & MCP",
    kind: "walkthrough",
    status: "scripted",
    summary:
      "An MCP client connects through OAuth, reads and writes notes with your permissions, and stops working the moment you disconnect it.",
    rerecordAfter: ["demo-mode"],
  },
  {
    id: "accounts",
    title: "Accounts & security",
    kind: "walkthrough",
    status: "planned",
    summary:
      "Sign-up with the bot check, email verification, two-factor, recovery codes, passkeys and sessions.",
    rerecordAfter: ["demo-mode"],
    followUp:
      "A TOTP generator in the script and Chrome's virtual authenticator for the passkey chapters.",
  },
  {
    id: "workspaces",
    title: "Workspaces, billing & admin",
    kind: "walkthrough",
    status: "planned",
    summary:
      "Workspaces, invitations, roles, usage limits, trials, the admin portal, impersonation and the audit log.",
    rerecordAfter: ["demo-mode"],
    followUp:
      "A second browser for the invitee, a plan with a 10-note limit and a trial in the seed (billing seed data).",
  },
  {
    id: "privacy",
    title: "Privacy & data",
    kind: "walkthrough",
    status: "planned",
    summary:
      "Trash and restore, data export built in the background, the audit trail and account deletion.",
    rerecordAfter: ["demo-mode"],
    followUp:
      "Waiting for the export job in the recording (the queue runs locally) and a throwaway user to delete.",
  },
  {
    id: "platform",
    title: "App platform",
    kind: "walkthrough",
    status: "planned",
    summary:
      "Command palette, notifications and digests, file storage, background jobs, cron, feature flags and the Containers demo.",
    rerecordAfter: ["demo-mode", "container-demo"],
    followUp:
      "The Containers demo running beside the app (needs Docker in the recorder) and a cron trigger endpoint.",
  },
  {
    id: "infra",
    title: "Observability & ops",
    kind: "walkthrough",
    status: "planned",
    summary:
      "Health checks, error references, one trace from click to job, rate limits, security headers and analytics.",
    rerecordAfter: ["demo-mode"],
    followUp:
      "A terminal pane rendering the dev log beside the browser (a local page fed from the server's output).",
  },
  {
    id: "dx",
    title: "Built for coding agents",
    kind: "walkthrough",
    status: "planned",
    summary:
      "Clone, set up, doctor, the docs index, skills, the test pyramid and Storybook.",
    rerecordAfter: [],
    followUp:
      "Terminal scenes rendered from a recorded cast in a local page; no app UI.",
  },
  {
    id: "loop-agent-note",
    title: "An agent adds a note",
    kind: "loop",
    status: "scripted",
    summary: "An MCP client calls create_note and the note appears in Notes.",
    rerecordAfter: ["demo-mode"],
  },
  {
    id: "loop-invite",
    title: "Invite a teammate",
    kind: "loop",
    status: "scripted",
    summary: "The owner invites a teammate from the members page.",
    rerecordAfter: ["demo-mode"],
  },
  {
    id: "loop-job-mail",
    title: "A job runs, the mail arrives",
    kind: "loop",
    status: "scripted",
    summary:
      "A job is queued, the Worker's consumer runs it and the mail arrives.",
    rerecordAfter: ["demo-mode", "container-demo"],
  },
  {
    id: "loop-health",
    title: "A health check goes green",
    kind: "loop",
    status: "scripted",
    summary: "The admin portal's health card checks every binding.",
    rerecordAfter: ["demo-mode"],
  },
  {
    id: "loop-consent",
    title: "Consent, then Allow",
    kind: "loop",
    status: "scripted",
    summary:
      "An agent asks for access; the consent page says what it may do; Allow.",
    rerecordAfter: [],
  },
];

/** The clip in each pillar card on the home page. */
export const HOME_CLIPS: Readonly<Record<PillarId, string>> = {
  agents: "loop-agent-note",
  scaffold: "loop-invite",
  platform: "loop-job-mail",
  infra: "loop-health",
};

/** The walkthrough on the home page, under the pillars. */
export const HOME_WALKTHROUGH = "tour";

export function video(id: string): Video | undefined {
  return VIDEOS.find((entry) => entry.id === id);
}
