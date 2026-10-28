import { cloneElement, type ReactElement, type ReactNode, useId } from "react";

import { cn } from "../lib/utils";
import { Label } from "./label";

export function FieldError({
  message,
  id,
}: {
  readonly message?: string | null;
  readonly id?: string;
}) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-danger">
      {message}
    </p>
  );
}

export function FieldDescription({
  children,
  id,
}: {
  readonly children: ReactNode;
  readonly id?: string;
}) {
  return (
    <p id={id} className="text-xs text-fg-subtle">
      {children}
    </p>
  );
}

export interface FieldProps {
  readonly label: ReactNode;
  /** Help text under the control. */
  readonly description?: ReactNode;
  /** Error under the control; also marks the control aria-invalid. */
  readonly error?: string | null;
  /** Shown after the label. */
  readonly optional?: boolean;
  readonly className?: string;
  /** One form control. Field wires id, aria-describedby and aria-invalid onto it. */
  readonly children: ReactElement<Record<string, unknown>>;
}

/** Label, control, help text and error, wired together for screen readers. */
export function Field({
  label,
  description,
  error,
  optional,
  className,
  children,
}: FieldProps) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control = cloneElement(children, {
    id: (children.props.id as string | undefined) ?? id,
    "aria-describedby":
      [descriptionId, errorId].filter(Boolean).join(" ") || undefined,
    "aria-invalid": error ? true : undefined,
  });

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={(children.props.id as string | undefined) ?? id}>
        {label}
        {optional ? (
          <span className="ml-1 font-normal text-fg-subtle">(optional)</span>
        ) : null}
      </Label>
      {control}
      {description && !error ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      <FieldError id={errorId} message={error} />
    </div>
  );
}
