import {
  DomainError,
  type DomainErrorKind,
} from "@cloudflare-starter/features";
import { TRPCError } from "@trpc/server";

const codes: Record<DomainErrorKind, TRPCError["code"]> = {
  not_found: "NOT_FOUND",
  invalid_input: "BAD_REQUEST",
  forbidden: "FORBIDDEN",
  conflict: "CONFLICT",
  unavailable: "PRECONDITION_FAILED",
  rate_limited: "TOO_MANY_REQUESTS",
  limit_reached: "FORBIDDEN",
};

/**
 * The one place a use case's DomainError becomes a tRPC error. MCP tools call procedures,
 * so they get the same mapping. Anything else stays an internal error.
 */
export function toTrpcError(error: TRPCError): TRPCError {
  const cause = error.cause;
  if (!(cause instanceof DomainError)) return error;
  return new TRPCError({
    code: codes[cause.kind],
    message: cause.message,
    cause,
  });
}
