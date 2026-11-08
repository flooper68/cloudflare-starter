/**
 * The QA test inbox (docs/guides/how-to-qa-a-deployment.md#the-qa-inbox): Email Routing's
 * catch-all of the QA mail domain delivers to `email`, the QA suite reads and clears
 * messages through `fetch` (bearer token), and the hourly cron deletes anything older than
 * 24 hours. Never forwards mail.
 */
import { handleApi } from "./api";
import type { InboxEnv } from "./env";
import { receiveEmail } from "./receive";
import { purgeExpired } from "./store";

export default {
  fetch: (request, env) => handleApi(request, env),
  email: (message, env) => receiveEmail(message, env),
  scheduled: async (_controller, env) => {
    await purgeExpired(env.INBOX, Date.now());
  },
} satisfies ExportedHandler<InboxEnv>;
