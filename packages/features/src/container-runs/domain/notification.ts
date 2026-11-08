import { z } from "zod";

import { defineNotification, html } from "../../kernel";

/** The run on the demo page, which shows its timeline and result. */
export function containerRunHref(runId: string): string {
  return `/app/container-demo?run=${runId}`;
}

/**
 * A container run finished, either way. In the app by default; email only when the
 * person turns it on in their notification preferences.
 */
export const containerRunFinishedNotification = defineNotification({
  type: "container-runs.finished",
  label: "A container run you started finishes",
  data: z
    .object({
      runId: z.uuid(),
      digits: z.number().int().positive(),
      outcome: z.enum(["succeeded", "failed"]),
    })
    .strict(),
  defaultChannels: { inApp: true, email: false },
  securityCritical: false,
  render(data, ctx) {
    const href = containerRunHref(data.runId);
    const url = `${ctx.appUrl}${href}`;
    const digits = data.digits.toLocaleString("en-US");
    const done = data.outcome === "succeeded";
    const title = done
      ? `Container run finished: ${digits} digits of pi`
      : `Container run failed: ${digits} digits of pi`;
    const body = done
      ? "The result is stored and ready to download for 7 days."
      : "The run did not finish. You can retry it from the demo page.";
    return {
      inApp: { title, body, href },
      email: {
        subject: title,
        text: `${body} ${url}`,
        html: String(html`<p>${body} <a href="${url}">Open the run</a>.</p>`),
      },
    };
  },
});
