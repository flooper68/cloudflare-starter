import type { Meta, StoryObj } from "@storybook/react-vite";
import { addDays, startOfToday } from "date-fns";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { DatePicker, type DateRange, DateRangePicker } from "./date-picker";
import { Field } from "./field";

/**
 * A date field like Linear's due-date picker: presets (Today, Tomorrow, Next week, No
 * date) above a calendar; closes on pick. `DateRangePicker` picks a start and end on two
 * months with quick ranges on the side.
 */
const meta = {
  title: "Forms/DatePicker",
  component: DatePicker,
  tags: ["autodocs"],
  args: {
    placeholder: "Set due date",
    size: "md",
    disabled: false,
    weekStartsOn: 1,
    "aria-label": "Due date",
  },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    weekStartsOn: { control: "inline-radio", options: [0, 1] },
  },
  decorators: [
    (Story) => (
      <div className="h-[440px] w-56">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Open: Story = {
  // Keep a preset selected on every weekday so axe checks its active background.
  args: { defaultOpen: true, defaultValue: startOfToday() },
};

export const WithoutPresets: Story = {
  args: { presets: [], defaultOpen: true },
};

/** Only future dates can be picked. */
export const FutureOnly: Story = {
  args: {
    disabledDates: { before: startOfToday() },
    defaultOpen: true,
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <DatePicker {...args} size="sm" defaultValue={startOfToday()} />
      <DatePicker {...args} size="md" defaultValue={startOfToday()} />
      <DatePicker {...args} size="lg" defaultValue={startOfToday()} />
    </div>
  ),
};

export const States: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      <Field label="Empty">
        <DatePicker {...args} />
      </Field>
      <Field label="Disabled">
        <DatePicker
          {...args}
          disabled
          defaultValue={addDays(startOfToday(), 7)}
        />
      </Field>
      <Field label="Due date" error="Due date must be before the cycle ends">
        <DatePicker {...args} defaultValue={addDays(startOfToday(), 40)} />
      </Field>
    </div>
  ),
};

export const DateRangeOpen: Story = {
  render: () => (
    <DateRangePicker
      aria-label="Cycle dates"
      weekStartsOn={1}
      defaultOpen
      defaultValue={{ from: startOfToday(), to: addDays(startOfToday(), 13) }}
    />
  ),
  decorators: [
    (Story) => (
      <div className="h-[400px] w-[680px]">
        <Story />
      </div>
    ),
  ],
};

export const InAProjectForm: Story = {
  render: function Render() {
    const [target, setTarget] = useState<Date | null>(
      addDays(startOfToday(), 30)
    );
    const [cycle, setCycle] = useState<DateRange | null>(null);
    return (
      <Card className="w-80">
        <CardHeader>
          <CardTitle>Mobile app v3</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Field label="Target date">
            <DatePicker
              value={target}
              onValueChange={setTarget}
              weekStartsOn={1}
            />
          </Field>
          <Field label="Beta period" optional>
            <DateRangePicker
              value={cycle}
              onValueChange={setCycle}
              weekStartsOn={1}
            />
          </Field>
        </CardContent>
      </Card>
    );
  },
  decorators: [
    (Story) => (
      <div className="h-[440px] w-[680px]">
        <Story />
      </div>
    ),
  ],
};
