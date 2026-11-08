import type { HTMLAttributes, ReactNode } from "react";

import { focusRing } from "../lib/styles";
import { cn } from "../lib/utils";
import { Badge, type Tone } from "./badge";

/** The tone of each Keep a Changelog change type; any other type is neutral. */
export const changeTypeTone: Readonly<Record<string, Tone>> = {
  Added: "success",
  Changed: "info",
  Deprecated: "warning",
  Removed: "neutral",
  Fixed: "accent",
  Security: "danger",
};

export interface ReleaseGroup {
  /** Added, Changed, Deprecated, Removed, Fixed or Security. */
  readonly type: string;
  readonly items: readonly ReactNode[];
}

export interface ReleaseEntry {
  /** The section's id, the target of "On this page". */
  readonly id: string;
  /** `0.1.0`, or `Unreleased`. */
  readonly version: string;
  /** `YYYY-MM-DD`; none for unreleased changes. */
  readonly date?: string;
  /** Where the release's full diff is (a compare or tag URL). */
  readonly href?: string;
  /** A sentence or two about the release. */
  readonly summary?: ReactNode;
  readonly groups: readonly ReleaseGroup[];
}

export interface ReleaseNotesProps extends HTMLAttributes<HTMLOListElement> {
  readonly releases: readonly ReleaseEntry[];
  /** Shown for a release with no entries (Unreleased right after a release). */
  readonly emptyLabel?: string;
}

const inline = [
  "[&_code]:rounded-sm [&_code]:bg-active [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[0.92em]",
  "[&_a]:rounded-sm [&_a]:text-accent-text [&_a]:underline [&_a]:decoration-line-strong [&_a]:underline-offset-2 [&_a:hover]:decoration-current",
  "[&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-focus",
  "[&_strong]:font-semibold [&_strong]:text-fg",
].join(" ");

function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      });
}

/**
 * Release notes: one section per release, newest first, with its version and date and
 * its changes grouped by type, each group labelled with a tone (Added, Changed, Fixed,
 * Security…). The version and date sit beside the changes on wide screens and above
 * them on phones. Static markup.
 */
export function ReleaseNotes({
  releases,
  emptyLabel = "Nothing yet.",
  className,
  ...props
}: ReleaseNotesProps) {
  return (
    <ol className={cn("flex flex-col", className)} {...props}>
      {releases.map((release) => {
        const unreleased = !release.date;
        return (
          <li
            key={release.id}
            className="grid gap-x-8 gap-y-4 border-t border-line py-8 first:border-t-0 first:pt-2 md:grid-cols-[11rem_minmax(0,1fr)]"
          >
            <div className="flex flex-col gap-1.5 md:sticky md:top-6 md:self-start">
              <h2
                id={release.id}
                className="scroll-mt-20 text-xl font-semibold tracking-tight text-fg"
              >
                {release.href ? (
                  <a
                    href={release.href}
                    className={cn("rounded-sm hover:underline", focusRing)}
                  >
                    {release.version}
                  </a>
                ) : (
                  release.version
                )}
              </h2>
              {release.date ? (
                <time dateTime={release.date} className="text-sm text-fg-muted">
                  {formatDate(release.date)}
                </time>
              ) : (
                <span>
                  <Badge tone="warning">In progress</Badge>
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              {release.summary ? (
                <p className={cn("text-base leading-7 text-fg", inline)}>
                  {release.summary}
                </p>
              ) : null}
              {release.groups.length === 0 ? (
                <p className="text-sm text-fg-muted">
                  {unreleased ? emptyLabel : "No changes listed."}
                </p>
              ) : (
                release.groups.map((group) => (
                  <div key={group.type} className="flex flex-col gap-3">
                    <h3>
                      <Badge
                        tone={changeTypeTone[group.type] ?? "neutral"}
                        size="md"
                      >
                        {group.type}
                      </Badge>
                    </h3>
                    <ul
                      className={cn(
                        "flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-fg-muted marker:text-fg-subtle",
                        inline
                      )}
                    >
                      {group.items.map((item, index) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: entries have no identity beyond their order.
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
