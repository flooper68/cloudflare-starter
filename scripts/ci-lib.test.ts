import { describe, expect, it } from "vitest";

import { leftoverPids, playwrightInstall } from "./ci-lib";

describe("leftoverPids", () => {
  const ws = "/home/runner/_work/app/app";
  const ps = [
    "    1 /sbin/docker-init -- /usr/local/bin/runner-entrypoint",
    "   20 /home/runner/bin/Runner.Listener run",
    `  101 node ${ws}/node_modules/.bin/astro dev --ignore-lock`,
    `  102 ${ws}/node_modules/@cloudflare/workerd-linux-arm64/bin/workerd serve --binary`,
    `  103 node ${ws}/node_modules/wrangler/bin/wrangler.js dev`,
    `  104 node ${ws}/node_modules/vite/bin/vite.js`,
    "  105 node /home/someone/project/node_modules/.bin/astro dev",
    `  106 bun ${ws}/scripts/ci-reap.ts bun run test:e2e`,
    `  107 node ${ws}/node_modules/.bin/vitest`,
    "  108 bash -e /home/runner/_work/_temp/abc.sh",
    `  109 ${ws}/node_modules/@esbuild/linux-arm64/bin/esbuild --service=0.25.0 --ping`,
  ].join("\n");

  it("finds dev servers started from the workspace", () => {
    expect(leftoverPids(ps, ws, [])).toEqual([101, 102, 103, 104, 107, 109]);
  });

  it("never matches processes outside the workspace or in the keep list", () => {
    expect(leftoverPids(ps, ws, [101, 107])).toEqual([102, 103, 104, 109]);
  });

  it("ignores tool names in the workspace path itself", () => {
    const astroWs = "/home/runner/_work/astro-app/astro-app";
    const lines = [
      `  201 bun ${astroWs}/scripts/ci-reap.ts bun run test:e2e`,
      `  202 ${astroWs}/node_modules/@cloudflare/workerd-linux-64/bin/workerd serve`,
    ].join("\n");
    expect(leftoverPids(lines, astroWs, [])).toEqual([202]);
  });

  it("does nothing without a workspace", () => {
    expect(leftoverPids(ps, "", [])).toEqual([]);
  });
});

describe("playwrightInstall", () => {
  const base = { githubActions: true, playwright: "1.64.1" };

  it("installs OS packages on GitHub-hosted runners", () => {
    expect(
      playwrightInstall({
        ...base,
        runnerEnvironment: "github-hosted",
        imagePlaywright: undefined,
      })
    ).toEqual({ withDeps: true });
  });

  it("skips them on the runner image with the same Playwright", () => {
    expect(
      playwrightInstall({
        ...base,
        runnerEnvironment: "self-hosted",
        imagePlaywright: "1.64.1",
      })
    ).toEqual({ withDeps: false });
  });

  it("installs and warns when the image has another Playwright", () => {
    const plan = playwrightInstall({
      ...base,
      runnerEnvironment: "self-hosted",
      imagePlaywright: "1.63.0",
    });
    expect(plan.withDeps).toBe(true);
    expect(plan.warning).toMatch(/1\.63\.0.*1\.64\.1.*runner:up/);
  });

  it("installs and warns on a self-hosted runner that is not the image", () => {
    const plan = playwrightInstall({
      ...base,
      runnerEnvironment: "self-hosted",
      imagePlaywright: undefined,
    });
    expect(plan.withDeps).toBe(true);
    expect(plan.warning).toMatch(/not the runner image/);
  });

  it("never uses sudo outside GitHub Actions", () => {
    expect(
      playwrightInstall({
        githubActions: false,
        runnerEnvironment: undefined,
        imagePlaywright: undefined,
        playwright: "1.64.1",
      })
    ).toEqual({ withDeps: false });
  });
});
