// Composition root for product analytics: every event the app may send. Features declare
// their events in their domain (domain/analytics-events.ts, defineEvent) and track them
// with trackEvent; registering one here is what lets it in. test/architecture/product-analytics.test.ts
// checks that every declared event is registered and tracked, and that every tracked or
// client-sent name is here. Guide: docs/guides/how-to-setup-product-analytics.md
import { signedUpEvent } from "./accounts";
import { fileUploadedEvent } from "./files";
import { createEventCatalog, pageViewedEvent } from "./product-analytics";
import { memberJoinedEvent, workspaceCreatedEvent } from "./workspaces";

export const analyticsEvents = createEventCatalog([
  signedUpEvent,
  fileUploadedEvent,
  workspaceCreatedEvent,
  memberJoinedEvent,
  pageViewedEvent,
]);
