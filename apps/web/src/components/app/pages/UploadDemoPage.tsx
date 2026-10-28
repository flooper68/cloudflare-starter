import { BindingUploadDemo } from "@/components/BindingUploadDemo";
import { UploadDemoClient } from "@/components/UploadDemoClient";

export function UploadDemoPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">
          Upload Demo
        </p>
        <h2 className="text-3xl font-semibold text-zinc-950">
          Two ways into R2
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-zinc-600">
          Both paths share the same file table and ownership rules. Through the
          Worker, the bytes pass the `FILES` binding and every read is checked.
          Presigned, the browser talks to R2 directly with a short-lived URL.
          Pick per feature.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <BindingUploadDemo />
        <UploadDemoClient />
      </div>
    </section>
  );
}
