import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ROOT } from "./lib";

const TOKEN = "qa-token-0123456789abcdefghijklmnopqrstuv";
const PASSWORD = `Qa1!${"A".repeat(43)}`;

/** Writes fixtures shaped like Playwright's output: a trace zip, a nested zip, a report. */
const MAKE = `
import base64, io, sys, zipfile
root, token, password = sys.argv[1:4]
def zipped(entries):
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in entries.items():
            z.writestr(name, data)
    return out.getvalue()
inner = zipped({"network.json": '{"x-qa-token":"%s"}' % token})
trace = zipped({"trace.trace": 'fill "%s"' % password, "inner.zip": inner})
open(root + "/trace.zip", "wb").write(trace)
report = zipped({"report.json": '{"title":"Fill \\\\"%s\\\\""}' % password})
html = b'<script>window.playwrightReportBase64 = "data:application/zip;base64,' + base64.b64encode(report) + b'";</script>'
open(root + "/index.html", "wb").write(html)
open(root + "/log.txt", "w").write("header x-qa-token: %s" % token)
`;

/** Every entry's text of every zip under root, plus the plain files, as one string. */
const DUMP = `
import base64, io, os, re, sys, zipfile
def dump(data):
    if data[:4] == b"PK\\x03\\x04":
        z = zipfile.ZipFile(io.BytesIO(data))
        return b"".join(dump(z.read(n)) for n in z.namelist())
    out = data
    for m in re.finditer(rb"data:application/zip;base64,([A-Za-z0-9+/=]+)", data):
        out += dump(base64.b64decode(m.group(1)))
    return out
root = sys.argv[1]
sys.stdout.buffer.write(b"".join(dump(open(os.path.join(root, f), "rb").read()) for f in sorted(os.listdir(root))))
`;

function python(args: string[], env: Record<string, string> = {}) {
  return spawnSync("python3", ["-I", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", ...env },
  });
}

describe("qa-scrub-artifacts.py", () => {
  it("removes the QA token and generated passwords from files, zips and the report", () => {
    const root = mkdtempSync(join(tmpdir(), "qa-scrub-"));
    expect(python(["-c", MAKE, root, TOKEN, PASSWORD]).status).toBe(0);
    expect(python(["-c", DUMP, root]).stdout).toContain(TOKEN);

    const result = python(["scripts/qa-scrub-artifacts.py", root], {
      QA_TOKEN: TOKEN,
    });
    expect(result.status, result.stderr).toBe(0);
    const after = python(["-c", DUMP, root]).stdout;
    expect(after).not.toContain(TOKEN);
    expect(after).not.toContain(PASSWORD);
    expect(after).toContain("[redacted]");
    expect(readFileSync(join(root, "log.txt"), "utf8")).toBe(
      "header x-qa-token: [redacted]"
    );
  });

  it("fails when a secret cannot be removed (an unreadable zip)", () => {
    const root = mkdtempSync(join(tmpdir(), "qa-scrub-"));
    writeFileSync(join(root, "broken.zip"), `PK\u0003\u0004${TOKEN}`);
    const result = python(["scripts/qa-scrub-artifacts.py", root], {
      QA_TOKEN: TOKEN,
    });
    expect(result.status).not.toBe(0);
  });
});
