import { RotateCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "./button";
import { Callout } from "./callout";
import { ErrorState } from "./error-state";

/** `m:ss` for a countdown. */
function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export interface RateLimitNoticeProps {
  /** How long the server asked to wait (Retry-After). */
  readonly retryAfterSeconds: number;
  /** What was limited, for the title ("Too many sign-in attempts"). */
  readonly subject?: string;
  /** Shows "Try again" once the wait is over; may return a promise. */
  readonly onRetry?: () => unknown;
  /** The retry is running: the button spins. */
  readonly retrying?: boolean;
  /** The retry failed for another reason; shown under the notice. */
  readonly error?: string | null;
  readonly className?: string;
}

/**
 * Tells the user they hit a rate limit (HTTP 429): how long to wait, counting down, then
 * a way to try again. Screen readers hear the wait once, not every second.
 */
export function RateLimitNotice({
  retryAfterSeconds,
  subject = "attempts",
  onRetry,
  retrying = false,
  error,
  className,
}: RateLimitNoticeProps) {
  const [remaining, setRemaining] = useState(retryAfterSeconds);

  useEffect(() => {
    const deadline = Date.now() + retryAfterSeconds * 1000;
    setRemaining(retryAfterSeconds);
    if (retryAfterSeconds <= 0) return;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [retryAfterSeconds]);

  const waiting = remaining > 0;
  return (
    <div className={className}>
      <Callout
        tone="warning"
        title={`Too many ${subject}`}
        description={
          waiting ? (
            <>
              <span aria-hidden="true">Try again in {clock(remaining)}.</span>
              <span className="sr-only">
                Try again in {retryAfterSeconds} seconds.
              </span>
            </>
          ) : (
            "You can try again now."
          )
        }
        actions={
          !waiting && onRetry ? (
            <Button
              size="xs"
              icon={<RotateCw />}
              loading={retrying}
              onClick={() => void onRetry()}
            >
              Try again
            </Button>
          ) : undefined
        }
      />
      {error ? (
        <ErrorState variant="inline" className="mt-2" description={error} />
      ) : null}
    </div>
  );
}
