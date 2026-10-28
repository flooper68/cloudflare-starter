import { VenetianMask } from "lucide-react";
import { useState } from "react";

import { Button } from "../button";
import { Banner } from "../callout";

export interface ImpersonationBannerProps {
  /** Who is being impersonated. */
  readonly userName: string;
  readonly userEmail: string;
  /** Ends the impersonation; the page then reloads as the admin. */
  readonly onStop: () => Promise<void>;
}

/**
 * Shown at the top of the app while an admin impersonates a user: whose session this is,
 * and "Stop impersonating" to go back to the admin's own session.
 */
export function ImpersonationBanner({
  userName,
  userEmail,
  onStop,
}: ImpersonationBannerProps) {
  const [stopping, setStopping] = useState(false);
  return (
    <Banner
      tone="warning"
      icon={<VenetianMask />}
      title={`You are signed in as ${userName} (${userEmail})`}
      description="Everything you do is done as them and recorded with your name."
      actions={
        <Button
          size="sm"
          loading={stopping}
          onClick={() => {
            setStopping(true);
            void onStop().finally(() => setStopping(false));
          }}
        >
          Stop impersonating
        </Button>
      }
    />
  );
}
