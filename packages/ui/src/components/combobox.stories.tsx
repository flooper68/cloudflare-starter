import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box, Hash, Layers } from "lucide-react";
import { useState } from "react";
import { Avatar } from "./avatar";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Combobox, type ComboboxOption } from "./combobox";
import { Field } from "./field";

const projects: ComboboxOption[] = [
  {
    value: "mobile-v3",
    label: "Mobile app v3",
    icon: <Box />,
    group: "Engineering",
  },
  {
    value: "sync",
    label: "Sync engine rewrite",
    icon: <Box />,
    group: "Engineering",
  },
  {
    value: "api-v2",
    label: "Public API v2",
    icon: <Box />,
    group: "Engineering",
  },
  {
    value: "onboarding",
    label: "Onboarding refresh",
    icon: <Layers />,
    group: "Design",
  },
  {
    value: "brand",
    label: "Brand guidelines",
    icon: <Layers />,
    group: "Design",
  },
  {
    value: "pricing",
    label: "Pricing page experiment",
    icon: <Layers />,
    group: "Design",
    disabled: true,
    description: "Archived",
  },
];

const people: ComboboxOption[] = [
  "Ada Lovelace",
  "Grace Hopper",
  "Linus Torvalds",
  "Margaret Hamilton",
  "Ken Thompson",
  "Barbara Liskov",
].map((name) => ({
  value: name.toLowerCase().replace(/\s/g, "-"),
  label: name,
  icon: <Avatar name={name} size="xs" />,
  description: `${name.split(" ")[0]?.toLowerCase()}@acme.dev`,
}));

/**
 * Searchable single select (cmdk in a Popover). Type to filter, arrows to move, Enter to
 * pick, Escape to close. `onCreate` adds a "Create …" row when nothing matches.
 */
const meta = {
  title: "Forms/Combobox",
  component: Combobox,
  tags: ["autodocs"],
  args: {
    options: projects,
    placeholder: "Add to project",
    searchPlaceholder: "Search projects…",
    size: "md",
    disabled: false,
    deselectable: true,
    "aria-label": "Project",
  },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    options: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Open: Story = {
  args: { defaultOpen: true, defaultValue: "sync" },
  decorators: [
    (Story) => (
      <div className="h-96">
        <Story />
      </div>
    ),
  ],
};

export const People: Story = {
  args: {
    options: people,
    placeholder: "Assign to…",
    searchPlaceholder: "Search people…",
    defaultValue: "grace-hopper",
    "aria-label": "Assignee",
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <Combobox {...args} size="sm" />
      <Combobox {...args} size="md" />
      <Combobox {...args} size="lg" />
    </div>
  ),
};

export const States: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      <Field label="Disabled">
        <Combobox {...args} disabled defaultValue="api-v2" />
      </Field>
      <Field label="No options">
        <Combobox {...args} options={[]} emptyText="No projects yet" />
      </Field>
      <Field label="Project" error="Pick a project for this milestone">
        <Combobox {...args} />
      </Field>
    </div>
  ),
};

/** Type a label that does not exist (e.g. "Regression") and press Enter to create it. */
export const CreateNew: Story = {
  render: function Render() {
    const [labels, setLabels] = useState<ComboboxOption[]>(
      ["Bug", "Feature", "Improvement", "Performance"].map((label) => ({
        value: label.toLowerCase(),
        label,
        icon: <Hash />,
      }))
    );
    const [value, setValue] = useState<string | null>("bug");
    return (
      <Field label="Label" description="Type a new name to create a label.">
        <Combobox
          options={labels}
          value={value}
          onValueChange={setValue}
          placeholder="Add label"
          searchPlaceholder="Search or create…"
          onCreate={(query) => {
            const created = {
              value: query.toLowerCase(),
              label: query,
              icon: <Hash />,
            };
            setLabels((current) => [...current, created]);
            setValue(created.value);
          }}
          createLabel={(query) => (
            <>
              Create label <span className="font-medium">"{query}"</span>
            </>
          )}
        />
      </Field>
    );
  },
};

export const InAForm: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>New milestone</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Field label="Project">
          <Combobox
            options={projects}
            placeholder="Choose a project"
            defaultValue="mobile-v3"
          />
        </Field>
        <Field label="Owner" optional>
          <Combobox
            options={people}
            placeholder="Assign an owner"
            searchPlaceholder="Search people…"
          />
        </Field>
      </CardContent>
    </Card>
  ),
};
