/**
 * Every recorder script, by id. The ids are the `scripted` videos of
 * src/content/videos.ts; media/media.test.ts checks that the two agree.
 */
import { agents } from "./agents";
import {
  loopAgentNote,
  loopConsent,
  loopHealth,
  loopInvite,
  loopJobMail,
} from "./loops";
import { tour } from "./tour";
import type { VideoScript } from "./types";

export const SCRIPTS: readonly VideoScript[] = [
  tour,
  agents,
  loopAgentNote,
  loopInvite,
  loopJobMail,
  loopHealth,
  loopConsent,
];
