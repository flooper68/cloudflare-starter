import { type RefObject, useEffect, useRef, useState } from "react";

import { cn } from "../lib/utils";

export interface ProfileMenuItem {
  readonly label: string;
  readonly href?: string;
  readonly onSelect?: () => void;
}

export interface ProfileMenuProps {
  readonly userName: string;
  readonly userEmail: string;
  readonly userInitials: string;
  readonly userImageUrl?: string | null;
  readonly menuItems?: readonly ProfileMenuItem[];
  readonly onSignOut?: () => void;
}

function useClickOutside(
  refs: readonly RefObject<HTMLElement | null>[],
  onOutside: () => void
) {
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const isInside = refs.some((ref) => ref.current?.contains(target));
      if (!isInside) {
        onOutside();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onOutside, refs]);
}

export function ProfileMenu({
  userName,
  userEmail,
  userInitials,
  userImageUrl,
  menuItems = [],
  onSignOut,
}: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside([triggerRef, menuRef], () => setOpen(false));

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleMenuAction(callback?: () => void) {
    setOpen(false);
    callback?.();
  }

  function handleLinkClick() {
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        className="flex items-center gap-3 rounded-full border border-zinc-300 bg-white/90 px-2 py-2 text-left shadow-sm transition hover:border-zinc-950"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open profile menu"
        onClick={() => setOpen((current) => !current)}
      >
        {userImageUrl ? (
          <img
            alt={userName}
            className="h-9 w-9 rounded-full object-cover"
            src={userImageUrl}
          />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white">
            {userInitials}
          </span>
        )}
        <span className="hidden pr-1 sm:block">
          <span className="block text-sm font-medium text-zinc-950">
            {userName}
          </span>
          <span className="block text-xs text-zinc-500">{userEmail}</span>
        </span>
      </button>

      {open ? (
        <div
          ref={menuRef}
          className="absolute right-0 z-20 mt-3 w-64 rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl"
          role="menu"
        >
          <div className="rounded-xl bg-zinc-50 px-3 py-3">
            <p className="text-sm font-semibold text-zinc-950">{userName}</p>
            <p className="mt-1 text-xs text-zinc-500">{userEmail}</p>
          </div>

          <div className="mt-2 space-y-1">
            {menuItems.map((item) =>
              item.href ? (
                <a
                  key={item.label}
                  className="block rounded-xl px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
                  href={item.href}
                  role="menuitem"
                  onClick={handleLinkClick}
                >
                  {item.label}
                </a>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
                  role="menuitem"
                  onClick={() => handleMenuAction(item.onSelect)}
                >
                  {item.label}
                </button>
              )
            )}

            {onSignOut ? (
              <button
                type="button"
                className={cn(
                  "block w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-red-50",
                  "text-red-600 hover:text-red-700"
                )}
                role="menuitem"
                onClick={() => handleMenuAction(onSignOut)}
              >
                Sign out
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
