import type { Meta, StoryObj } from "@storybook/react-vite";
import { Globe, Lock, Users } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./card";
import { RadioGroup, RadioGroupItem } from "./radio-group";

/**
 * One choice out of a few visible options. Use `variant="card"` when each option needs a
 * sentence of explanation.
 */
const meta = {
  title: "Forms/RadioGroup",
  component: RadioGroup,
  tags: ["autodocs"],
  args: {
    orientation: "vertical",
    variant: "default",
    disabled: false,
    defaultValue: "week",
    "aria-label": "Cycle length",
  },
  argTypes: {
    orientation: {
      control: "inline-radio",
      options: ["vertical", "horizontal"],
    },
    variant: { control: "inline-radio", options: ["default", "card"] },
  },
  render: (args) => (
    <RadioGroup {...args}>
      <RadioGroupItem value="week" label="1 week" />
      <RadioGroupItem value="two-weeks" label="2 weeks" />
      <RadioGroupItem value="month" label="4 weeks" />
    </RadioGroup>
  ),
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Horizontal: Story = {
  args: { orientation: "horizontal" },
};

export const WithDescriptions: Story = {
  render: () => (
    <RadioGroup defaultValue="auto" aria-label="Auto-archive" className="w-80">
      <RadioGroupItem
        value="auto"
        label="Auto-archive after 1 month"
        description="Closed issues move to the archive 30 days after completion."
      />
      <RadioGroupItem
        value="quarter"
        label="Auto-archive after 3 months"
        description="Keeps a quarter of history visible in views."
      />
      <RadioGroupItem
        value="never"
        label="Never"
        description="Closed issues stay in views until archived manually."
      />
    </RadioGroup>
  ),
};

export const Cards: Story = {
  render: () => (
    <RadioGroup
      variant="card"
      defaultValue="team"
      aria-label="Visibility"
      className="w-96"
    >
      <RadioGroupItem
        value="private"
        icon={<Lock />}
        label="Private"
        description="Only you can see this project."
      />
      <RadioGroupItem
        value="team"
        icon={<Users />}
        label="Team"
        description="Everyone in Engineering can view and edit."
      />
      <RadioGroupItem
        value="workspace"
        icon={<Globe />}
        label="Workspace"
        description="All 142 members of Acme can view."
      />
    </RadioGroup>
  ),
};

export const CardsHorizontal: Story = {
  render: () => (
    <RadioGroup
      variant="card"
      orientation="horizontal"
      defaultValue="scrum"
      aria-label="Workflow template"
      className="w-[560px]"
    >
      <RadioGroupItem
        value="kanban"
        label="Kanban"
        description="Continuous flow, no cycles."
      />
      <RadioGroupItem
        value="scrum"
        label="Cycles"
        description="Two-week sprints with planning."
      />
      <RadioGroupItem
        value="triage"
        label="Triage"
        description="Inbox first, then assign."
      />
    </RadioGroup>
  ),
};

export const States: Story = {
  render: () => (
    <div className="flex gap-10">
      <RadioGroup defaultValue="a" disabled aria-label="Disabled group">
        <RadioGroupItem value="a" label="Disabled, selected" />
        <RadioGroupItem value="b" label="Disabled" />
      </RadioGroup>
      <RadioGroup defaultValue="a" aria-label="Partly disabled group">
        <RadioGroupItem value="a" label="Available" />
        <RadioGroupItem value="b" label="Enterprise plan only" disabled />
      </RadioGroup>
    </div>
  ),
};

export const InSettings: Story = {
  render: () => (
    <Card className="w-[420px]">
      <CardHeader>
        <CardTitle>Issue estimates</CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup defaultValue="fibonacci" aria-label="Estimate scale">
          <RadioGroupItem value="none" label="Not in use" />
          <RadioGroupItem
            value="exponential"
            label="Exponential"
            description="1, 2, 4, 8, 16"
          />
          <RadioGroupItem
            value="fibonacci"
            label="Fibonacci"
            description="1, 2, 3, 5, 8"
          />
          <RadioGroupItem
            value="tshirt"
            label="T-shirt sizes"
            description="XS, S, M, L, XL"
          />
        </RadioGroup>
      </CardContent>
      <CardFooter className="justify-end">
        <Button variant="primary" size="sm">
          Save
        </Button>
      </CardFooter>
    </Card>
  ),
};
