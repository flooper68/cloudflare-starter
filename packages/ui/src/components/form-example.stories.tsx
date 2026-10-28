import type { Meta, StoryObj } from "@storybook/react-vite";
import { isBefore, startOfToday } from "date-fns";
import { Hash } from "lucide-react";
import { type FormEvent, useState } from "react";
import { AsyncSelect, type OptionLoader } from "./async-select";
import { Avatar } from "./avatar";
import { Button } from "./button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
import type { ComboboxOption } from "./combobox";
import { DatePicker } from "./date-picker";
import { Field } from "./field";
import { Input } from "./input";
import {
  type IssuePriority,
  type IssueStatus,
  issuePriorities,
  issuePriorityLabel,
  issueStatuses,
  issueStatusLabel,
  PriorityIcon,
  StatusIcon,
} from "./issue-icons";
import { Shortcut } from "./kbd";
import { MultiSelect } from "./multi-select";
import { NumberInput } from "./number-input";
import { Select, SelectItem } from "./select";
import { Switch } from "./switch";
import { Textarea } from "./textarea";

const people = [
  "Ada Lovelace",
  "Barbara Liskov",
  "Grace Hopper",
  "Ken Thompson",
  "Linus Torvalds",
  "Margaret Hamilton",
];

const searchPeople: OptionLoader = (query, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve(
        people
          .filter((name) => name.toLowerCase().includes(query.toLowerCase()))
          .map((name) => ({
            value: name.toLowerCase().replace(/\s/g, "-"),
            label: name,
            icon: <Avatar name={name} size="xs" />,
          }))
      );
    }, 300);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

const labels: ComboboxOption[] = [
  "Bug",
  "Feature",
  "Improvement",
  "Performance",
  "Security",
].map((label) => ({ value: label.toLowerCase(), label, icon: <Hash /> }));

interface Values {
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority | "";
  assignee: ComboboxOption | null;
  labels: readonly string[];
  dueDate: Date | null;
  estimate: number | null;
}

type Errors = Partial<Record<keyof Values, string>>;

function validate(values: Values): Errors {
  const errors: Errors = {};
  if (values.title.trim().length === 0) errors.title = "Give the issue a title";
  else if (values.title.trim().length < 5)
    errors.title = "Use at least 5 characters";
  if (!values.priority) errors.priority = "Set a priority";
  if (values.status !== "backlog" && !values.assignee) {
    errors.assignee = "Issues outside the backlog need an assignee";
  }
  if (values.labels.length === 0) errors.labels = "Add at least one label";
  if (values.dueDate && isBefore(values.dueDate, startOfToday())) {
    errors.dueDate = "Due date cannot be in the past";
  }
  if (values.estimate !== null && values.estimate > 13) {
    errors.estimate = "Split issues larger than 13 points";
  }
  return errors;
}

function CreateIssueForm({
  initialValues,
  initiallySubmitted = false,
}: {
  readonly initialValues?: Partial<Values>;
  readonly initiallySubmitted?: boolean;
}) {
  const [values, setValues] = useState<Values>({
    title: "",
    description: "",
    status: "todo",
    priority: "",
    assignee: null,
    labels: [],
    dueDate: null,
    estimate: null,
    ...initialValues,
  });
  const [submitted, setSubmitted] = useState(initiallySubmitted);
  const [createMore, setCreateMore] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const errors = submitted ? validate(values) : {};

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(validate(values)).length > 0) return;
    setCreated(values.title);
    if (createMore) {
      setValues((current) => ({ ...current, title: "", description: "" }));
      setSubmitted(false);
    }
  }

  return (
    <Card className="w-[560px]">
      <form onSubmit={handleSubmit} noValidate>
        <CardHeader>
          <CardTitle>New issue</CardTitle>
          <CardDescription>Engineering · Cycle 42</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Title" error={errors.title}>
            <Input
              value={values.title}
              onChange={(event) => set("title", event.target.value)}
              placeholder="Issue title"
              autoComplete="off"
            />
          </Field>
          <Field label="Description" optional>
            <Textarea
              autoGrow
              rows={3}
              maxRows={10}
              value={values.description}
              onChange={(event) => set("description", event.target.value)}
              placeholder="Add description…"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select
                value={values.status}
                onValueChange={(value) => set("status", value as IssueStatus)}
              >
                {issueStatuses.map((status) => (
                  <SelectItem
                    key={status}
                    value={status}
                    icon={<StatusIcon status={status} label="" />}
                  >
                    {issueStatusLabel[status]}
                  </SelectItem>
                ))}
              </Select>
            </Field>
            <Field label="Priority" error={errors.priority}>
              <Select
                value={values.priority}
                onValueChange={(value) =>
                  set("priority", value as IssuePriority)
                }
                placeholder="Set priority"
              >
                {issuePriorities.map((priority) => (
                  <SelectItem
                    key={priority}
                    value={priority}
                    icon={<PriorityIcon priority={priority} label="" />}
                  >
                    {issuePriorityLabel[priority]}
                  </SelectItem>
                ))}
              </Select>
            </Field>
            <Field label="Assignee" error={errors.assignee}>
              <AsyncSelect
                loader={searchPeople}
                value={values.assignee}
                onValueChange={(option) => set("assignee", option)}
                placeholder="Assign to…"
                searchPlaceholder="Search people…"
                deselectable
              />
            </Field>
            <Field label="Due date" error={errors.dueDate} optional>
              <DatePicker
                value={values.dueDate}
                onValueChange={(date) => set("dueDate", date)}
                weekStartsOn={1}
              />
            </Field>
            <Field label="Labels" error={errors.labels}>
              <MultiSelect
                options={labels}
                value={values.labels}
                onValueChange={(value) => set("labels", value)}
                placeholder="Add labels"
                maxVisible={2}
              />
            </Field>
            <Field label="Estimate" error={errors.estimate} optional>
              <NumberInput
                value={values.estimate}
                onValueChange={(value) => set("estimate", value)}
                min={0}
                unit="pts"
                placeholder="No estimate"
              />
            </Field>
          </div>
          {created ? (
            <p role="status" className="text-success text-xs">
              Created "{created}"
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="justify-between">
          <Switch
            size="sm"
            label="Create more"
            checked={createMore}
            onCheckedChange={setCreateMore}
          />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              trailing={<Shortcut keys={["⌘", "↵"]} className="opacity-80" />}
            >
              Create issue
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}

/**
 * The form controls composed in a realistic "New issue" form: Field for labels and errors,
 * Input, Textarea, Select, AsyncSelect, MultiSelect, DatePicker, NumberInput and Switch.
 * Submit to validate.
 */
const meta = {
  title: "Forms/Examples/Create issue form",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: () => <CreateIssueForm />,
};

/** Submitted with missing and invalid values: every rule shows its message. */
export const WithValidationErrors: Story = {
  render: () => (
    <CreateIssueForm
      initiallySubmitted
      initialValues={{
        title: "Bug",
        status: "in_progress",
        estimate: 21,
        dueDate: new Date(2024, 0, 15),
      }}
    />
  ),
};

export const Filled: Story = {
  render: () => (
    <CreateIssueForm
      initialValues={{
        title: "Slow people picker in large workspaces",
        description:
          "Opening the assignee picker takes ~4s in workspaces with more than 500 members.",
        status: "in_progress",
        priority: "high",
        assignee: {
          value: "grace-hopper",
          label: "Grace Hopper",
          icon: <Avatar name="Grace Hopper" size="xs" />,
        },
        labels: ["bug", "performance"],
        estimate: 3,
      }}
    />
  ),
};
