import { QueueDemoClient } from "@/components/QueueDemoClient";

export function QueueDemoPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">
          Queue Demo
        </p>
        <h2 className="text-3xl font-semibold text-zinc-950">
          Queue a hello payload
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-zinc-600">
          This flow publishes a typed message from the app and lets the
          dedicated queue worker validate and process it.
        </p>
      </div>

      <QueueDemoClient />
    </section>
  );
}
