import { ChevronLeft } from "lucide-react";
import { Slot } from "radix-ui";
import { type HTMLAttributes, type ReactNode, useId } from "react";

import { focusRing } from "../../lib/styles";
import { cn } from "../../lib/utils";

export interface SettingsLayoutProps {
  /** Usually a SettingsNav. */
  readonly nav: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}

/** Linear's settings frame: a fixed nav on the left, a centred column of sections on the right. */
export function SettingsLayout({
  nav,
  children,
  className,
}: SettingsLayoutProps) {
  return (
    <div className={cn("flex h-full min-h-0 bg-canvas text-fg", className)}>
      {nav}
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-10 md:px-10 md:py-14">
          {children}
        </div>
      </main>
    </div>
  );
}

export interface SettingsNavProps {
  readonly children: ReactNode;
  /** "Back to app" link at the top. */
  readonly back?: ReactNode;
  readonly className?: string;
}

export function SettingsNav({ children, back, className }: SettingsNavProps) {
  return (
    <nav
      aria-label="Settings"
      className={cn(
        "hidden w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r border-line bg-surface px-3 py-3 md:flex",
        className
      )}
    >
      {back}
      {children}
    </nav>
  );
}

/** The "‹ Back to app" link at the top of the settings nav. */
export function SettingsNavBack({
  children = "Back to app",
  asChild = false,
  className,
  ...props
}: HTMLAttributes<HTMLButtonElement> & { readonly asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      type={asChild ? undefined : "button"}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md px-2 text-sm text-fg-muted hover:bg-hover hover:text-fg",
        focusRing,
        className
      )}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          <ChevronLeft className="size-4" />
          {children}
        </>
      )}
    </Comp>
  );
}

export function SettingsNavGroup({
  label,
  icon,
  children,
}: {
  readonly label: ReactNode;
  readonly icon?: ReactNode;
  readonly children: ReactNode;
}) {
  const id = useId();
  return (
    // biome-ignore lint/a11y/useSemanticElements: a nav group, not a form fieldset.
    <div role="group" aria-labelledby={id} className="flex flex-col gap-px">
      <div
        id={id}
        className="flex items-center gap-1.5 px-2 pb-1 text-xs font-medium text-fg-subtle [&_svg]:size-3.5"
      >
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

export interface SettingsNavItemProps
  extends HTMLAttributes<HTMLButtonElement> {
  readonly active?: boolean;
  readonly icon?: ReactNode;
  /** Render a link (e.g. router Link) instead of a button. */
  readonly asChild?: boolean;
}

export function SettingsNavItem({
  active = false,
  icon,
  asChild = false,
  className,
  children,
  ...props
}: SettingsNavItemProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      type={asChild ? undefined : "button"}
      aria-current={active ? "page" : undefined}
      data-active={active || undefined}
      className={cn(
        "flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-fg-muted transition-colors",
        "hover:bg-hover hover:text-fg data-[active]:bg-active data-[active]:text-fg",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        focusRing,
        className
      )}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {icon}
          <span className="truncate">{children}</span>
        </>
      )}
    </Comp>
  );
}

/** Page title and intro at the top of a settings page. */
export function SettingsHeader({
  title,
  description,
  actions,
}: {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-line pb-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-fg-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </header>
  );
}

export interface SettingsSectionProps {
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  readonly children: ReactNode;
  /** Danger zone styling. */
  readonly tone?: "default" | "danger";
  readonly className?: string;
}

/** A titled group of rows in one bordered panel. */
export function SettingsSection({
  title,
  description,
  children,
  tone = "default",
  className,
}: SettingsSectionProps) {
  const id = useId();
  return (
    <section
      aria-labelledby={title ? id : undefined}
      className={cn("flex flex-col gap-3", className)}
    >
      {title || description ? (
        <div className="flex flex-col gap-0.5">
          {title ? (
            <h2 id={id} className="text-base font-semibold text-fg">
              {title}
            </h2>
          ) : null}
          {description ? (
            <p className="text-sm text-fg-muted">{description}</p>
          ) : null}
        </div>
      ) : null}
      <div
        className={cn(
          "divide-y divide-line rounded-lg border bg-surface-raised",
          tone === "danger" ? "border-danger/40" : "border-line"
        )}
      >
        {children}
      </div>
    </section>
  );
}

export interface SettingsRowProps {
  readonly label: ReactNode;
  readonly description?: ReactNode;
  /** The control on the right: switch, select, button, input. */
  readonly children?: ReactNode;
  /** Id of the control, so the label is clickable and named. */
  readonly htmlFor?: string;
  readonly className?: string;
}

/** Label and description on the left, control on the right; stacks on narrow screens. */
export function SettingsRow({
  label,
  description,
  children,
  htmlFor,
  className,
}: SettingsRowProps) {
  const LabelTag = htmlFor ? "label" : "div";
  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <LabelTag htmlFor={htmlFor} className="text-sm font-medium text-fg">
          {label}
        </LabelTag>
        {description ? (
          <p className="text-sm text-fg-muted">{description}</p>
        ) : null}
      </div>
      {children ? (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
