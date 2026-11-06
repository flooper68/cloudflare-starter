import { expect, takeCspViolations, test } from "./fixtures";
import { open } from "./helpers";

// Every journey runs under the CSP guard of fixtures.ts. This one proves the guard sees
// violations on the dev server (where only script-src and style-src are relaxed for Vite)
// and that pages carry the policy. The built policy is tested by test/e2e-build.

test("pages send the policy and the guard sees what it blocks", async ({
  page,
}) => {
  const response = await page.request.get("/sign-in");
  const policy = response.headers()["content-security-policy"] ?? "";
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("frame-src https://challenges.cloudflare.com");
  expect(policy).toContain("frame-ancestors 'none'");

  await open(page, "/sign-in");
  await page.evaluate(() => {
    const image = document.createElement("img");
    image.src = "https://images.example.invalid/pixel.png";
    document.body.appendChild(image);
  });
  await expect
    .poll(() => takeCspViolations().map((violation) => violation.directive))
    .toContain("img-src");
});
