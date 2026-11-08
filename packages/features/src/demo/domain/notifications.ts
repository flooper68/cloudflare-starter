import { z } from "zod";

import { defineNotification, html } from "../../kernel";
import { STARTER_REPOSITORY_URL } from "./settings";

/** Where a person requests their data export before the demo deletes it. */
export const PRIVACY_SETTINGS_PATH = "/app/settings/privacy";

/**
 * The demo retention's warning, a day before an account is erased. Security-critical, so
 * it is always emailed, at once, and the preferences cannot turn it off: it is the
 * person's one chance to export their data.
 */
export const demoDeletionWarningNotification = defineNotification({
  type: "demo.deletion-warning",
  label: "Your demo account is about to be deleted",
  data: z.object({ deletesAt: z.iso.datetime() }).strict(),
  defaultChannels: { inApp: true, email: true },
  securityCritical: true,
  render: (data, { appUrl }) => {
    const exportUrl = `${appUrl}${PRIVACY_SETTINGS_PATH}`;
    const when = `${data.deletesAt.replace("T", " ").slice(0, 16)} UTC`;
    const body = `This is a demo instance: your account, its workspaces and everything in them will be deleted tomorrow (due ${when}).`;
    return {
      inApp: {
        title: "Your demo account will be deleted tomorrow",
        body: `${body} Export your data from Settings › Privacy first.`,
        href: PRIVACY_SETTINGS_PATH,
      },
      email: {
        subject: "Your demo account will be deleted tomorrow",
        text: `${body}\n\nExport your data first: ${exportUrl}\n\nGet the starter on GitHub: ${STARTER_REPOSITORY_URL}`,
        html: html`<p>${body}</p><p><a href="${exportUrl}">Export your data</a> before then.</p><p><a href="${STARTER_REPOSITORY_URL}">Get the starter on GitHub</a></p>`
          .value,
      },
    };
  },
});
