import { EmailDemoClient } from "@/components/EmailDemoClient";

export function EmailDemoPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
          Email Demo
        </p>
        <h2 className="text-3xl font-semibold text-fg">Send a test email</h2>
        <p className="max-w-3xl text-sm leading-6 text-fg-muted">
          The UI stays inside the app SPA while the email integration remains
          behind the server-side email service interface.
        </p>
      </div>

      <EmailDemoClient />
    </section>
  );
}
