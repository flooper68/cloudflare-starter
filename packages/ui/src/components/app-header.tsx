import type { ReactNode } from "react";

import { cn } from "../lib/utils";

export interface AppHeaderLink {
  readonly href: string;
  readonly label: string;
  readonly active?: boolean;
}

interface AppHeaderProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: string;
  readonly homeHref?: string;
  readonly homeLabel?: string;
  readonly links?: readonly AppHeaderLink[];
  readonly actions?: ReactNode;
}

export function AppHeader({
  eyebrow = "Cloudflare Starter",
  title,
  description,
  homeHref = "/",
  homeLabel = "Back home",
  links = [],
  actions,
}: AppHeaderProps) {
  return (
    <header className="rounded-[2rem] border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">
              {eyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-950">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {description}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              className="inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-50"
              href={homeHref}
            >
              {homeLabel}
            </a>
            {actions}
          </div>
        </div>

        {links.length > 0 ? (
          <nav className="flex flex-wrap gap-3">
            {links.map((link) => (
              <a
                key={link.href}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition",
                  link.active
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : "border-zinc-300 text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
                )}
                href={link.href}
              >
                {link.label}
              </a>
            ))}
          </nav>
        ) : null}
      </div>
    </header>
  );
}
