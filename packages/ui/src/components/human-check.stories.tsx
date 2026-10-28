import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import {
  FAIL_SITE_KEY,
  FAKE_TURNSTILE_TOKEN,
  loadFakeTurnstile,
  PASS_SITE_KEY,
} from "../stories/turnstile-fake";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { HumanCheck } from "./human-check";
import { Input } from "./input";
import { Label } from "./label";

/**
 * Cloudflare Turnstile on the sign-up, sign-in and forgot-password forms. The stories use
 * a fake Turnstile (no network): press "Verify you are human" to get the dummy token; the
 * "Rejected" story uses a failing site key. In the app the real script loads from
 * Cloudflare, and the server checks the token with Siteverify.
 */
const meta = {
  title: "Forms/HumanCheck",
  component: HumanCheck,
  tags: ["autodocs"],
  args: {
    siteKey: PASS_SITE_KEY,
    action: "sign-up",
    onTokenChange: fn(),
    loadTurnstile: loadFakeTurnstile,
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HumanCheck>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Interaction test: solving the check reports the token and announces success. */
export const Verifies: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: "Verify you are human" })
    );
    await expect(args.onTokenChange).toHaveBeenLastCalledWith(
      FAKE_TURNSTILE_TOKEN
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Verified as human"
    );
  },
};

/** Interaction test: a failed check shows why and "Try again" brings the widget back. */
export const Rejected: Story = {
  args: { siteKey: FAIL_SITE_KEY },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: "Verify you are human" })
    );
    await expect(
      await canvas.findByText("The human check did not pass.")
    ).toBeVisible();
    await expect(args.onTokenChange).toHaveBeenLastCalledWith(null);
    await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
    await expect(
      await canvas.findByRole("button", { name: "Verify you are human" })
    ).toBeVisible();
  },
};

/** While Cloudflare's script loads. */
export const Loading: Story = {
  args: { loadTurnstile: () => new Promise(() => {}) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("group")).toHaveAttribute(
      "aria-busy",
      "true"
    );
    await expect(
      canvas.getByText("Loading the human check…")
    ).toBeInTheDocument();
  },
};

/** Interaction test: the script does not load (blocked, offline); retry loads it again. */
export const ScriptUnavailable: Story = {
  args: {
    scriptUrl: "/turnstile-that-does-not-exist.js",
    loadTurnstile: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(
        "The human check could not load. Check your connection."
      )
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Try again" })
    ).toBeEnabled();
  },
};

/** In a form: the submit button waits for the token. */
export const InSignUpForm: Story = {
  render: function Render(args) {
    const [token, setToken] = useState<string | null>(null);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="story-email">Email</Label>
            <Input
              id="story-email"
              type="email"
              defaultValue="ada@example.com"
            />
          </div>
          <HumanCheck {...args} onTokenChange={setToken} />
          <Button className="w-full" variant="primary" disabled={!token}>
            Create account
          </Button>
        </CardContent>
      </Card>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const submit = canvas.getByRole("button", { name: "Create account" });
    await expect(submit).toBeDisabled();
    await userEvent.click(
      await canvas.findByRole("button", { name: "Verify you are human" })
    );
    await waitFor(() => expect(submit).toBeEnabled());
  },
};
