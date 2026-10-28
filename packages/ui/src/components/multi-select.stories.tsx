import type { Meta, StoryObj } from "@storybook/react-vite";
import { Hash } from "lucide-react";
import { useState } from "react";
import type { OptionLoader } from "./async-select";
import { Avatar } from "./avatar";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import type { ComboboxOption } from "./combobox";
import { Field } from "./field";
import { AsyncMultiSelect, MultiSelect } from "./multi-select";

const labels: ComboboxOption[] = [
  { value: "bug", label: "Bug", group: "Type" },
  { value: "feature", label: "Feature", group: "Type" },
  { value: "improvement", label: "Improvement", group: "Type" },
  { value: "frontend", label: "Frontend", group: "Area" },
  { value: "backend", label: "Backend", group: "Area" },
  { value: "infra", label: "Infrastructure", group: "Area" },
  { value: "mobile", label: "Mobile", group: "Area" },
  {
    value: "security",
    label: "Security",
    group: "Area",
    disabled: true,
    description: "Admins",
  },
].map((label) => ({ ...label, icon: <Hash /> }));

const directory = [
  "Ada Lovelace",
  "Alan Turing",
  "Barbara Liskov",
  "Donald Knuth",
  "Grace Hopper",
  "Ken Thompson",
  "Linus Torvalds",
  "Margaret Hamilton",
  "Radia Perlman",
];

function person(name: string): ComboboxOption {
  return {
    value: name.toLowerCase().replace(/\s/g, "-"),
    label: name,
    icon: <Avatar name={name} size="xs" />,
  };
}

const searchPeople: OptionLoader = (query, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const needle = query.toLowerCase();
      resolve(
        directory
          .filter((name) => name.toLowerCase().includes(needle))
          .map(person)
      );
    }, 400);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

/**
 * Pick several values. The trigger shows removable chips and collapses the rest into "+N"
 * (`maxVisible`); the list stays open while toggling. Backspace in the empty search removes
 * the last value. `AsyncMultiSelect` takes the same loader as AsyncSelect.
 */
const meta = {
  title: "Forms/MultiSelect",
  component: MultiSelect,
  tags: ["autodocs"],
  args: {
    options: labels,
    defaultValue: ["bug", "frontend"],
    placeholder: "Add labels",
    searchPlaceholder: "Search labels…",
    maxVisible: 3,
    size: "md",
    disabled: false,
    "aria-label": "Labels",
  },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    options: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="h-96 w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MultiSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Open: Story = {
  args: { defaultOpen: true },
};

export const Empty: Story = {
  args: { defaultValue: [] },
};

/** Five values with `maxVisible={2}`: two chips and "+3". */
export const Collapsed: Story = {
  args: {
    defaultValue: ["bug", "frontend", "backend", "infra", "mobile"],
    maxVisible: 2,
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <MultiSelect {...args} size="sm" />
      <MultiSelect {...args} size="md" />
      <MultiSelect {...args} size="lg" />
    </div>
  ),
};

export const States: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      <Field label="Disabled">
        <MultiSelect {...args} disabled />
      </Field>
      <Field label="Labels" error="Add at least one Area label">
        <MultiSelect {...args} defaultValue={["bug"]} />
      </Field>
    </div>
  ),
};

export const Async: Story = {
  render: () => (
    <Field label="Subscribers" description="Searches the workspace directory.">
      <AsyncMultiSelect
        loader={searchPeople}
        defaultValue={[person("Grace Hopper"), person("Ken Thompson")]}
        placeholder="Add people"
        searchPlaceholder="Search people…"
      />
    </Field>
  ),
};

export const AsyncError: Story = {
  render: () => (
    <AsyncMultiSelect
      aria-label="Subscribers"
      defaultOpen
      loader={(_query, signal) =>
        new Promise((_resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("Network error")),
            500
          );
          signal.addEventListener("abort", () => clearTimeout(timer));
        })
      }
      placeholder="Add people"
    />
  ),
};

export const InAForm: Story = {
  render: function Render() {
    const [value, setValue] = useState<readonly string[]>([
      "feature",
      "mobile",
    ]);
    return (
      <Card className="w-96">
        <CardHeader>
          <CardTitle>Filter issues</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Field label="Labels" description={`${value.length} selected`}>
            <MultiSelect
              options={labels}
              value={value}
              onValueChange={setValue}
              placeholder="Any label"
            />
          </Field>
        </CardContent>
      </Card>
    );
  },
};
