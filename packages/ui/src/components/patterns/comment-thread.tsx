import { ArrowUp, Paperclip, SmilePlus } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { focusRing } from "../../lib/styles";
import { cn } from "../../lib/utils";
import { IconButton } from "../button";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { Spinner } from "../spinner";
import { Tooltip } from "../tooltip";
import { formatRelative, PersonAvatar, useControllable } from "./internal";
import type { IssuePerson } from "./issue-glyphs";

export interface CommentReaction {
  readonly emoji: string;
  readonly count: number;
  /** The current user reacted with this emoji. */
  readonly reacted?: boolean;
  /** Names for the tooltip. */
  readonly people?: readonly string[];
}

export interface CommentData {
  readonly id: string;
  readonly author: IssuePerson;
  readonly body: ReactNode;
  readonly createdAt: Date | string;
  readonly edited?: boolean;
  readonly reactions?: readonly CommentReaction[];
}

const defaultEmojis = ["👍", "👎", "❤️", "🎉", "😄", "👀", "🚀", "🙏"] as const;

function ReactionPicker({
  onPick,
  emojis,
}: {
  readonly onPick: (emoji: string) => void;
  readonly emojis: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content="Add reaction">
        <PopoverTrigger asChild>
          <IconButton label="Add reaction" size="xs">
            <SmilePlus />
          </IconButton>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent className="flex w-auto gap-0.5 p-1">
        {emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={`React with ${emoji}`}
            onClick={() => {
              onPick(emoji);
              setOpen(false);
            }}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-md text-base hover:bg-hover",
              focusRing
            )}
          >
            {emoji}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export interface CommentItemProps {
  readonly comment: CommentData;
  /** Toggle the current user's reaction. */
  readonly onReact?: (emoji: string) => void;
  readonly emojis?: readonly string[];
  readonly className?: string;
}

/** One comment: avatar, author, relative time, body and the reactions row. */
export function CommentItem({
  comment,
  onReact,
  emojis = defaultEmojis,
  className,
}: CommentItemProps) {
  const created =
    typeof comment.createdAt === "string"
      ? new Date(comment.createdAt)
      : comment.createdAt;
  const reactions = comment.reactions?.filter((r) => r.count > 0) ?? [];

  return (
    <article
      className={cn(
        "group/comment rounded-lg border border-line bg-surface-raised px-4 py-3",
        className
      )}
    >
      <header className="flex items-center gap-2 text-sm">
        <PersonAvatar person={comment.author} size="sm" />
        <span className="font-medium text-fg">{comment.author.name}</span>
        <time
          dateTime={created.toISOString()}
          title={created.toLocaleString()}
          className="text-fg-subtle"
        >
          {formatRelative(created)}
        </time>
        {comment.edited ? (
          <span className="text-fg-subtle">(edited)</span>
        ) : null}
      </header>
      <div className="mt-2 text-sm leading-relaxed text-fg whitespace-pre-wrap">
        {comment.body}
      </div>
      {reactions.length > 0 || onReact ? (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {reactions.map((reaction) => {
            const chip = (
              <button
                key={reaction.emoji}
                type="button"
                aria-pressed={reaction.reacted ?? false}
                aria-label={`${reaction.emoji} ${reaction.count}`}
                onClick={() => onReact?.(reaction.emoji)}
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs tabular-nums transition-colors",
                  reaction.reacted
                    ? "border-accent/60 bg-accent-subtle text-fg"
                    : "border-line text-fg-muted hover:border-line-strong hover:bg-hover",
                  focusRing
                )}
              >
                <span aria-hidden="true">{reaction.emoji}</span>
                {reaction.count}
              </button>
            );
            return reaction.people && reaction.people.length > 0 ? (
              <Tooltip
                key={reaction.emoji}
                content={reaction.people.join(", ")}
              >
                {chip}
              </Tooltip>
            ) : (
              <span key={reaction.emoji}>{chip}</span>
            );
          })}
          {onReact ? (
            <span
              className={cn(
                "transition-opacity",
                reactions.length > 0 &&
                  "opacity-0 group-hover/comment:opacity-100 focus-within:opacity-100"
              )}
            >
              <ReactionPicker onPick={onReact} emojis={emojis} />
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export interface CommentThreadProps {
  readonly comments: readonly CommentData[];
  readonly onReact?: (commentId: string, emoji: string) => void;
  /** Usually a CommentComposer, shown after the comments. */
  readonly composer?: ReactNode;
  readonly className?: string;
}

/** A list of comments with the composer at the end, as in an issue's activity. */
export function CommentThread({
  comments,
  onReact,
  composer,
  className,
}: CommentThreadProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          onReact={onReact ? (emoji) => onReact(comment.id, emoji) : undefined}
        />
      ))}
      {composer}
    </div>
  );
}

export interface CommentComposerProps {
  /** Shown before the box; omit to hide the avatar. */
  readonly author?: IssuePerson;
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  /** ⌘↵ / Ctrl+↵ or the send button. Return a promise to show the pending state. */
  readonly onSubmit?: (body: string) => void | Promise<void>;
  /** Attach button; omit to hide it. */
  readonly onAttach?: () => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly autoFocus?: boolean;
  /** Max height before the textarea scrolls, in px. */
  readonly maxHeight?: number;
  readonly className?: string;
}

/**
 * Comment box: auto-growing textarea, attach and send buttons, ⌘↵ to send. Clears itself
 * after a successful submit when uncontrolled.
 */
export function CommentComposer({
  author,
  value,
  defaultValue = "",
  onValueChange,
  onSubmit,
  onAttach,
  placeholder = "Leave a comment…",
  disabled = false,
  autoFocus = false,
  maxHeight = 320,
  className,
}: CommentComposerProps) {
  const [text, setText] = useControllable(value, defaultValue, onValueChange);
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = text.trim().length > 0 && !pending && !disabled;

  // Grow with the content up to maxHeight.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the text changes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [text, maxHeight]);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSend) return;
    setPending(true);
    try {
      await onSubmit?.(text.trim());
      setText("");
    } finally {
      setPending(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <form onSubmit={submit} className={cn("flex items-start gap-3", className)}>
      {author ? (
        <PersonAvatar person={author} size="md" className="mt-2" />
      ) : null}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col rounded-lg border border-line bg-input transition-colors",
          "focus-within:border-line-strong hover:border-line-strong",
          disabled && "opacity-50"
        )}
      >
        <textarea
          ref={ref}
          rows={2}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          // biome-ignore lint/a11y/noAutofocus: opt-in for reply boxes opened on purpose.
          autoFocus={autoFocus}
          aria-label="Comment"
          className="w-full resize-none bg-transparent px-3 pt-2.5 text-sm text-fg outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed"
        />
        <div className="flex items-center justify-end gap-1 px-2 pb-2">
          {onAttach ? (
            <Tooltip content="Attach files">
              <IconButton
                label="Attach files"
                size="sm"
                onClick={onAttach}
                disabled={disabled}
              >
                <Paperclip />
              </IconButton>
            </Tooltip>
          ) : null}
          <Tooltip content="Send" shortcut={["⌘", "↵"]}>
            <IconButton
              label="Send comment"
              type="submit"
              variant={canSend ? "primary" : "secondary"}
              size="sm"
              disabled={!canSend}
              aria-busy={pending || undefined}
            >
              {pending ? <Spinner /> : <ArrowUp />}
            </IconButton>
          </Tooltip>
        </div>
      </div>
    </form>
  );
}
