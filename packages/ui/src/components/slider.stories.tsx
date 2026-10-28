import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Field } from "./field";
import { Slider } from "./slider";

/**
 * Pick a number or a range by dragging or with arrow keys. Pass two values for a range;
 * `showValue` prints the value next to the track.
 */
const meta = {
  title: "Forms/Slider",
  component: Slider,
  tags: ["autodocs"],
  args: {
    defaultValue: [40],
    min: 0,
    max: 100,
    step: 1,
    showValue: true,
    disabled: false,
    thumbLabels: ["Opacity"],
    formatValue: (value: number) => `${value}%`,
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithoutValue: Story = {
  args: { showValue: false },
};

export const Range: Story = {
  args: {
    defaultValue: [2, 8],
    min: 1,
    max: 13,
    thumbLabels: ["Minimum estimate", "Maximum estimate"],
    formatValue: (value: number) => `${value} pts`,
  },
};

export const Steps: Story = {
  args: {
    defaultValue: [2],
    min: 1,
    max: 8,
    step: 1,
    thumbLabels: ["Cycle length"],
    formatValue: (value: number) =>
      `${value} ${value === 1 ? "week" : "weeks"}`,
  },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const InSettings: Story = {
  render: function Render() {
    const [capacity, setCapacity] = useState([80]);
    const [range, setRange] = useState([3, 21]);
    return (
      <Card className="w-96">
        <CardHeader>
          <CardTitle>Cycle planning</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Field
            label="Team capacity"
            description="Share of the cycle reserved for planned work."
          >
            <Slider
              value={capacity}
              onValueChange={setCapacity}
              step={5}
              showValue
              formatValue={(value) => `${value}%`}
              thumbLabels={["Team capacity"]}
            />
          </Field>
          <Field label="Auto-archive window">
            <Slider
              value={range}
              onValueChange={setRange}
              min={1}
              max={30}
              showValue
              formatValue={(value) => `${value}d`}
              thumbLabels={["From day", "To day"]}
            />
          </Field>
        </CardContent>
      </Card>
    );
  },
};
