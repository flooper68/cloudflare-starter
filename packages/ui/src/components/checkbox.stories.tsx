import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";
import { Checkbox } from "./checkbox";

/**
 * A checkbox for choices submitted with a form. `checked="indeterminate"` shows a dash, for
 * a "select all" whose children are partly selected.
 */
const meta = {
  title: "Forms/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  args: {
    label: "Notify subscribers",
    disabled: false,
  },
  argTypes: {
    checked: {
      control: "inline-radio",
      options: [true, false, "indeterminate"],
    },
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithDescription: Story = {
  args: {
    label: "Create sub-issues automatically",
    description: "Split checklist items in the description into sub-issues.",
    defaultChecked: true,
  },
};

export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Checkbox label="Unchecked" />
      <Checkbox label="Checked" defaultChecked />
      <Checkbox label="Indeterminate" defaultChecked="indeterminate" />
      <Checkbox label="Disabled" disabled />
      <Checkbox label="Disabled and checked" disabled defaultChecked />
      <Checkbox label="Invalid" aria-invalid />
      <div className="flex items-center gap-2">
        <Checkbox aria-label="Select ENG-2148" />
        <span className="text-fg-muted text-sm">
          Without a label (table row)
        </span>
      </div>
    </div>
  ),
};

const teams = [
  { id: "eng", name: "Engineering", members: 24 },
  { id: "des", name: "Design", members: 8 },
  { id: "prd", name: "Product", members: 6 },
  { id: "ops", name: "Operations", members: 11 },
];

/** A "select all" checkbox driving a group, the common checkbox-group pattern. */
export const CheckboxGroup: Story = {
  render: function Render() {
    const [selected, setSelected] = useState<string[]>(["eng", "des"]);
    const all = selected.length === teams.length;
    const some = selected.length > 0 && !all;
    return (
      <Card className="w-80">
        <CardHeader>
          <CardTitle>Share project</CardTitle>
          <CardDescription>Teams that can see "Mobile app v3".</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Checkbox
            label="All teams"
            checked={all ? true : some ? "indeterminate" : false}
            onCheckedChange={(checked) =>
              setSelected(checked === true ? teams.map((team) => team.id) : [])
            }
          />
          <fieldset className="ml-6 flex flex-col gap-2.5">
            <legend className="sr-only">Teams</legend>
            {teams.map((team) => (
              <Checkbox
                key={team.id}
                label={team.name}
                description={`${team.members} members`}
                checked={selected.includes(team.id)}
                onCheckedChange={(checked) =>
                  setSelected((current) =>
                    checked === true
                      ? [...current, team.id]
                      : current.filter((id) => id !== team.id)
                  )
                }
              />
            ))}
          </fieldset>
        </CardContent>
      </Card>
    );
  },
};
