import { UploadDemoClient } from "@/components/UploadDemoClient";

export function UploadDemoPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">
          Upload Demo
        </p>
        <h2 className="text-3xl font-semibold text-zinc-950">
          R2 presigned uploads
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-zinc-600">
          The browser uploads directly to R2. The app keeps ownership and access
          control in the database and signs download URLs on demand.
        </p>
      </div>

      <UploadDemoClient />
    </section>
  );
}
