import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { type FlagRuleDraft, FlagRuleEditor } from "./flag-rule-editor";

const ROLLOUT: FlagRuleDraft[] = [
  { kind: "workspace", workspaceId: "ws_linear_design", value: true },
  { kind: "plan", planId: "business", value: true },
  { kind: "percentage", percentageBp: 2500, value: true },
];

/**
 * Edits a feature flag's ordered targeting rules (workspace, plan, percentage); the first
 * match wins. For the admin flag pages: the parent loads the rules and saves them.
 */
const meta = {
  title: "Forms/FlagRuleEditor",
  component: FlagRuleEditor,
  tags: ["autodocs"],
  args: {
    flagKey: "upload-demo-presigned",
    valueType: "boolean",
    status: "ready",
    rules: ROLLOUT,
    saving: false,
    onSave: fn(),
    onRetry: fn(),
  },
  argTypes: {
    valueType: {
      control: "inline-radio",
      options: ["boolean", "string", "number"],
    },
    status: {
      control: "inline-radio",
      options: ["loading", "error", "ready"],
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[720px] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FlagRuleEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Loading: Story = { args: { status: "loading" } };

export const LoadError: Story = {
  args: {
    status: "error",
    error: new Error("Feature flags are not stored in this deployment"),
  },
};

export const Empty: Story = { args: { rules: [] } };

export const StringValues: Story = {
  args: {
    flagKey: "file-list-layout",
    valueType: "string",
    rules: [
      { kind: "workspace", workspaceId: "ws_linear_design", value: "cards" },
      { kind: "percentage", percentageBp: 1000, value: "cards" },
    ],
  },
};

export const NumberValues: Story = {
  args: {
    flagKey: "upload-max-parallel",
    valueType: "number",
    rules: [{ kind: "plan", planId: "enterprise", value: 8 }],
  },
};

export const Saving: Story = { args: { saving: true } };

export const SaveFailed: Story = {
  args: {
    saveError: new Error("Flag upload-demo-presigned takes boolean values"),
  },
};

/** Adding a rule (10 % by default), changing its share and saving sends the full list. */
export const AddAndSave: Story = {
  args: { rules: [] },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const save = canvas.getByRole("button", { name: "Save rules" });
    await expect(save).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "Add rule" }));
    const share = canvas.getByRole("spinbutton", {
      name: "Rule 1 percentage",
    });
    await userEvent.clear(share);
    await userEvent.type(share, "50{Enter}");
    await userEvent.click(save);
    await expect(args.onSave).toHaveBeenCalledWith([
      { kind: "percentage", percentageBp: 5000, value: true },
    ]);
  },
};

/** Moving and removing rules changes the order Save sends; Discard restores the saved list. */
export const ReorderAndRemove: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Move rule 3 up" })
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove rule 1" })
    );
    await userEvent.click(canvas.getByRole("button", { name: "Save rules" }));
    await expect(args.onSave).toHaveBeenCalledWith([
      { kind: "percentage", percentageBp: 2500, value: true },
      { kind: "plan", planId: "business", value: true },
    ]);
    await userEvent.click(
      canvas.getByRole("button", { name: "Discard changes" })
    );
    await expect(canvas.getAllByRole("listitem")).toHaveLength(3);
    await expect(
      canvas.getByRole("button", { name: "Save rules" })
    ).toBeDisabled();
  },
};

/** A workspace rule without an id shows why and blocks Save. */
export const ValidationBlocksSave: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.clear(
      canvas.getByRole("textbox", { name: "Rule 1 workspace id" })
    );
    await expect(
      await canvas.findByText("Enter the workspace id")
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "Save rules" })
    ).toBeDisabled();
  },
};

/** Toggling a rule's value marks the list changed. */
export const ToggleValue: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("switch", { name: "Rule 2 value" }));
    await userEvent.click(canvas.getByRole("button", { name: "Save rules" }));
    await waitFor(() =>
      expect(args.onSave).toHaveBeenCalledWith([
        ROLLOUT[0],
        { kind: "plan", planId: "business", value: false },
        ROLLOUT[2],
      ])
    );
  },
};

/** In context: the rules section of a flag's admin page, saving with a delay. */
export const InFlagSettings: Story = {
  render: function Render(args) {
    const [rules, setRules] = useState<FlagRuleDraft[]>(ROLLOUT);
    const [saving, setSaving] = useState(false);
    return (
      <Card>
        <CardHeader>
          <CardTitle>upload-demo-presigned</CardTitle>
        </CardHeader>
        <CardContent>
          <FlagRuleEditor
            {...args}
            rules={rules}
            saving={saving}
            onSave={(next) => {
              setSaving(true);
              setTimeout(() => {
                setRules(next);
                setSaving(false);
              }, 600);
            }}
          />
        </CardContent>
      </Card>
    );
  },
};
