"""Scrub the QA suite's secrets from its Playwright artifacts before CI uploads them.

    python3 -I scripts/qa-scrub-artifacts.py <dir>...

Playwright traces (zip files, also embedded in the HTML report) record request headers
and the text typed into forms: the X-QA-Token header, the QA admin's password and the QA
accounts' generated passwords would otherwise be readable by anyone who can download the
artifact of a public repository. Replaces, in every file under the given directories and
inside every zip (recursively):
- the values of the environment variables QA_TOKEN, QA_INBOX_TOKEN and QA_ADMIN_PASSWORD
  (read from the environment, never from arguments);
- every generated QA password (apps/web/test/qa/support/password.ts: "Qa1!" + 43
  base64url characters).
The same inside the zip the HTML report embeds as base64. Then checks again and exits 1
if anything is left, so the upload step can refuse to run.
Standard library only.
"""

import base64
import io
import os
import re
import sys
import zipfile

SECRET_VARIABLES = ("QA_TOKEN", "QA_INBOX_TOKEN", "QA_ADMIN_PASSWORD")
PASSWORD = re.compile(rb"Qa1!(?:[A-Za-z0-9_-]{43})")
REDACTED = b"[redacted]"
# The HTML report embeds its data (with the traces' step titles) as a base64 zip.
EMBEDDED_ZIP = re.compile(rb"(data:application/zip;base64,)([A-Za-z0-9+/=]+)")


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
    return PASSWORD.sub(REDACTED, data)


def leaks(data, values):
    for match in EMBEDDED_ZIP.finditer(data):
        if zip_leaks(base64.b64decode(match.group(2)), values):
            return True
    return any(value in data for value in values) or PASSWORD.search(data) is not None


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
        if zip_leaks(data, values) if is_zip(data) else leaks(data, values):
            left.append(path)
    if left:
        print("secrets are still in: " + ", ".join(left), file=sys.stderr)
        return 1
    print("QA artifacts scrubbed")
    return 0


if __name__ == "__main__":
    sys.exit(main([path for path in sys.argv[1:] if os.path.isdir(path)]))
