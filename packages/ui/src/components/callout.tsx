import { cva } from "class-variance-authority";
import {
  AlertTriangle,
  CircleCheck,
  CircleX,
  Info,
  Megaphone,
  X,
} from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/utils";
import { IconButton } from "./button";

export type CalloutTone = "info" | "success" | "warning" | "danger" | "neutral";

const toneIcon: Record<CalloutTone, ReactNode> = {
  info: <Info />,
  success: <CircleCheck />,
  warning: <AlertTriangle />,
  danger: <CircleX />,
  neutral: <Megaphone />,
};

const noticeVariants = cva("flex gap-2.5 text-sm text-fg", {
  variants: {
    layout: {
      callout: "items-start rounded-lg border p-3",
      banner: "w-full items-center border-b px-4 py-2",
    },
    tone: {
      info: "border-info/30 bg-info-subtle",
      success: "border-success/30 bg-success-subtle",
      warning: "border-warning/30 bg-warning-subtle",
      danger: "border-danger/30 bg-danger-subtle",
      neutral: "border-line bg-surface-raised",
    },
  },
});

const iconTone: Record<CalloutTone, string> = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  neutral: "text-fg-muted",
};

export interface CalloutProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  readonly tone?: CalloutTone;
  readonly title?: ReactNode;
  /** Body text; `children` works too. */
  readonly description?: ReactNode;
  /** Replaces the tone's icon; `false` hides it. */
  readonly icon?: ReactNode | false;
  /** Buttons (size "xs" or "sm") after the text. */
  readonly actions?: ReactNode;
  /** Shows a × button that calls this. */
  readonly onDismiss?: () => void;
}

function Notice({
  layout,
  tone = "info",
  title,
  description,
  icon,
  actions,
  onDismiss,
  className,
  children,
  ...props
}: CalloutProps & { readonly layout: "callout" | "banner" }) {
  const body = description ?? children;
  const banner = layout === "banner";
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn(noticeVariants({ layout, tone }), className)}
      {...props}
    >
      {icon === false ? null : (
        <span
          className={cn(
            "flex shrink-0 [&_svg]:size-4",
            !banner && "mt-0.5",
            iconTone[tone]
          )}
        >
          {icon ?? toneIcon[tone]}
        </span>
      )}
      <div
        className={cn(
          "flex min-w-0 flex-1",
          banner ? "flex-wrap items-center gap-x-2" : "flex-col gap-0.5"
        )}
      >
        {title ? <p className="font-medium leading-5">{title}</p> : null}
        {body ? (
          <div className={cn("text-fg-muted", !banner && "leading-5")}>
            {body}
          </div>
        ) : null}
        {actions && !banner ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      {actions && banner ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
      {onDismiss ? (
        <IconButton
          label="Dismiss"
          size="xs"
          onClick={onDismiss}
          className={cn("-my-0.5 -mr-1 shrink-0", !banner && "-mt-0.5")}
        >
          <X />
        </IconButton>
      ) : null}
    </div>
  );
}

/**
 * A boxed message inside content: an explanation, a warning before a risky setting, the
 * result of an action. Tones: info, success, warning, danger, neutral.
 */
export function Callout(props: CalloutProps) {
  return <Notice layout="callout" {...props} />;
}

/**
 * A full-width strip at the top of a page or panel for app-wide news: a trial ending,
 * a sync failure, maintenance. Same props as Callout; actions sit at the end of the line.
 */
export function Banner(props: CalloutProps) {
  return <Notice layout="banner" {...props} />;
}
