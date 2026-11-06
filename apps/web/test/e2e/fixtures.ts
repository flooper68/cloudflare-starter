/**
 * Playwright's `test` and `expect`, plus a guard every journey runs under: any
 * Content-Security-Policy violation in any page or frame of the test (enforced or
 * report-only) fails it. Specs import `test` from here, never from @playwright/test
 * (test/architecture/e2e-isolation.test.ts). docs/guides/how-to-configure-security-headers.md
 */
import {
  type Browser,
  type BrowserContext,
  test as base,
  expect,
} from "@playwright/test";

export type { Page, Route } from "@playwright/test";
export { expect };

export interface CspViolation {
  readonly page: string;
  readonly directive: string;
  readonly blocked: string;
  readonly source: string;
  readonly disposition: string;
}

/** Violations since the last test ended (contexts opened in beforeAll report here too). */
const violations: CspViolation[] = [];
const watched = new WeakSet<BrowserContext>();

/**
 * Takes the violations seen so far, so a test that provokes one on purpose (to prove the
 * policy blocks it) can check it and leave none for the guard.
 */
export function takeCspViolations(): CspViolation[] {
  return violations.splice(0);
}

/** Reports every `securitypolicyviolation` event of the context's pages and frames. */
export async function watchCsp(context: BrowserContext): Promise<void> {
  if (watched.has(context)) return;
  watched.add(context);
  await context.exposeBinding(
    "__e2eCspViolation",
    (source, violation: Omit<CspViolation, "page">) => {
      violations.push({ page: source.frame.url(), ...violation });
    }
  );
  await context.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      const report = (
        window as unknown as {
          __e2eCspViolation?: (violation: Record<string, string>) => void;
        }
      ).__e2eCspViolation;
      report?.({
        directive: event.effectiveDirective,
        blocked: event.blockedURI,
        source: `${event.sourceFile}:${event.lineNumber}`,
        disposition: event.disposition,
      });
    });
  });
}

/**
 * Contexts a spec opens itself are watched too: `browser.newContext`, and `browser.newPage`,
 * which creates its context through `this.newContext`.
 */
function watchBrowser(browser: Browser): void {
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...args) => {
    const context = await newContext(...args);
    await watchCsp(context);
    return context;
  };
}

export const test = base.extend<
  { cspGuard: undefined },
  { watchedBrowser: undefined }
>({
  watchedBrowser: [
    async ({ browser }, use) => {
      watchBrowser(browser);
      await use(undefined);
    },
    { scope: "worker", auto: true },
  ],
  context: async ({ context }, use) => {
    await watchCsp(context);
    await use(context);
  },
  cspGuard: [
    async ({ context: _context }, use, testInfo) => {
      await use(undefined);
      const found = violations.splice(0);
      if (found.length > 0) {
        await testInfo.attach("csp-violations.json", {
          body: JSON.stringify(found, null, 2),
          contentType: "application/json",
        });
      }
      expect(
        found,
        "Content-Security-Policy violations (docs/guides/how-to-configure-security-headers.md)"
      ).toEqual([]);
    },
    { auto: true },
  ],
});
