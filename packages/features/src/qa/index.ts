// The QA outbox: with QA_BYPASS=on, mail to QA addresses is stored for the automated QA
// suite instead of sent (docs/guides/how-to-qa-a-deployment.md#the-qa-outbox).
export { clearQaMail } from "./clear-qa-mail";
export {
  isQaRunAddress,
  type Mailbox,
  purgeQaOutboxJob,
  QA_CLEANUP_BATCH,
  QA_LEFTOVER_MIN_AGE_MS,
  QA_OUTBOX_PAGE_SIZE,
  QA_OUTBOX_RETENTION_MS,
  qaOutboxCutoff,
  renderedHeaders,
} from "./domain";
export { eraseQaAccounts } from "./erase-qa-accounts";
export { listQaMail, type QaMail } from "./list-qa-mail";
export { purgeQaOutbox } from "./purge-qa-outbox";
export { storeQaMail } from "./store-qa-mail";
export { withQaOutbox } from "./with-qa-outbox";
