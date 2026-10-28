import type { SendEmailInput } from "./ports";

/** RFC 5322 field name: printable ASCII except the colon. */
const FIELD_NAME = /^[\x21-\x39\x3b-\x7e]+$/;

/** Headers the adapter writes itself; a caller may not set or override them. */
const RESERVED_HEADERS = new Set([
  "from",
  "to",
  "cc",
  "bcc",
  "subject",
  "reply-to",
  "sender",
  "content-type",
  "content-transfer-encoding",
  "mime-version",
]);

/**
 * Throws the TypeError every Email adapter raises for a message it must not send: no
 * recipient, a subject, name or header value that spans lines (header injection), an
 * invalid or reserved header name.
 */
export function assertEmailMessage(input: SendEmailInput): void {
  if (!input.to.email.trim()) {
    throw new TypeError("Email needs a recipient address");
  }
  if (/[\r\n]/.test(input.subject) || /[\r\n]/.test(input.to.name ?? "")) {
    throw new TypeError("Email subject and recipient name must be one line");
  }
  for (const [name, value] of Object.entries(input.headers ?? {})) {
    if (!FIELD_NAME.test(name)) {
      throw new TypeError(`Invalid email header name "${name}"`);
    }
    if (RESERVED_HEADERS.has(name.toLowerCase())) {
      throw new TypeError(`Email header "${name}" is set by the adapter`);
    }
    if (/[\r\n]/.test(value)) {
      throw new TypeError(`Email header "${name}" must be one line`);
    }
  }
}
