import { getSecurityState } from "@cloudflare-starter/features";
import { router, signedInProcedure } from "./init";

/** Safe enrollment/status query stays available while ordinary API access is gated. */
export const securityRouter = router({
  status: signedInProcedure.query(({ ctx }) =>
    getSecurityState(ctx, {
      userId: ctx.user.id,
      sessionId: ctx.authSessionId ?? ctx.session?.id,
      settings: ctx.config.security,
    })
  ),
});
