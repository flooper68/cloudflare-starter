import { describe, expect, it } from "vitest";

import { parseCspReports, reportedUrl, violationFields } from "./csp-report";

describe("CSP violation reports", () => {
  it("reads report-uri bodies (application/csp-report)", () => {
    expect(
      parseCspReports({
        "csp-report": {
          "document-uri": "https://app.example/sign-in?next=/x",
          "violated-directive": "script-src-elem",
          "effective-directive": "script-src-elem",
          "blocked-uri": "https://evil.example/x.js?token=1",
          disposition: "enforce",
          "line-number": 3,
        },
      })
    ).toEqual([
      {
        documentURL: "https://app.example/sign-in?next=/x",
        effectiveDirective: "script-src-elem",
        blockedURL: "https://evil.example/x.js?token=1",
        disposition: "enforce",
        sourceFile: undefined,
        lineNumber: 3,
        statusCode: undefined,
      },
    ]);
  });

  it("reads Reporting API batches and skips other report types", () => {
    const reports = parseCspReports([
      {
        type: "csp-violation",
        body: {
          documentURL: "https://app.example/",
          effectiveDirective: "style-src-elem",
          blockedURL: "inline",
          disposition: "report",
        },
      },
      { type: "deprecation", body: { id: "x" } },
      "junk",
    ]);
    expect(reports).toHaveLength(1);
    expect(reports[0]?.effectiveDirective).toBe("style-src-elem");
  });

  it("yields nothing for unknown shapes", () => {
    expect(parseCspReports({})).toEqual([]);
    expect(parseCspReports(null)).toEqual([]);
    expect(parseCspReports({ "csp-report": "x" })).toEqual([]);
  });

  it("logs URLs without query, fragment or path tokens", () => {
    expect(reportedUrl("https://evil.example/a.js?token=1#f")).toBe(
      "https://evil.example/a.js"
    );
    expect(
      reportedUrl("https://app.example/reset-password/secret-token?x=1")
    ).toBe("https://app.example/reset-password/[redacted]");
    expect(reportedUrl("inline")).toBe("inline");
    expect(reportedUrl("data:image/png;base64,AAAA")).toBe("data");
    expect(reportedUrl("<script>")).toBe("script");
  });

  it("names the fields after the directive, the blocked resource and the page", () => {
    expect(
      violationFields({
        documentURL: "https://app.example/app/dashboard?tab=1",
        effectiveDirective: "connect-src",
        blockedURL: "https://api.example/v1",
        disposition: "enforce",
      })
    ).toEqual({
      "app.csp.directive": "connect-src",
      "app.csp.blocked": "https://api.example/v1",
      "app.csp.disposition": "enforce",
      "app.csp.document": "https://app.example/app/dashboard",
      "app.csp.source": undefined,
      "app.csp.line": undefined,
    });
  });
});
