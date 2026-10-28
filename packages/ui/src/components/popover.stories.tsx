import type { Meta, StoryObj } from "@storybook/react-vite";
import { CalendarClock } from "lucide-react";

import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/** A floating panel anchored to its trigger. Menus and pickers are built on it. */
const meta = {
  title: "Overlays/Popover",
  component: Popover,
  tags: ["autodocs"],
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  render: () => (
    <div className="h-64">
      <Popover defaultOpen>
        <PopoverTrigger asChild>
          <Button icon={<CalendarClock />}>Estimate</Button>
        </PopoverTrigger>
        <PopoverContent aria-label="Estimate">
          <div className="flex flex-col gap-2">
            <Label htmlFor="estimate">Estimate (hours)</Label>
            <Input id="estimate" defaultValue="4" />
            <p className="text-xs text-fg-subtle">Used for cycle capacity.</p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  ),
};
