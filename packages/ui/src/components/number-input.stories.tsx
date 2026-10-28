import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Field } from "./field";
import { NumberInput } from "./number-input";

/**
 * A number with a stepper. ArrowUp/Down step (Shift for ×10), Home/End jump to the bounds;
 * typed text is parsed, clamped and rounded to `step` on Enter or blur.
 */
const meta = {
  title: "Forms/NumberInput",
  component: NumberInput,
  tags: ["autodocs"],
  args: {
    defaultValue: 3,
    min: 0,
    max: 21,
    step: 1,
    size: "md",
    disabled: false,
    hideStepper: false,
    "aria-label": "Estimate",
  },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    unit: { control: "text" },
  },
  decorators: [
    (Story) => (
      <div className="w-48">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NumberInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithUnit: Story = {
  args: { unit: "pts", defaultValue: 5 },
};

export const Decimals: Story = {
  args: {
    defaultValue: 1.5,
    step: 0.5,
    min: 0,
    max: 40,
    unit: "h",
    "aria-label": "Time spent",
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <NumberInput {...args} size="sm" />
      <NumberInput {...args} size="md" />
      <NumberInput {...args} size="lg" />
    </div>
  ),
};

export const States: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      <Field label="Empty">
        <NumberInput {...args} defaultValue={null} placeholder="No estimate" />
      </Field>
      <Field label="At maximum" description="The up button is disabled.">
        <NumberInput {...args} defaultValue={21} />
      </Field>
      <Field label="Without stepper">
        <NumberInput {...args} hideStepper unit="pts" />
      </Field>
      <Field label="Disabled">
        <NumberInput {...args} disabled />
      </Field>
      <Field label="Seats" error="Your plan includes up to 25 seats">
        <NumberInput {...args} defaultValue={30} max={undefined} />
      </Field>
    </div>
  ),
};

export const InBillingSettings: Story = {
  render: function Render() {
    const [seats, setSeats] = useState<number | null>(12);
    return (
      <Card className="w-80">
        <CardHeader>
          <CardTitle>Business plan</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Field
            label="Seats"
            description="$12 per seat per month, billed yearly."
          >
            <NumberInput
              value={seats}
              onValueChange={setSeats}
              min={1}
              max={500}
            />
          </Field>
          <p className="text-fg-muted text-sm">
            Total:{" "}
            <span className="font-medium text-fg">
              ${(seats ?? 0) * 12} / month
            </span>
          </p>
        </CardContent>
      </Card>
    );
  },
};
