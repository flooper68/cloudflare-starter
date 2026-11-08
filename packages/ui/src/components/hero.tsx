import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/utils";

export interface HeroProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Small labels above the title (badges). */
  readonly eyebrow?: ReactNode;
  /** The page's one level-1 heading. */
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** Links or buttons: the primary action first. */
  readonly actions?: ReactNode;
  /** Below the actions in the text column, e.g. a code block with the first commands. */
  readonly footer?: ReactNode;
  /** The visual on the right (stacks under the text on narrow screens). */
  readonly aside?: ReactNode;
}

/**
 * The opening section of a public page: title, one paragraph, the main actions and an
 * optional visual beside them. Static markup, so a prerendered page can use it without
 * shipping React.
 */
export function Hero({
  eyebrow,
  title,
  description,
  actions,
  footer,
  aside,
  className,
  ...props
}: HeroProps) {
  return (
    <section
      className={cn(
        "mx-auto flex w-full max-w-6xl flex-wrap items-center gap-12 px-4 pt-16 pb-12 sm:px-6 lg:pt-20",
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-[1_1_28rem] flex-col gap-5">
        {eyebrow ? (
          <div className="flex flex-wrap items-center gap-2">{eyebrow}</div>
        ) : null}
        <h1 className="text-4xl font-semibold tracking-tight text-fg sm:text-5xl sm:leading-[1.15]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-xl text-base leading-7 text-fg-muted sm:text-lg sm:leading-7">
            {description}
          </p>
        ) : null}
        {actions ? (
          <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
        ) : null}
        {footer ? <div className="max-w-xl">{footer}</div> : null}
      </div>
      {aside ? <div className="min-w-0 flex-[1_1_30rem]">{aside}</div> : null}
    </section>
  );
}
