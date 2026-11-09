import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { markdownToHtml } from "satteri";
import { beforeAll, describe, expect, it } from "vitest";

import { EMPTY_MEDIA, MEDIA_MANIFEST } from "./media";
import { docsKitPlugins } from "./plugin";
import type { ScreensManifest } from "./shots";

let root: string;

const image = (file: string, callouts: { x: number; y: number }[] = []) => ({
  file,
  width: 1440,
  height: 900,
  bytes: 1000,
  callouts,
});

const MANIFEST: ScreensManifest = {
  version: 1,
  shots: {
    agents: {
      path: "/app/settings/agents",
      alt: "Connected agents",
      variants: {
        dark: image("agents.dark.webp", [{ x: 74, y: 36 }]),
        light: image("agents.light.webp", [{ x: 73, y: 35 }]),
      },
    },
  },
};

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "docs-kit-"));
  mkdirSync(join(root, "docs/images/screens"), { recursive: true });
  mkdirSync(join(root, "docs/features"), { recursive: true });
  writeFileSync(
    join(root, "docs/images/screens/manifest.json"),
    JSON.stringify(MANIFEST)
  );
});

function render(markdown: string): string {
  const repoRoot = pathToFileURL(`${root}/`);
  const result = markdownToHtml(markdown, {
    features: { directive: true },
    fileURL: pathToFileURL(join(root, "docs/features/x.md")),
    mdastPlugins: docsKitPlugins(repoRoot) as never,
  }) as { html: string };
  return result.html;
}

describe("docs kit plugin", () => {
  it("puts text directives back as text", () => {
    expect(render("At 10:30 see a:b and Settings:Account.")).toContain(
      "At 10:30 see a:b and Settings:Account."
    );
  });

  it("renders a screenshot with measured callouts, both themes", () => {
    const html = render(
      ':::screenshot{shot="agents"}\n- **Disconnect** ends access\n:::\n'
    );
    expect(html).toContain('data-variant="dark"');
    expect(html).toContain('data-variant="light"');
    expect(html).toContain('src="../images/screens/agents.dark.webp"');
    expect(html).toContain('alt="Connected agents"');
    expect(html).toContain("left:74%;top:36%");
    expect(html).toContain("left:73%;top:35%");
    expect(html).toMatch(
      /<ol>\s*<li><strong>Disconnect<\/strong> ends access<\/li>/
    );
  });

  it("lets a (x%, y%) prefix place a callout", () => {
    const html = render(
      ':::screenshot{shot="agents"}\n- (10%, 20%) **Here** it is\n:::\n'
    );
    expect(html).toContain("left:10%;top:20%");
    expect(html).not.toContain("(10%, 20%)");
  });

  it("fails on a callout without a position", () => {
    expect(() =>
      render(':::screenshot{shot="agents"}\n- one\n- two\n:::\n')
    ).toThrow("callout 2 has no position");
  });

  it("fails on a missing screenshot", () => {
    expect(() => render('::shot{id="nope" alt="x"}\n')).toThrow(
      'Docs screenshot "nope" is not in'
    );
  });

  it("fails on an unknown directive", () => {
    expect(() => render("::sparkles\n")).toThrow("unknown docs component");
    expect(() => render(":::sparkles\nx\n:::\n")).toThrow(
      "unknown docs component"
    );
  });

  it("renders steps with a screenshot per step", () => {
    const html = render(
      ':::steps\n1. **Open** Settings\n   ::shot{id="agents"}\n2. **Disconnect** it\n:::\n'
    );
    expect(html).toContain('<div class="dk-steps">');
    expect(html).toContain('<div class="dk-shot" data-plain="">');
    expect(html).toContain("<ol>");
  });

  it("renders tabs with ARIA ids and every panel", () => {
    const html = render(
      ':::tabs\n```bash title="bun"\nbun run x\n```\n```json title="MCP"\n{}\n```\n:::\n'
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain('id="dk-tabs-1-1-tab" aria-controls="dk-tabs-1-1"');
    expect(html).toContain('id="dk-tabs-1-2"');
    expect(html).toContain("bun run x");
  });

  it("renders settings, callouts, compare, prompt and by hand", () => {
    const html = render(
      [
        ":::settings",
        "- TWO_FACTOR = optional (off | optional | required) Who must set it up",
        ":::",
        "",
        ':::decision{title="Why"}',
        "Because.",
        ":::",
        "",
        ":::compare",
        "::before[A stack trace]",
        "::after[A **reference**]",
        ":::",
        "",
        ":::prompt",
        "```text",
        "Set up sign-in.",
        "```",
        ":::",
        "",
        ":::byhand",
        "1. Do it.",
        ":::",
        "",
        '::reviewed{date="2026-11-08"}',
      ].join("\n")
    );
    expect(html).toContain("<code>TWO_FACTOR</code>");
    expect(html).toContain('<li data-default=""><code>optional</code>');
    expect(html).toContain('data-kind="decision"');
    expect(html).toContain('data-side="after"');
    expect(html).toContain("<strong>reference</strong>");
    expect(html).toContain('class="dk-prompt"');
    expect(html).toContain('<details class="dk-byhand">');
    expect(html).toContain('<time datetime="2026-11-08">8 Nov 2026</time>');
  });

  it("renders a flow and a video poster", () => {
    const html = render(
      '::flow[Agent -> Consent -> Tool call]\n\n::video{id="agents" poster="agents" title="Agents walkthrough"}\n'
    );
    expect(html).toContain('<figure class="dk-flow" data-docs-diagram=""');
    expect(html).toContain("Video coming soon");
    expect(html).toContain('alt="Video coming soon: Agents walkthrough"');
  });

  it("plays a recorded video from the shared media manifest", () => {
    const entry = {
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
      chapters: [{ start: 0, title: "Start", caption: "No agents yet." }],
      sources: [
        { src: "/media/0123456789ab/agents.mp4", type: "video/mp4", bytes: 1 },
      ],
      encoder: "ffmpeg",
    };
    mkdirSync(join(root, "apps/web/src/content"), { recursive: true });
    writeFileSync(
      join(root, MEDIA_MANIFEST),
      JSON.stringify({ version: 1, videos: { agents: entry } })
    );
    const html = render(
      '::video{id="agents" poster="agents" title="Agents walkthrough"}\n'
    );
    expect(html).toContain('aria-label="Video: Agents &amp; MCP"');
    expect(html).toContain('data-src="/media/0123456789ab/agents.vtt"');
    expect(html).not.toContain("Video coming soon");
    writeFileSync(join(root, MEDIA_MANIFEST), JSON.stringify(EMPTY_MEDIA));
  });
});
