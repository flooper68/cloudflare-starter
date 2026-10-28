// Runs in workerd (features-integration): the adapter's real console output, as Workers
// Logs receives it.
import { vi } from "vitest";
import { describeTracerContract } from "../../ports/tracer.contract";
import { SPAN_EVENT } from "../../span-record";
import { createWorkersTracer } from "./workers-tracer";

describeTracerContract("createWorkersTracer", () => {
  const spies = [
    vi.spyOn(console, "info").mockImplementation(() => {}),
    vi.spyOn(console, "error").mockImplementation(() => {}),
  ];
  return {
    tracer: createWorkersTracer({
      resource: {
        "service.name": "cloudflare-starter-web",
        "service.version": "local",
        "deployment.environment.name": "test",
      },
    }),
    spans: () =>
      spies
        .flatMap((spy) =>
          spy.mock.calls.map((args, index) => ({
            order: spy.mock.invocationCallOrder[index] ?? 0,
            record: args[0] as Record<string, unknown>,
          }))
        )
        .sort((a, b) => a.order - b.order)
        .map(({ record }) => record)
        .filter((record) => record.body === SPAN_EVENT),
    dispose: () => {
      for (const spy of spies) spy.mockRestore();
    },
  };
});
