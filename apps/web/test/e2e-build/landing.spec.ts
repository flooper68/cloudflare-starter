/**
 * The home page as built: prerendered (the same HTML signed in or out) under one policy,
 * its calls to action, the feature map from src/content/features.ts (mouse, keyboard,
 * filter, list), what's next from the roadmap, the calm page under reduced motion, the phone menu, and the public pages
 * at phone width without sideways scrolling. Every test fails on a CSP violation
 * (fixtures.ts).
 */
import { GROUPS, PILLARS, roadmap } from "../../src/content/features";
import { START_PROMPT } from "../../src/landing/content";
import { PRERENDERED_PAGE_CSP } from "../../src/server/security-headers";
import { expect, test } from "../e2e/fixtures";

const GITHUB = "https://github.com/flooper68/cloudflare-starter";

test.describe("home page", () => {
  test("is static HTML under one policy, with the calls to action", async ({
    page,
    request,
  }) => {
    const response = await request.get("/");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe(
      "public, max-age=0, must-revalidate, no-transform"
    );
    expect(response.headers()["content-security-policy"]).toBe(
      PRERENDERED_PAGE_CSP
    );
    const html = await response.text();
    expect(html).not.toContain("astro-island");
    // Technology is named once, in the footer's "Under the hood".
    expect(html.match(/Better Auth/g)).toHaveLength(1);

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Ship an agent-native app today."
    );
    const header = page.getByRole("banner");
    await expect(
      header.getByRole("link", { name: "Try the demo" })
    ).toHaveAttribute("href", "/sign-up");
    await expect(header.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in"
    );
    await expect(
      header.getByRole("button", { name: /Switch to the (light|dark) theme/ })
    ).toBeVisible();
    for (const name of ["Docs", "Changelog", "GitHub"])
      await expect(
        header
          .getByRole("navigation", { name: "Site" })
          .getByRole("link", { name })
      ).toBeVisible();

    const main = page.getByRole("main");
    await expect(
      main.getByRole("link", { name: "Try the demo app" })
    ).toHaveCount(2);
    await expect(
      main.getByRole("link", { name: "View on GitHub" }).first()
    ).toHaveAttribute("href", GITHUB);
    await expect(
      main.getByRole("img", { name: /One app in the middle/ })
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Four things you don't have to build" })
        .getByRole("heading", { level: 3 })
    ).toHaveText(PILLARS.map((pillar) => pillar.title));
    await expect(
      page.getByRole("region", { name: "What's new" }).getByRole("link")
    ).toHaveCount(5);
  });

  test("Try the demo app leads to sign-up", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("main")
      .getByRole("link", { name: "Try the demo app" })
      .first()
      .click();
    await expect(page).toHaveURL(/\/sign-up$/);
  });
});

test.describe("feature map", () => {
  test("shows a group's card on hover and its features", async ({ page }) => {
    await page.goto("/");
    const map = page.getByRole("group", { name: "Feature map" });
    await expect(map.getByRole("button")).toHaveCount(
      1 + PILLARS.length + GROUPS.length
    );
    await map.getByRole("button", { name: "Workspaces & billing" }).hover();
    const card = page.getByRole("complementary", { name: "Details" });
    await expect(
      card.getByRole("heading", { name: "Workspaces, billing & admin" })
    ).toBeVisible();
    await expect(
      card.getByRole("listitem").filter({ visible: true })
    ).toHaveCount(5);
    await expect(
      card
        .getByRole("link", { name: "Read the docs" })
        .filter({ visible: true })
    ).toHaveAttribute("href", "/docs/features/workspaces/");
  });

  test("is one tab stop, and arrow keys move between the nodes", async ({
    page,
  }) => {
    await page.goto("/");
    const map = page.getByRole("group", { name: "Feature map" });
    const app = map.getByRole("button", { name: "Your app" });
    await app.focus();
    await expect(app).toHaveAttribute("tabindex", "0");
    await page.keyboard.press("ArrowRight");
    const first = map.getByRole("button", { name: /Agent-native/ });
    await expect(first).toBeFocused();
    await expect(first).toHaveAttribute("aria-current", "true");
    await expect(app).toHaveAttribute("tabindex", "-1");
    await page.keyboard.press("ArrowRight");
    await expect(
      map.getByRole("button", { name: "Agents", exact: true })
    ).toBeFocused();
    const card = page.getByRole("complementary", { name: "Details" });
    await expect(
      card.getByRole("heading", { name: "Agents & MCP" })
    ).toBeVisible();
    // Tab leaves the map for the card's link.
    await page.keyboard.press("Tab");
    await expect(
      card
        .getByRole("link", { name: "Read the docs" })
        .filter({ visible: true })
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("End");
    await expect(
      map.getByRole("button", { name: "Observability" })
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(app).toBeFocused();
  });

  test("filters by pillar and switches to the list", async ({ page }) => {
    await page.goto("/");
    const filters = page.getByRole("group", { name: "Filter by pillar" });
    await filters.getByRole("button", { name: "Infra solved" }).click();
    await expect(
      filters.getByRole("button", { name: "Infra solved" })
    ).toHaveAttribute("aria-pressed", "true");
    const map = page.getByRole("group", { name: "Feature map" });
    await expect(
      map.getByRole("button", { name: "Agents", exact: true })
    ).toHaveClass(/is-filtered/);
    await expect(
      map.getByRole("button", { name: "Observability" })
    ).not.toHaveClass(/is-filtered/);

    await page.getByRole("button", { name: "List" }).click();
    await expect(map).toBeHidden();
    await page.locator(".fm-summary", { hasText: "Infra solved" }).click();
    await expect(
      page.getByRole("link", { name: "Health checks" })
    ).toBeVisible();
  });
});

test.describe("start prompt", () => {
  test("Copy prompt puts the prompt on the clipboard", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    const section = page.getByRole("region", { name: "Start with one prompt" });
    await expect(section.getByRole("figure")).toContainText(
      "Prompt for your coding agent"
    );
    await expect(section.locator("code")).toHaveText(START_PROMPT);
    await section.getByRole("button", { name: "Copy prompt" }).click();
    await expect(section.getByRole("status")).toHaveText(
      "Prompt copied. Paste it into your coding agent."
    );
    await expect(section.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      START_PROMPT
    );
  });

  test("without the Clipboard API it selects the prompt instead", async ({
    page,
  }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "clipboard", { value: undefined })
    );
    await page.goto("/");
    const section = page.getByRole("region", { name: "Start with one prompt" });
    await section.getByRole("button", { name: "Copy prompt" }).click();
    await expect(section.getByRole("status")).toContainText(
      "The prompt is selected: press"
    );
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(
      START_PROMPT
    );
  });
});

test.describe("what's next", () => {
  // A project's strip empties the roadmap, and the page then leaves the section out.
  test.skip(roadmap().length === 0, "no planned features on the roadmap");

  test("lists the roadmap in order, each planned, linking to its entry", async ({
    page,
  }) => {
    await page.goto("/");
    const section = page.getByRole("region", { name: "What's next" });
    const items = section.getByRole("listitem");
    await expect(items).toHaveCount(roadmap().length);
    for (const [index, item] of roadmap().entries()) {
      await expect(items.nth(index)).toContainText(item.name);
      await expect(items.nth(index)).toContainText("Planned");
      await expect(items.nth(index).getByRole("link")).toHaveAttribute(
        "href",
        `/docs/roadmap/#${item.id}`
      );
    }
    await expect(
      section.getByRole("link", { name: "The roadmap" })
    ).toHaveAttribute("href", "/docs/roadmap/");
    await expect(
      page
        .getByRole("contentinfo")
        .getByRole("navigation", { name: "Product" })
        .getByRole("link", { name: "Roadmap" })
    ).toHaveAttribute("href", "/docs/roadmap/");
  });
});

test.describe("what it costs", () => {
  test("is one receipt with the allowances and the prices above them", async ({
    page,
  }) => {
    await page.goto("/");
    const section = page.getByRole("region", {
      name: "One platform, one bill.",
    });
    await expect(section.getByRole("table")).toHaveCount(0);
    const lines = section.getByRole("list", { name: "Included every month" });
    await expect(lines.getByRole("listitem")).toHaveCount(8);
    await expect(lines.getByRole("listitem").first()).toHaveText(
      /App, API and agents.*10M requests.*then \$0\.30 \/ million/
    );
    await expect(section.getByText("$5.00 / month")).toBeVisible();
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the page is static and the hero complete", async ({ page }, info) => {
    await page.goto("/");
    const running = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((animation) => animation.playState === "running").length
    );
    expect(running).toBe(0);
    const scene = page.getByRole("img", { name: /One app in the middle/ });
    await expect(scene).toBeVisible();
    // Every service tile of the scene is drawn, at full opacity.
    const opacities = await scene
      .locator(".hs-tile")
      .evaluateAll((tiles) =>
        tiles.map((tile) => getComputedStyle(tile).opacity)
      );
    expect(opacities).toEqual(["1", "1", "1", "1", "1", "1"]);
    await expect(page.locator(".fm-pulse")).toBeHidden();
    await info.attach("reduced-motion.png", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });
});

test.describe("phone width", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  for (const path of [
    "/",
    "/docs/",
    "/docs/guides/how-to-setup-d1/",
    "/docs/roadmap/",
    "/nope/",
  ])
    test(`${path} does not scroll sideways`, async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

  test("the header has the logo, the button and a menu", async ({ page }) => {
    await page.goto("/");
    const header = page.getByRole("banner");
    await expect(
      header.getByRole("link", { name: "Try the demo" })
    ).toBeVisible();
    await expect(header.getByRole("link", { name: "Sign in" })).toBeHidden();
    await header.locator("summary").click();
    const menu = header.getByRole("navigation", { name: "Menu" });
    await expect(menu.getByRole("link", { name: "Sign in" })).toBeVisible();
    const theme = header.getByRole("group", { name: "Theme" });
    await theme.getByRole("button", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(theme.getByRole("button", { name: "Light" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  test("each receipt line stays on its two lines", async ({ page }) => {
    await page.goto("/");
    const heights = await page
      .locator(".receipt-line")
      .evaluateAll((lines) =>
        lines.map((line) => line.getBoundingClientRect().height)
      );
    expect(heights).toHaveLength(8);
    for (const height of heights) expect(height).toBeLessThanOrEqual(40);
  });

  test("the feature map is a list of four pillars", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("group", { name: "Feature map" })).toBeHidden();
    const section = page.getByRole("region", {
      name: "Everything in the box, and how it connects",
    });
    for (const pillar of PILLARS)
      await expect(
        section.locator(".fm-summary", { hasText: pillar.title })
      ).toBeVisible();
  });
});
