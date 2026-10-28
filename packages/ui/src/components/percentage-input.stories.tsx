import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Field } from "./field";
import { PercentageInput } from "./percentage-input";

/**
 * A rollout share in percent (one decimal), stored as basis points (0–10000). Arrow keys
 * step by 0.1 %, Shift by 1 %; typed values are clamped to 0–100 % on Enter or blur.
 */
const meta = {
  title: "Forms/PercentageInput",
  component: PercentageInput,
  tags: ["autodocs"],
  args: {
    defaultValue: 2500,
    disabled: false,
    hideBar: false,
    size: "md",
    "aria-label": "Rollout",
  },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
  },
  decorators: [
    (Story) => (
      <div className="w-56">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PercentageInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const States: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      <Field label="Empty">
        <PercentageInput {...args} defaultValue={null} />
      </Field>
      <Field label="Everyone">
        <PercentageInput {...args} defaultValue={10_000} />
      </Field>
      <Field label="Canary">
        <PercentageInput {...args} defaultValue={50} />
      </Field>
      <Field label="Disabled">
        <PercentageInput {...args} disabled />
      </Field>
      <Field label="Without bar">
        <PercentageInput {...args} hideBar />
      </Field>
      <Field label="Rollout" error="Finish the 10 % stage before going wider">
        <PercentageInput {...args} defaultValue={5000} />
      </Field>
    </div>
  ),
};

/** Typed percentages become basis points; values above 100 % are clamped. */
export const TypeAndClamp: Story = {
  args: { defaultValue: null, onValueChange: fn() },
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByRole("spinbutton", {
      name: "Rollout",
    });
    await userEvent.type(input, "12.5{Enter}");
    await expect(args.onValueChange).toHaveBeenLastCalledWith(1250);
    await userEvent.clear(input);
    await userEvent.type(input, "140{Enter}");
    await expect(args.onValueChange).toHaveBeenLastCalledWith(10_000);
    await expect(input).toHaveValue("100");
  },
};

/** ArrowUp steps by 0.1 %, Shift+ArrowUp by 1 %. */
export const KeyboardStepping: Story = {
  args: { defaultValue: 1000, onValueChange: fn() },
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByRole("spinbutton", {
      name: "Rollout",
    });
    await userEvent.click(input);
    await userEvent.keyboard("{ArrowUp}");
    await expect(args.onValueChange).toHaveBeenLastCalledWith(1010);
    await userEvent.keyboard("{Shift>}{ArrowUp}{/Shift}");
    await expect(args.onValueChange).toHaveBeenLastCalledWith(1110);
  },
};

export const InRolloutSettings: Story = {
  render: function Render(args) {
    const [share, setShare] = useState<number | null>(1000);
    return (
      <Card className="w-80">
        <CardHeader>
          <CardTitle>New editor rollout</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Field
            label="Workspaces"
            description="Each workspace keeps its group as the share grows."
          >
            <PercentageInput
              {...args}
              aria-label={undefined}
              value={share}
              onValueChange={setShare}
            />
          </Field>
          <p className="text-fg-muted text-sm">
            About{" "}
            <span className="font-medium text-fg">
              {Math.round(((share ?? 0) / 10_000) * 1840)}
            </span>{" "}
            of 1 840 workspaces.
          </p>
        </CardContent>
      </Card>
    );
  },
};
