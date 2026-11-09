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

const SESSION = "M1Nffn4RBPA3kIzZvoVFl1KnsDUVXEdr.UxmF8MAgBDfaZpFgArihj%2F1lvz";
const SESSION_DATA = "eyJzZXNzaW9uIjp7InNlc3Npb24iOnsiZXhwaXJlc0F0Ijoi";
const JWT =
  "eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6InFhKzIwMjYxMTA4bGpraC1maWxlc0Bx.yJarfTgTuQIOyOMFHv2Auak9DH";
const BEARER = "oat_0123456789abcdefghijklmnop";
const RESET = "DXeOXFbGVDLDCUVfIAVhNLol";
/** Every secret the trace fixture holds; none may survive the scrub. */
const SECRETS = [SESSION, SESSION_DATA, JWT, BEARER, RESET, TOKEN];

/**
 * A trace zip shaped like Playwright's: the network log (HAR entries with header pairs,
 * cookie lists and response bodies), the action log (route.continue with the headers it
 * sent) and a page snapshot whose JSON is escaped once more.
 */
const MAKE_TRACE = `
import io, json, sys, zipfile
root = sys.argv[1]
session, data, jwt, bearer, reset, token = ${JSON.stringify([SESSION, SESSION_DATA, JWT, BEARER, RESET, TOKEN])}
cookie = "__Secure-better-auth.session_token=%s; __Secure-better-auth.session_data=%s" % (session, data)
network = json.dumps({"type": "resource-snapshot", "snapshot": {
  "request": {"url": "https://starter.flooper.me/api/trpc/flags.client?batch=1",
    "headers": [{"name": "accept", "value": "application/json"},
                {"name": "Cookie", "value": cookie},
                {"name": "authorization", "value": "Bearer " + bearer},
                {"name": "x-qa-token", "value": token}],
    "cookies": [{"name": "__Secure-better-auth.session_token", "value": session}]},
  "response": {"headers": [{"name": "set-cookie", "value": "__Secure-better-auth.session_token=%s; Path=/; HttpOnly" % session}],
    "content": {"text": json.dumps({"token": session, "url": "https://starter.flooper.me/api/auth/verify-email?token=" + jwt})}}}},
  separators=(",", ":"))
action = json.dumps({"type": "before", "method": "continue", "params": {
  "headers": [{"name": "cookie", "value": cookie}],
  "url": "https://starter.flooper.me/api/auth/reset-password/" + reset}}, separators=(",", ":"))
snapshot = json.dumps({"html": json.dumps({"href": "/email-verified?token=" + jwt, "cookie": cookie})})
out = io.BytesIO()
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("0-trace.network", network + "\\n")
    z.writestr("0-trace.trace", action + "\\n")
    z.writestr("resources/page@1.json", snapshot)
open(root + "/trace.zip", "wb").write(out.getvalue())
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

  it("removes session cookies, auth headers and tokens from a trace's network log, actions and snapshots", () => {
    const root = mkdtempSync(join(tmpdir(), "qa-scrub-"));
    expect(python(["-c", MAKE_TRACE, root]).status).toBe(0);
    const before = python(["-c", DUMP, root]).stdout;
    for (const secret of SECRETS) expect(before).toContain(secret);

    const result = python(["scripts/qa-scrub-artifacts.py", root], {
      QA_TOKEN: TOKEN,
    });
    expect(result.status, result.stderr).toBe(0);
    const after = python(["-c", DUMP, root]).stdout;
    for (const secret of SECRETS) expect(after).not.toContain(secret);
    expect(after).toContain('{"name":"Cookie","value":"[redacted]"}');
    // What is no secret stays readable for debugging.
    expect(after).toContain('"name":"accept","value":"application/json"');
    expect(after).toContain("/api/trpc/flags.client");
  });

  it("refuses (exit 1) when a session cookie is left in a file it cannot rewrite", () => {
    const root = mkdtempSync(join(tmpdir(), "qa-scrub-"));
    writeFileSync(
      join(root, "broken.zip"),
      `PK\u0003\u0004cookie: __Secure-better-auth.session_token=${SESSION}`
    );
    const result = python(["scripts/qa-scrub-artifacts.py", root], {
      QA_TOKEN: TOKEN,
    });
    expect(result.status).not.toBe(0);
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
