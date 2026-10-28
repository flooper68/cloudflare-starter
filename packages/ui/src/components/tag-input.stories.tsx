import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "./button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
import { Field } from "./field";
import { TagInput } from "./tag-input";

/**
 * Free-text tags. Enter or comma adds, Backspace in the empty field removes the last tag,
 * pasting a comma-separated list adds them all. Duplicates are rejected; `validate` adds
 * your own rules and `onValidationError` reports the message for `<Field error>`.
 */
const meta = {
  title: "Forms/TagInput",
  component: TagInput,
  tags: ["autodocs"],
  args: {
    defaultValue: ["frontend", "q4-launch"],
    placeholder: "Add a tag…",
    size: "md",
    disabled: false,
    addOnBlur: true,
    "aria-label": "Tags",
  },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    maxTags: { control: "number" },
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TagInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Empty: Story = {
  args: { defaultValue: [] },
};

export const Wrapping: Story = {
  args: {
    defaultValue: [
      "design-system",
      "accessibility",
      "performance",
      "onboarding",
      "billing",
      "mobile",
      "api",
    ],
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <TagInput {...args} size="sm" />
      <TagInput {...args} size="md" />
      <TagInput {...args} size="lg" />
    </div>
  ),
};

export const States: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      <Field label="Disabled">
        <TagInput {...args} disabled />
      </Field>
      <Field label="Limit of 3" description="Stops accepting tags at three.">
        <TagInput
          {...args}
          maxTags={3}
          defaultValue={["ios", "android", "web"]}
        />
      </Field>
    </div>
  ),
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validation hook: only emails at acme.dev, with the message shown by Field. */
export const WithValidation: Story = {
  render: function Render() {
    const [emails, setEmails] = useState<readonly string[]>(["grace@acme.dev"]);
    const [error, setError] = useState<string | null>(null);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invite to Acme</CardTitle>
          <CardDescription>
            Paste a list or press Enter after each address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field
            label="Email addresses"
            error={error}
            description="Only acme.dev addresses."
          >
            <TagInput
              value={emails}
              onValueChange={setEmails}
              placeholder="name@acme.dev"
              validate={(tag) => {
                if (!emailPattern.test(tag))
                  return `"${tag}" is not an email address`;
                if (!tag.endsWith("@acme.dev"))
                  return "Invite outside guests from Settings";
                return null;
              }}
              onValidationError={setError}
            />
          </Field>
        </CardContent>
        <CardFooter className="justify-end">
          <Button variant="primary" size="sm" disabled={emails.length === 0}>
            Send {emails.length} {emails.length === 1 ? "invite" : "invites"}
          </Button>
        </CardFooter>
      </Card>
    );
  },
};
