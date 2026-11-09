/**
 * The public docs site (/docs): which repository files it publishes, where their source
 * lives on GitHub, and which docs may stay out of the navigation. Read by the content
 * collection (src/content.config.ts), the link rewriting (links.ts), the navigation
 * (nav.ts) and test/architecture/docs.test.ts.
 * docs/guides/how-to-publish-docs-and-landing.md
 */
export const DOCS = {
  /** Site name in the docs header and the page titles. */
  siteName: "Cloudflare Starter",
  /** Where "Edit this page" and links to non-published repository files point. */
  repoUrl: "https://github.com/flooper68/cloudflare-starter",
  /** The branch those links use. */
  branch: "main",
  /**
   * Repository files the site publishes, as globs from the repository root. Each becomes
   * one page; a relative link to any other file becomes a link to it on GitHub.
   */
  sources: [
    "docs/**/*.md",
    "apps/*/README.md",
    "packages/*/README.md",
    "packages/ui/CONVENTIONS.md",
    // Rendered as release notes by src/pages/docs/changelog.astro, not as Markdown.
    "CHANGELOG.md",
  ],
  /**
   * URL segments (after /docs/) for files the default rule would map badly. The default:
   * the path without `.md`, without a leading `docs/` and a trailing `README`, lower case.
   */
  routes: {} as Record<string, string>,
  /** The file whose sections and tables become the navigation. */
  navSource: "docs/README.md",
  /** The first navigation section, before those of the navigation source. */
  start: {
    title: "Start",
    items: [
      { path: "docs/README.md", label: "Overview" },
      { path: "docs/start/README.md", label: "Start a project" },
      { path: "docs/start/run-locally.md", label: "Run it locally" },
      { path: "docs/start/deploy.md", label: "Deploy" },
      { path: "docs/start/what-it-costs.md", label: "What it costs" },
      { path: "CHANGELOG.md", label: "Changelog" },
      { path: "docs/roadmap.md", label: "Roadmap" },
    ],
  },
  /**
   * The roadmap page: its Markdown is the title and intro, and the docs page renders the
   * planned features of `ROADMAP` (src/content/features.ts) under it (DocsRoadmap.astro).
   */
  roadmap: "docs/roadmap.md",
  /**
   * Docs under docs/ that may stay out of the navigation, each with its reason. Every
   * other docs/**\/*.md must be linked from the navigation source (docs.test.ts).
   */
  exempt: {
    "docs/decisions/0000-template.md":
      "The ADR template; linked from docs/decisions/README.md, not a doc to read on its own",
  } as Record<string, string>,
} as const;
