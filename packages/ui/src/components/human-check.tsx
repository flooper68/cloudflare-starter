import { useEffect, useRef, useState } from "react";

import { cn } from "../lib/utils";
import { ErrorState } from "./error-state";
import { Skeleton } from "./skeleton";

/** The part of Cloudflare Turnstile's browser API the widget uses (explicit rendering). */
export interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      readonly sitekey: string;
      readonly action?: string;
      readonly theme?: "auto" | "light" | "dark";
      readonly callback?: (token: string) => void;
      readonly "error-callback"?: () => void;
      readonly "expired-callback"?: () => void;
    }
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Cloudflare's script, in explicit-render mode (the widget renders where we say). */
export const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

const scripts = new Map<string, Promise<TurnstileApi>>();

/** Loads the Turnstile script once per URL and resolves with `window.turnstile`. */
export function loadTurnstileScript(url: string): Promise<TurnstileApi> {
  const cached = scripts.get(url);
  if (cached) return cached;
  const loading = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () =>
      window.turnstile
        ? resolve(window.turnstile)
        : reject(new Error("The script did not define turnstile"));
    script.onerror = () => reject(new Error("The script did not load"));
    document.head.append(script);
  });
  // A failed load may be retried.
  loading.catch(() => scripts.delete(url));
  scripts.set(url, loading);
  return loading;
}

type Status = "loading" | "ready" | "verified" | "failed" | "unavailable";

export interface HumanCheckProps {
  /** The widget's public site key (TURNSTILE_SITE_KEY). */
  readonly siteKey: string;
  /** What the token is for; the server checks it (`sign-up`, `sign-in`, `password-reset`). */
  readonly action: string;
  /** Called with a fresh token, and with null when it expires or is reset. */
  readonly onTokenChange: (token: string | null) => void;
  /** Change it to get a new token (tokens are single use: reset after each submit). */
  readonly resetKey?: number;
  readonly theme?: "auto" | "light" | "dark";
  /** Where Turnstile is loaded from; stories point it at a fake. */
  readonly scriptUrl?: string;
  /** Loads the API; defaults to adding `scriptUrl` as a script tag. For stories and tests. */
  readonly loadTurnstile?: (scriptUrl: string) => Promise<TurnstileApi>;
  readonly className?: string;
}

/**
 * Cloudflare Turnstile, the human check on sign-up, sign-in and password reset. Renders
 * the widget, reports its token, and shows loading and error states with a way to try
 * again. The server verifies the token; without one the form cannot pass.
 */
export function HumanCheck({
  siteKey,
  action,
  onTokenChange,
  resetKey = 0,
  theme = "auto",
  scriptUrl = TURNSTILE_SCRIPT_URL,
  loadTurnstile = loadTurnstileScript,
  className,
}: HumanCheckProps) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<{ api: TurnstileApi; id: string } | null>(null);
  const report = useRef(onTokenChange);
  report.current = onTokenChange;
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the load on retry.
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    loadTurnstile(scriptUrl).then(
      (api) => {
        if (cancelled || !container.current) return;
        setStatus("ready");
        const id = api.render(container.current, {
          sitekey: siteKey,
          action,
          theme,
          callback: (token) => {
            setStatus("verified");
            report.current(token);
          },
          "error-callback": () => {
            setStatus("failed");
            report.current(null);
          },
          "expired-callback": () => {
            setStatus("ready");
            report.current(null);
          },
        });
        widget.current = { api, id };
      },
      () => {
        if (!cancelled) setStatus("unavailable");
      }
    );
    return () => {
      cancelled = true;
      if (widget.current) {
        widget.current.api.remove(widget.current.id);
        widget.current = null;
      }
    };
  }, [siteKey, action, theme, scriptUrl, loadTurnstile, attempt]);

  useEffect(() => {
    if (resetKey === 0 || !widget.current) return;
    widget.current.api.reset(widget.current.id);
    setStatus("ready");
    report.current(null);
  }, [resetKey]);

  function retry() {
    report.current(null);
    if (status === "failed" && widget.current) {
      widget.current.api.reset(widget.current.id);
      setStatus("ready");
    } else {
      setAttempt((value) => value + 1);
    }
  }

  return (
    <fieldset
      aria-label="Human check"
      aria-busy={status === "loading" || undefined}
      className={cn(
        "m-0 flex min-h-16 min-w-0 flex-col gap-2 border-0 p-0",
        className
      )}
    >
      {status === "loading" ? (
        <div className="flex h-16 items-center gap-3 rounded-md border border-line px-3">
          <Skeleton className="size-6 rounded-sm" />
          <span className="text-sm text-fg-muted">
            Loading the human check…
          </span>
        </div>
      ) : null}
      {status === "failed" || status === "unavailable" ? (
        <ErrorState
          variant="inline"
          title={null}
          description={
            status === "failed"
              ? "The human check did not pass."
              : "The human check could not load. Check your connection."
          }
          onRetry={retry}
        />
      ) : null}
      <div
        ref={container}
        className={cn(
          (status === "loading" || status === "unavailable") && "hidden"
        )}
      />
      <span className="sr-only" role="status">
        {status === "verified" ? "Verified as human" : ""}
      </span>
    </fieldset>
  );
}
