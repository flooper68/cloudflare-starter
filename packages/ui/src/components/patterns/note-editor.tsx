import { type FormEvent, useState } from "react";

import { Button } from "../button";
import { errorMessage } from "../error-state";
import { Field } from "../field";
import { Input } from "../input";
import { Textarea } from "../textarea";

export interface NoteDraft {
  readonly title: string;
  readonly body: string;
}

export interface NoteEditorProps {
  readonly defaultValue?: NoteDraft;
  /** Saves; reject with a message-bearing error to show it under the form. */
  readonly onSave: (draft: NoteDraft) => Promise<void>;
  readonly onCancel?: () => void;
  /** The primary button's text ("Create note", "Save"). */
  readonly submitLabel?: string;
  readonly titleMax?: number;
  readonly bodyMax?: number;
}

/**
 * The form to write or edit a note: a title (required) and a plain-text body. Keeps the
 * draft when saving fails and shows why.
 */
export function NoteEditor({
  defaultValue = { title: "", body: "" },
  onSave,
  onCancel,
  submitLabel = "Save",
  titleMax = 200,
  bodyMax = 20_000,
}: NoteEditorProps) {
  const [title, setTitle] = useState(defaultValue.title);
  const [body, setBody] = useState(defaultValue.body);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setTitleError("A note needs a title");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ title: title.trim(), body });
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't save the note"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void submit(event)}>
      <Field label="Title" error={titleError}>
        <Input
          value={title}
          maxLength={titleMax}
          onChange={(event) => {
            setTitle(event.target.value);
            setTitleError(null);
          }}
        />
      </Field>
      <Field label="Note" optional description="Plain text.">
        <Textarea
          value={body}
          rows={8}
          maxLength={bodyMax}
          onChange={(event) => setBody(event.target.value)}
        />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" loading={saving}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
