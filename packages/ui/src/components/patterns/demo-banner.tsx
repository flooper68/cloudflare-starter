import { FlaskConical } from "lucide-react";

import { Banner } from "../callout";
import { Link } from "../link";

export interface DemoBannerProps {
  /** Days after sign-up that the demo erases an account (DEMO_RETENTION_DAYS). */
  readonly retentionDays: number;
  /** Where "Get the starter on GitHub" points. */
  readonly repositoryUrl: string;
  /** Shows a × that hides the banner (the app keeps it hidden for the browser session). */
  readonly onDismiss?: () => void;
  readonly className?: string;
}

/**
 * The demo instance's notice (DEMO_MODE=on): accounts and their data are deleted after
 * the retention, with a link to the starter's repository. Across the top of every
 * signed-in page (dismissible for the session) and above the sign-up form.
 */
export function DemoBanner({
  retentionDays,
  repositoryUrl,
  onDismiss,
  className,
}: DemoBannerProps) {
  return (
    <Banner
      tone="info"
      icon={<FlaskConical />}
      aria-label="Demo instance"
      className={className}
      description={
        <span>
          Demo instance: your account and data are deleted after {retentionDays}{" "}
          days.{" "}
          <Link href={repositoryUrl} external>
            Get the starter on GitHub
          </Link>
        </span>
      }
      onDismiss={onDismiss}
    />
  );
}
