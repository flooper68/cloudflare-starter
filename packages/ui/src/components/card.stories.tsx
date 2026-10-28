import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowUpRight } from "lucide-react";

import { Button } from "./button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

/** A bordered panel for grouping related content. `interactive` adds hover feedback. */
const meta = {
  title: "Data display/Card",
  component: Card,
  tags: ["autodocs"],
  args: { interactive: false },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <Card {...args} className="w-80">
      <CardHeader>
        <CardTitle>Q4 roadmap</CardTitle>
        <CardDescription>12 issues · due Dec 20</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-fg-muted">
        Ship the billing migration and the new onboarding before the holiday
        freeze.
      </CardContent>
    </Card>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Invite your team</CardTitle>
        <CardDescription>
          Members can create issues, comment and connect their agents.
        </CardDescription>
      </CardHeader>
      <CardFooter className="justify-end">
        <Button variant="ghost">Later</Button>
        <Button variant="primary">Send invites</Button>
      </CardFooter>
    </Card>
  ),
};

export const Interactive: Story = {
  render: () => (
    <div className="grid w-[640px] grid-cols-2 gap-3">
      {[
        ["Mobile app", "38 issues · 64% done"],
        ["Billing v2", "21 issues · 12% done"],
        ["Agent API", "9 issues · in review"],
        ["Docs refresh", "5 issues · planned"],
      ].map(([title, meta]) => (
        <Card key={title} interactive>
          <div className="flex items-start justify-between">
            <CardTitle className="text-sm">{title}</CardTitle>
            <ArrowUpRight className="size-4 text-fg-subtle" />
          </div>
          <CardDescription className="mt-1 text-xs">{meta}</CardDescription>
        </Card>
      ))}
    </div>
  ),
};
