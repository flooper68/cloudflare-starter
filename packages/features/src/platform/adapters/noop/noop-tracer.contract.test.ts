import { describeTracerContract } from "../../ports/tracer.contract";
import { noopTracer } from "./noop-tracer";

describeTracerContract("noopTracer", () => ({ tracer: noopTracer }));
