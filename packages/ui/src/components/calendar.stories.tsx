import type { Meta, StoryObj } from "@storybook/react-vite";
import { addDays, startOfToday } from "date-fns";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "./calendar";

/**
 * A compact month grid (react-day-picker 10): accent fill on the selection, a ring on
 * today, arrow keys to move, Page Up/Down for months. Takes every DayPicker prop. In a field,
 * use DatePicker or DateRangePicker.
 */
const meta: Meta<typeof Calendar> = {
  title: "Forms/Calendar",
  component: Calendar,
  tags: ["autodocs"],
  args: {
    showOutsideDays: true,
    numberOfMonths: 1,
    weekStartsOn: 1,
  },
  argTypes: {
    weekStartsOn: { control: "inline-radio", options: [0, 1] },
    numberOfMonths: { control: { type: "number", min: 1, max: 3 } },
  },
  decorators: [
    (Story) => (
      <div className="rounded-lg border border-line bg-overlay shadow-overlay">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Calendar>;

export const Playground: Story = {};

export const Single: Story = {
  render: function Render(args) {
    const [selected, setSelected] = useState<Date | undefined>(
      addDays(startOfToday(), 3)
    );
    return (
      <Calendar
        weekStartsOn={args.weekStartsOn}
        mode="single"
        selected={selected}
        onSelect={setSelected}
      />
    );
  },
};

export const Range: Story = {
  render: function Render(args) {
    const [range, setRange] = useState<DateRange | undefined>({
      from: startOfToday(),
      to: addDays(startOfToday(), 9),
    });
    return (
      <Calendar
        weekStartsOn={args.weekStartsOn}
        mode="range"
        numberOfMonths={2}
        selected={range}
        onSelect={setRange}
      />
    );
  },
};

export const Multiple: Story = {
  render: function Render(args) {
    const [days, setDays] = useState<Date[] | undefined>([
      addDays(startOfToday(), 1),
      addDays(startOfToday(), 4),
      addDays(startOfToday(), 8),
    ]);
    return (
      <Calendar
        weekStartsOn={args.weekStartsOn}
        mode="multiple"
        selected={days}
        onSelect={setDays}
      />
    );
  },
};

/** Past days and weekends are disabled. */
export const DisabledDays: Story = {
  args: {
    disabled: [{ before: startOfToday() }, { dayOfWeek: [0, 6] }],
  },
};

export const WithFooter: Story = {
  args: {
    footer: "Cycle 42 ends on Friday.",
  },
};
