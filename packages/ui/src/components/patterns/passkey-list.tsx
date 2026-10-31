import { Button } from "../button";
import { EmptyState } from "../empty-state";
export interface PasskeyListProps {
  readonly items: readonly {
    readonly id: string;
    readonly name?: string | null;
    readonly createdAt?: string | null;
  }[];
  readonly onAdd: () => void;
  readonly onRemove: (id: string) => void;
  readonly pending?: boolean;
}
/** A person's registered passkeys with explicit add and remove actions. */
export function PasskeyList({
  items,
  onAdd,
  onRemove,
  pending,
}: PasskeyListProps) {
  return (
    <div className="space-y-3">
      {items.length ? (
        <ul className="space-y-2">
          {items.map((key) => (
            <li
              key={key.id}
              className="flex items-center justify-between gap-3 rounded-md border border-line p-3 text-sm text-fg"
            >
              <span>{key.name || "Passkey"}</span>
              <Button
                size="sm"
                disabled={pending}
                onClick={() => onRemove(key.id)}
                aria-label={`Remove ${key.name || "passkey"}`}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No passkeys yet"
          description="Add a passkey to sign in with your device. Your second-factor policy still applies."
        />
      )}
      <Button onClick={onAdd} loading={pending}>
        Add passkey
      </Button>
    </div>
  );
}
