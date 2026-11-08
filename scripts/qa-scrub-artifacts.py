"""Scrub the QA suite's secrets from its Playwright artifacts before CI uploads them.

    python3 -I scripts/qa-scrub-artifacts.py <dir>...

Playwright traces (zip files, also embedded in the HTML report) record every request's
headers (cookies included), response bodies, page snapshots and the text typed into forms.
Anyone who can download the artifact of a public repository could otherwise read the
X-QA-Token, the QA accounts' generated passwords (the QA admin's included) and their live
session cookies. Replaces, in every file under the given directories and inside every zip
(recursively, and inside the zip the HTML report embeds as base64):
- the value of the environment variable QA_TOKEN (read from the environment, never from
  arguments);
- every generated QA password (apps/web/test/qa/support/password.ts: "Qa1!" + 43
  base64url characters);
- the value of every Cookie, Set-Cookie, Authorization, Proxy-Authorization and X-QA-Token
  header: Playwright's {"name": …, "value": …} pairs, header maps and raw header lines;
- every cookie whose name names a session, token, auth or secret (HAR cookie lists), and
  every Better Auth cookie (`better-auth.*=`, with a __Secure- or __Host- prefix) anywhere;
- token-shaped values: `token`, `t`, `code`, `access_token`, `refresh_token` and
  `id_token` query parameters and JSON fields, `sessionToken`, JWTs, bearer credentials,
  and the tokens in reset-password and invitation paths.
Quotes may be escaped any number of times (JSON inside JSON inside a page snapshot). Then
checks everything again and exits 1 if anything is left, so the upload step refuses to run.
Standard library only.
"""

import base64
import io
import os
import re
import sys
import zipfile

SECRET_VARIABLES = ("QA_TOKEN",)
PASSWORD = re.compile(rb"Qa1!(?:[A-Za-z0-9_-]{43})")
REDACTED = b"[redacted]"
# The HTML report embeds its data (with the traces' step titles) as a base64 zip.
EMBEDDED_ZIP = re.compile(rb"(data:application/zip;base64,)([A-Za-z0-9+/=]+)")

# A double quote, escaped any number of times.
Q = rb'\\*"'
SENSITIVE_HEADER = rb"(?:cookie|set-cookie|authorization|proxy-authorization|x-qa-token)"
# A quoted value: everything up to the next (possibly escaped) quote.
VALUE = rb"(.*?)(?=" + Q + rb")"
SEP = rb"\s*:\s*"
PAIR_SEP = rb"\s*,\s*"
TOKEN_KEYS = rb"(?:token|t|code|access_token|refresh_token|id_token|sessionToken)"

# Each pattern has two groups: a prefix that is kept and the secret value that is replaced.
PATTERNS = [
    # Playwright and HAR header pairs: {"name": "cookie", "value": "…"}.
    re.compile(
        rb"(" + Q + rb"name" + Q + SEP + Q + SENSITIVE_HEADER + Q + PAIR_SEP
        + Q + rb"value" + Q + SEP + Q + rb")" + VALUE,
        re.S | re.I,
    ),
    # HAR cookie lists: {"name": "__Secure-better-auth.session_token", "value": "…"}.
    re.compile(
        rb"(" + Q + rb"name" + Q + SEP + Q + rb"[^\"\\]*(?:session|token|auth|secret)[^\"\\]*"
        + Q + PAIR_SEP + Q + rb"value" + Q + SEP + Q + rb")" + VALUE,
        re.S | re.I,
    ),
    # Header maps: {"cookie": "…"}.
    re.compile(rb"(" + Q + SENSITIVE_HEADER + Q + SEP + Q + rb")" + VALUE, re.S | re.I),
    # Raw header lines: "cookie: …".
    re.compile(rb"(\b" + SENSITIVE_HEADER + rb":[ \t]*)([^\r\n\"\\]+)", re.I),
    # Better Auth cookies anywhere (a Cookie header written out in a log or a snapshot).
    re.compile(rb"((?:__Secure-|__Host-)?better-auth[.-][A-Za-z_]+=)([^;\s\"\\&,]+)"),
    # Token-shaped JSON fields.
    re.compile(rb"(" + Q + TOKEN_KEYS + Q + SEP + Q + rb")" + VALUE, re.S),
    # Token-shaped query parameters, also URL-encoded inside another URL.
    re.compile(
        rb"((?:[?&]|%3F|%26)(?:token|t|code|access_token|refresh_token|id_token)(?:=|%3D))"
        rb"([^&\s\"\\#<>%]*(?:%[0-9A-Fa-f]{2}[^&\s\"\\#<>%]*)*)",
        re.I,
    ),
    # Bearer credentials.
    re.compile(rb"(\bbearer\s+)([A-Za-z0-9._~+/=-]{16,})", re.I),
    # Tokens in paths.
    re.compile(rb"(/reset-password/)([A-Za-z0-9_-]{12,})"),
    re.compile(rb"(/invite/)([0-9a-f]{32,})"),
    # JWTs (verification and email-change links, OAuth tokens).
    re.compile(rb"()(eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})"),
]


def redact_patterns(data):
    for pattern in PATTERNS:
        data = pattern.sub(lambda match: match.group(1) + REDACTED, data)
    return data


def pattern_leaks(data):
    for pattern in PATTERNS:
        for match in pattern.finditer(data):
            if match.group(2) not in (b"", REDACTED):
                return True
    return False


def secrets():
    values = []
    for name in SECRET_VARIABLES:
        value = os.environ.get(name, "").strip()
        if len(value) >= 8:
            values.append(value.encode())
    return values


def scrub_bytes(data, values):
    data = EMBEDDED_ZIP.sub(
        lambda match: match.group(1)
        + base64.b64encode(scrub_zip(base64.b64decode(match.group(2)), values)),
        data,
    )
    for value in values:
        data = data.replace(value, REDACTED)
    return redact_patterns(PASSWORD.sub(REDACTED, data))


def leaks(data, values):
    for match in EMBEDDED_ZIP.finditer(data):
        if zip_leaks(base64.b64decode(match.group(2)), values):
            return True
    return (
        any(value in data for value in values)
        or PASSWORD.search(data) is not None
        or pattern_leaks(data)
    )


def is_zip(data):
    return data[:4] == b"PK\x03\x04"


def scrub_zip(data, values):
    source = zipfile.ZipFile(io.BytesIO(data))
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as target:
        for info in source.infolist():
            entry = source.read(info.filename)
            entry = scrub_zip(entry, values) if is_zip(entry) else scrub_bytes(entry, values)
            target.writestr(info, entry, compress_type=zipfile.ZIP_DEFLATED)
    return output.getvalue()


def zip_leaks(data, values):
    source = zipfile.ZipFile(io.BytesIO(data))
    for info in source.infolist():
        entry = source.read(info.filename)
        if (zip_leaks(entry, values) if is_zip(entry) else leaks(entry, values)):
            return True
    return False


def files(directories):
    for directory in directories:
        for root, _, names in os.walk(directory):
            for name in names:
                yield os.path.join(root, name)


def main(directories):
    values = secrets()
    for path in files(directories):
        with open(path, "rb") as handle:
            data = handle.read()
        cleaned = scrub_zip(data, values) if is_zip(data) else scrub_bytes(data, values)
        if cleaned != data:
            with open(path, "wb") as handle:
                handle.write(cleaned)
    left = []
    for path in files(directories):
        with open(path, "rb") as handle:
            data = handle.read()
        try:
            leaked = zip_leaks(data, values) if is_zip(data) else leaks(data, values)
        except zipfile.BadZipFile:
            leaked = True
        if leaked:
            left.append(path)
    if left:
        print("secrets are still in: " + ", ".join(left), file=sys.stderr)
        return 1
    print("QA artifacts scrubbed")
    return 0


if __name__ == "__main__":
    sys.exit(main([path for path in sys.argv[1:] if os.path.isdir(path)]))
