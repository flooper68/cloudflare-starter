import { WifiOff } from "lucide-react";

import { Button } from "./button";
import { Banner } from "./callout";

export interface OfflineNoticeProps {
  /** Checks the connection again (a request to the app); omitted, there is no button. */
  readonly onRetry?: () => unknown;
  /** The check is running. */
  readonly retrying?: boolean;
  readonly className?: string;
}

/**
 * The strip at the top of the app while the browser is offline or the app's requests
 * fail to reach the server. Nothing is queued: it says that changes cannot be saved
 * until the connection is back, and goes away by itself when it is.
 */
export function OfflineNotice({
  onRetry,
  retrying = false,
  className,
}: OfflineNoticeProps) {
  return (
    <Banner
      tone="warning"
      icon={<WifiOff />}
      className={className}
      title="You're offline."
      description="Changes can't be saved until you reconnect."
      actions={
        onRetry ? (
          <Button size="sm" loading={retrying} onClick={() => void onRetry()}>
            Try again
          </Button>
        ) : null
      }
    />
  );
}
