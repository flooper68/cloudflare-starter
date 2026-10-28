import { describeTracerContract } from "../../ports/tracer.contract";
import { createMemoryTracer } from "./memory-tracer";

describeTracerContract("createMemoryTracer", () => {
  const tracer = createMemoryTracer();
  return { tracer, spans: () => tracer.spans };
});
