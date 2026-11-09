import { describe, expect, it } from "vitest";

import type { MediaEntry } from "../../content/media";
import { videoIds } from "../../docs/walkthroughs";
import {
  escapeHtml,
  loopHtml,
  playerHtml,
  walkthroughHtml,
} from "./player-markup";

const walkthrough: MediaEntry = {
  id: "agents",
  title: "Agents & MCP",
  kind: "walkthrough",
  hash: "0123456789ab",
  duration: 75,
  width: 1440,
  height: 900,
  audio: false,
  poster: { src: "/media/0123456789ab/agents.jpg", bytes: 1 },
  captions: { src: "/media/0123456789ab/agents.vtt", bytes: 1 },
  chapters: [
    { start: 0, title: "No agents yet", caption: "No agents connected yet." },
    { start: 8, title: "It <asks>", caption: "An agent asks to connect." },
  ],
  sources: [
    { src: "/media/0123456789ab/agents.mp4", type: "video/mp4", bytes: 1 },
    { src: "/media/0123456789ab/agents.webm", type: "video/webm", bytes: 1 },
  ],
  encoder: "ffmpeg",
};

describe("walkthroughHtml", () => {
  const html = walkthroughHtml(walkthrough);

  it("loads nothing before Play and never plays on its own", () => {
    expect(html).toContain('preload="none"');
    expect(html).not.toMatch(/autoplay/);
    expect(html).toContain(
      'aria-label="Play Agents &amp; MCP, 1 minute 15 seconds"'
    );
  });

  it("has captions on by default, MP4 first", () => {
    expect(html).toContain(
      '<track kind="captions" srclang="en" label="English" data-src="/media/0123456789ab/agents.vtt" default>'
    );
    expect(html.indexOf("video/mp4")).toBeLessThan(html.indexOf("video/webm"));
  });

  it("lists the chapters as buttons and the captions as a transcript, escaped", () => {
    expect(html).toContain('data-start="8"');
    expect(html).toContain("It &lt;asks&gt;");
    expect(html).toContain("<summary>Read the transcript</summary>");
    expect(html).toContain("1:15 · 2 chapters");
    expect(html).toContain("No sound");
  });
});

describe("loopHtml", () => {
  it("is muted, looping and paused until the script sees it", () => {
    const html = loopHtml({
      ...walkthrough,
      kind: "loop",
      captions: null,
      chapters: [],
    });
    expect(html).toMatch(/<video[^>]* muted loop playsinline preload="none"/);
    expect(html).not.toMatch(/autoplay/);
    expect(html).toContain('aria-label="Play clip: Agents &amp; MCP"');
  });
});

describe("playerHtml", () => {
  it("shows the coming-soon poster for a video not recorded yet", () => {
    expect(playerHtml(undefined, "Soon")).toContain("Clip coming soon");
  });

  it("escapes HTML", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;"
    );
  });
});

describe("docs ::video directives", () => {
  it("finds the ids outside code blocks", () => {
    expect(
      videoIds(
        '::video{id="tour" title="Tour"}\n```markdown\n::video{id="agents"}\n```\n  ::video{poster="x" id="privacy"}\n'
      )
    ).toEqual(["tour", "privacy"]);
  });
});
