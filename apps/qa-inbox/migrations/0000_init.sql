-- The QA inbox: one row per message delivered by Email Routing, kept 24 hours.
CREATE TABLE messages (
  id TEXT PRIMARY KEY NOT NULL,
  -- Envelope recipient (RCPT TO), lowercased: the QA address the mail was sent to.
  recipient TEXT NOT NULL,
  -- The From header's address, or the envelope sender when it has none.
  sender TEXT NOT NULL,
  subject TEXT NOT NULL,
  -- The Date header as ISO 8601, or null when missing or unreadable.
  sent_at TEXT,
  -- When this Worker received it (ms since the epoch): `since` and retention use it.
  received_at INTEGER NOT NULL,
  text_body TEXT,
  html_body TEXT,
  -- Every header as a JSON array of [name, value] pairs, names lowercased, in order.
  headers TEXT NOT NULL
);

CREATE INDEX messages_recipient_received ON messages (recipient, received_at);
CREATE INDEX messages_received ON messages (received_at);
