import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import { Card, CardDescription, CardTitle } from "./card";

const meta = {
  title: "UI/Card",
  component: Card,
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-[360px] space-y-4">
      <div className="space-y-2">
        <CardTitle>Starter card</CardTitle>
        <CardDescription>
          Use this to prototype a compact app panel with a title, supporting
          text, and an action.
        </CardDescription>
      </div>
      <Button>Open demo</Button>
    </Card>
  ),
};

export const TwoColumn: Story = {
  render: () => (
    <div className="grid w-[760px] gap-4 md:grid-cols-2">
      <Card className="space-y-3">
        <CardTitle>Upload Demo</CardTitle>
        <CardDescription>
          Presigned R2 uploads with file ownership checks.
        </CardDescription>
      </Card>
      <Card className="space-y-3">
        <CardTitle>Queue Demo</CardTitle>
        <CardDescription>
          Send a typed hello-world payload into Cloudflare Queues.
        </CardDescription>
      </Card>
    </div>
  ),
};
