import { Flag } from "lucide-react";
import { useState } from "react";

import { Badge } from "../badge";
import { Callout } from "../callout";
import { Card } from "../card";
import {
  type FlagRuleDraft,
  FlagRuleEditor,
  type FlagRuleValue,
  type FlagRuleValueType,
} from "../flag-rule-editor";
import { Switch } from "../switch";

/** One catalog flag and what the store holds for it (`admin.flags.list`). */
export interface AdminFlag {
  readonly key: string;
  readonly description: string;
  readonly type: FlagRuleValueType;
  readonly default: FlagRuleValue;
  readonly owner: string;
  readonly removeWhen: string;
  readonly stored:
    | {
        readonly enabled: boolean;
        readonly fallthrough: FlagRuleValue | null;
        readonly rules: readonly FlagRuleDraft[];
        readonly updatedAt: string;
      }
    | { readonly invalid: true; readonly error: string }
    | null;
}

export interface AdminFlagCardProps {
  readonly definition: AdminFlag;
  /** Turns the flag on or off, keeping its fallthrough value. */
  readonly onToggle: (enabled: boolean) => Promise<void>;
  /** Replaces its targeting rules. */
  readonly onSaveRules: (rules: FlagRuleDraft[]) => Promise<void>;
}

const show = (value: FlagRuleValue) =>
  typeof value === "string" ? `"${value}"` : String(value);

/**
 * A feature flag in the admin portal: what it is for, who owns it and when it goes, its
 * switch and its targeting rules (FlagRuleEditor). Stored data that does not parse is
 * shown as such; saving overwrites it.
 */
export function AdminFlagCard({
  definition: flag,
  onToggle,
  onSaveRules,
}: AdminFlagCardProps) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const stored = flag.stored && "invalid" in flag.stored ? null : flag.stored;
  const invalid = flag.stored && "invalid" in flag.stored ? flag.stored : null;

  async function save(rules: FlagRuleDraft[]) {
    setSaving(true);
    setSaveError(null);
    try {
      await onSaveRules(rules);
    } catch (error) {
      setSaveError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            <Flag aria-hidden className="size-4 text-fg-muted" />
            <code className="text-sm font-medium text-fg">{flag.key}</code>
            <Badge tone="neutral">{flag.type}</Badge>
          </span>
          <p className="text-sm text-fg-muted">{flag.description}</p>
          <p className="text-xs text-fg-muted">
            Default {show(flag.default)} · owner {flag.owner} · remove when{" "}
            {flag.removeWhen}
          </p>
        </div>
        <Switch
          label={
            <>
              Enabled<span className="sr-only"> ({flag.key})</span>
            </>
          }
          labelPosition="before"
          checked={stored?.enabled ?? false}
          onCheckedChange={(enabled) => void onToggle(enabled)}
        />
      </div>
      {invalid ? (
        <Callout
          tone="warning"
          title="The stored configuration does not parse"
          description={`${invalid.error}. The flag resolves to its default until you save it again.`}
        />
      ) : null}
      <FlagRuleEditor
        flagKey={flag.key}
        valueType={flag.type}
        status="ready"
        rules={stored?.rules ?? []}
        onSave={(rules) => save(rules)}
        saving={saving}
        saveError={saveError ?? undefined}
      />
    </Card>
  );
}
