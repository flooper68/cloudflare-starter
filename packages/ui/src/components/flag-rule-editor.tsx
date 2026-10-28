import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { cn } from "../lib/utils";
import { Button, IconButton } from "./button";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { FieldError } from "./field";
import { Input } from "./input";
import { NumberInput } from "./number-input";
import { PercentageInput } from "./percentage-input";
import { Select, SelectItem } from "./select";
import { Skeleton } from "./skeleton";
import { Switch } from "./switch";

export type FlagRuleValue = boolean | string | number;
export type FlagRuleValueType = "boolean" | "string" | "number";

/** One targeting rule, in the shape the flag admin procedures take. */
export type FlagRuleDraft =
  | {
      readonly kind: "workspace";
      readonly workspaceId: string;
      readonly value: FlagRuleValue;
    }
  | {
      readonly kind: "plan";
      readonly planId: string;
      readonly value: FlagRuleValue;
    }
  | {
      readonly kind: "percentage";
      readonly percentageBp: number;
      readonly value: FlagRuleValue;
    };

export interface FlagRuleEditorProps {
  /** The flag the rules belong to, shown in labels. */
  readonly flagKey: string;
  /** The flag's catalog type: decides the value control of each rule. */
  readonly valueType: FlagRuleValueType;
  /** "loading" and "error" are the states of loading the saved rules. */
  readonly status: "loading" | "error" | "ready";
  /** The saved rules, in order. The editor starts from them and resets when they change. */
  readonly rules?: readonly FlagRuleDraft[];
  /** Why loading failed (status "error"). */
  readonly error?: unknown;
  readonly onRetry?: () => unknown;
  /** Called with the full ordered rule list; the parent saves it. */
  readonly onSave: (rules: FlagRuleDraft[]) => unknown;
  /** The save is in flight. */
  readonly saving?: boolean;
  /** Why the last save failed. */
  readonly saveError?: unknown;
  readonly className?: string;
}

const KIND_LABELS = {
  workspace: "Workspace is",
  plan: "Plan is",
  percentage: "Percentage of",
} as const;

type Kind = FlagRuleDraft["kind"];
interface Row {
  readonly id: number;
  readonly rule: FlagRuleDraft;
}

function defaultValue(type: FlagRuleValueType): FlagRuleValue {
  if (type === "boolean") return true;
  if (type === "number") return 0;
  return "";
}

function withKind(rule: FlagRuleDraft, kind: Kind): FlagRuleDraft {
  if (kind === rule.kind) return rule;
  if (kind === "workspace") return { kind, workspaceId: "", value: rule.value };
  if (kind === "plan") return { kind, planId: "", value: rule.value };
  return { kind, percentageBp: 1000, value: rule.value };
}

function problemOf(rule: FlagRuleDraft): string | null {
  if (rule.kind === "workspace" && rule.workspaceId.trim() === "")
    return "Enter the workspace id";
  if (rule.kind === "plan" && rule.planId.trim() === "")
    return "Enter the plan id";
  return null;
}

function sameRules(
  a: readonly FlagRuleDraft[],
  b: readonly FlagRuleDraft[]
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Edits a feature flag's ordered targeting rules: each rule matches a workspace, a plan or
 * a percentage of workspaces or users, and gives the flag a value; the first rule that
 * matches wins, everyone else gets the flag's fallthrough value. Rules can be added,
 * reordered and removed; Save sends the whole list. Handles loading, error and empty
 * states; the component never fetches, the parent passes `rules` and saves in `onSave`.
 */
export function FlagRuleEditor({
  flagKey,
  valueType,
  status,
  rules = [],
  error,
  onRetry,
  onSave,
  saving = false,
  saveError,
  className,
}: FlagRuleEditorProps) {
  const baseId = useId();
  const [nextId, setNextId] = useState(rules.length);
  const [rows, setRows] = useState<Row[]>(() =>
    rules.map((rule, id) => ({ id, rule }))
  );
  const savedKey = JSON.stringify(rules);
  // Start again from the saved rules whenever they change (after a save or reload).
  // biome-ignore lint/correctness/useExhaustiveDependencies: savedKey stands for rules
  useEffect(() => {
    setRows(rules.map((rule, id) => ({ id, rule })));
    setNextId(rules.length);
  }, [savedKey]);

  if (status === "loading") {
    return (
      <div
        className={cn("flex flex-col gap-2", className)}
        role="status"
        aria-busy="true"
        aria-label={`Loading rules for ${flagKey}`}
      >
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  if (status === "error") {
    return (
      <ErrorState
        variant="compact"
        className={className}
        title="Couldn't load the rules"
        error={error}
        onRetry={onRetry}
      />
    );
  }

  const draft = rows.map((row) => row.rule);
  const dirty = !sameRules(draft, rules);
  const invalid = draft.some((rule) => problemOf(rule) !== null);

  const update = (id: number, rule: FlagRuleDraft) =>
    setRows((current) =>
      current.map((row) => (row.id === id ? { id, rule } : row))
    );
  const move = (index: number, by: -1 | 1) =>
    setRows((current) => {
      const next = [...current];
      const [row] = next.splice(index, 1);
      if (row) next.splice(index + by, 0, row);
      return next;
    });
  const remove = (id: number) =>
    setRows((current) => current.filter((row) => row.id !== id));
  const add = () => {
    setRows((current) => [
      ...current,
      {
        id: nextId,
        rule: {
          kind: "percentage",
          percentageBp: 1000,
          value: defaultValue(valueType),
        },
      },
    ]);
    setNextId((id) => id + 1);
  };

  const addButton = (
    <Button variant="secondary" size="sm" icon={<Plus />} onClick={add}>
      Add rule
    </Button>
  );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p className="text-fg-muted text-xs">
        Rules apply in order; the first that matches sets the value. Everyone
        else gets the fallthrough value.
      </p>

      {rows.length === 0 ? (
        <EmptyState
          title="No targeting rules"
          description="Everyone gets the fallthrough value. Add a rule to target a workspace, a plan or a percentage."
          primaryAction={addButton}
        />
      ) : (
        <ol
          aria-label={`Rules for ${flagKey}`}
          className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface"
        >
          {rows.map(({ id, rule }, index) => {
            const label = `Rule ${index + 1}`;
            const problem = problemOf(rule);
            const errorId = `${baseId}-${id}-error`;
            return (
              <li
                key={id}
                aria-label={label}
                className="flex flex-col gap-1.5 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-start gap-2">
                  <span className="mt-1.5 w-5 text-fg-muted text-xs tabular-nums">
                    {index + 1}.
                  </span>
                  <Select
                    aria-label={`${label} condition`}
                    size="md"
                    className="w-36"
                    value={rule.kind}
                    onValueChange={(kind) =>
                      update(id, withKind(rule, kind as Kind))
                    }
                  >
                    {(Object.keys(KIND_LABELS) as Kind[]).map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {KIND_LABELS[kind]}
                      </SelectItem>
                    ))}
                  </Select>

                  <div className="min-w-40 flex-1">
                    {rule.kind === "percentage" ? (
                      <PercentageInput
                        aria-label={`${label} percentage`}
                        value={rule.percentageBp}
                        onValueChange={(percentageBp) =>
                          update(id, {
                            ...rule,
                            percentageBp: percentageBp ?? 0,
                          })
                        }
                      />
                    ) : (
                      <Input
                        aria-label={`${label} ${rule.kind === "workspace" ? "workspace id" : "plan id"}`}
                        aria-invalid={problem ? true : undefined}
                        aria-describedby={problem ? errorId : undefined}
                        placeholder={
                          rule.kind === "workspace" ? "ws_8f2k1" : "business"
                        }
                        value={
                          rule.kind === "workspace"
                            ? rule.workspaceId
                            : rule.planId
                        }
                        onChange={(event) =>
                          update(
                            id,
                            rule.kind === "workspace"
                              ? { ...rule, workspaceId: event.target.value }
                              : { ...rule, planId: event.target.value }
                          )
                        }
                      />
                    )}
                  </div>

                  <span className="mt-1.5 text-fg-muted text-xs">then</span>
                  <div className="flex min-h-8 items-center">
                    {valueType === "boolean" ? (
                      <span className="flex items-center gap-2">
                        <Switch
                          aria-label={`${label} value`}
                          checked={rule.value === true}
                          onCheckedChange={(checked) =>
                            update(id, { ...rule, value: checked })
                          }
                        />
                        <span aria-hidden className="w-6 text-fg text-xs">
                          {rule.value === true ? "On" : "Off"}
                        </span>
                      </span>
                    ) : valueType === "number" ? (
                      <NumberInput
                        aria-label={`${label} value`}
                        className="w-28"
                        value={typeof rule.value === "number" ? rule.value : 0}
                        onValueChange={(value) =>
                          update(id, { ...rule, value: value ?? 0 })
                        }
                      />
                    ) : (
                      <Input
                        aria-label={`${label} value`}
                        className="w-36"
                        value={String(rule.value)}
                        onChange={(event) =>
                          update(id, { ...rule, value: event.target.value })
                        }
                      />
                    )}
                  </div>

                  <div className="ml-auto flex items-center gap-0.5">
                    <IconButton
                      label={`Move ${label.toLowerCase()} up`}
                      size="sm"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp />
                    </IconButton>
                    <IconButton
                      label={`Move ${label.toLowerCase()} down`}
                      size="sm"
                      disabled={index === rows.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown />
                    </IconButton>
                    <IconButton
                      label={`Remove ${label.toLowerCase()}`}
                      size="sm"
                      onClick={() => remove(id)}
                    >
                      <Trash2 />
                    </IconButton>
                  </div>
                </div>
                {problem ? <FieldError id={errorId} message={problem} /> : null}
              </li>
            );
          })}
        </ol>
      )}

      {saveError ? (
        <ErrorState
          variant="inline"
          title="Couldn't save the rules"
          error={saveError}
        />
      ) : null}

      <div className="flex items-center gap-2">
        {rows.length > 0 ? addButton : null}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={!dirty || saving}
            onClick={() => {
              setRows(rules.map((rule, id) => ({ id, rule })));
              setNextId(rules.length);
            }}
          >
            Discard changes
          </Button>
          <Button
            size="sm"
            loading={saving}
            disabled={!dirty || invalid || saving}
            onClick={() => onSave(draft)}
          >
            Save rules
          </Button>
        </div>
      </div>
    </div>
  );
}
