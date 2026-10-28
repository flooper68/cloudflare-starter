import { ChevronRight } from "lucide-react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

import { focusRing } from "../lib/styles";
import { cn } from "../lib/utils";

/**
 * Collapsible sections. `type="single"` (optionally `collapsible`) keeps one open,
 * `type="multiple"` lets several stay open. Built on Radix Accordion, so it supports
 * `value`/`defaultValue`/`onValueChange` and arrow-key navigation between headers.
 */
export function Accordion({
  className,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Root>) {
  return (
    <AccordionPrimitive.Root
      className={cn("flex flex-col", className)}
      {...props}
    />
  );
}

export function AccordionItem({
  className,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      className={cn("border-b border-line last:border-b-0", className)}
      {...props}
    />
  );
}

export interface AccordionTriggerProps
  extends ComponentProps<typeof AccordionPrimitive.Trigger> {
  /** Icon before the title. */
  readonly icon?: ReactNode;
  /** Muted content at the right (a count, a status). */
  readonly trailing?: ReactNode;
}

export function AccordionTrigger({
  icon,
  trailing,
  className,
  children,
  ...props
}: AccordionTriggerProps) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          "group/accordion flex flex-1 items-center gap-2 rounded-md py-2.5 text-left text-sm font-medium text-fg",
          "transition-colors hover:text-fg disabled:pointer-events-none disabled:opacity-50",
          "[&_svg]:size-4 [&_svg]:shrink-0",
          focusRing,
          className
        )}
        {...props}
      >
        <ChevronRight
          aria-hidden
          className="size-3.5! text-fg-subtle transition-transform duration-150 group-data-[state=open]/accordion:rotate-90"
        />
        {icon ? <span className="flex text-fg-muted">{icon}</span> : null}
        <span className="flex-1">{children}</span>
        {trailing ? (
          <span className="text-xs font-normal text-fg-subtle">{trailing}</span>
        ) : null}
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      className="overflow-hidden text-sm text-fg-muted data-[state=open]:animate-collapse-down data-[state=closed]:animate-collapse-up"
      {...props}
    >
      <div className={cn("pb-3 pl-5.5", className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}
