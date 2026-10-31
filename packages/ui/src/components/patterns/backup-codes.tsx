import { Button } from "../button";
import { Card, CardTitle } from "../card";
export interface BackupCodesProps {
  readonly codes: readonly string[];
  readonly onDone: () => void;
}
/** Recovery codes shown only after enrollment or regeneration; each code works once. */
export function BackupCodes({ codes, onDone }: BackupCodesProps) {
  return (
    <Card className="space-y-4">
      <CardTitle>Save your recovery codes</CardTitle>
      <p className="text-sm text-fg-muted">
        Store these somewhere safe. Each code works once if you lose your
        authenticator.
      </p>
      <ul
        aria-label="Recovery codes"
        className="grid grid-cols-2 gap-2 font-mono text-sm text-fg"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <Button variant="primary" onClick={onDone}>
        I saved my recovery codes
      </Button>
    </Card>
  );
}
