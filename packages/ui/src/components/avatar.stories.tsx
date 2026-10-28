import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar, AvatarGroup } from "./avatar";
import { Card, CardDescription, CardHeader, CardTitle } from "./card";
import { Tooltip } from "./tooltip";

const people = [
  "Ada Lovelace",
  "Grace Hopper",
  "Alan Turing",
  "Katherine Johnson",
  "Linus Torvalds",
  "Margaret Hamilton",
  "Dennis Ritchie",
  "Barbara Liskov",
];

/** Inline SVG portrait so the story works offline. */
const photo = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5e6ad2"/><stop offset="1" stop-color="#26b5ce"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/><circle cx="32" cy="26" r="11" fill="#fff" fill-opacity=".85"/><rect x="14" y="42" width="36" height="24" rx="12" fill="#fff" fill-opacity=".85"/></svg>'
)}`;

/**
 * Avatars stand for people and teams. Without an image (or while it loads) they show
 * initials on a colour derived from the name, so the same person always looks the same.
 */
const meta = {
  title: "Data display/Avatar",
  component: Avatar,
  tags: ["autodocs"],
  args: { name: "Ada Lovelace", size: "lg" },
  argTypes: {
    size: { control: "inline-radio", options: ["xs", "sm", "md", "lg"] },
    status: {
      control: "select",
      options: [undefined, "online", "away", "busy", "offline"],
    },
    shape: { control: "inline-radio", options: ["circle", "square"] },
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar name="Grace Hopper" size="xs" />
      <Avatar name="Grace Hopper" size="sm" />
      <Avatar name="Grace Hopper" size="md" />
      <Avatar name="Grace Hopper" size="lg" />
    </div>
  ),
};

export const InitialsFallback: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {people.map((name) => (
        <Avatar key={name} name={name} size="lg" />
      ))}
    </div>
  ),
};

export const WithImage: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar name="Alan Turing" src={photo} size="lg" />
      <Avatar
        name="Broken Image"
        src="https://invalid.example/missing.png"
        size="lg"
      />
      <Avatar name="Platform team" shape="square" size="lg" />
    </div>
  ),
};

export const Status: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar name="Ada Lovelace" status="online" size="lg" />
      <Avatar name="Grace Hopper" status="away" size="lg" />
      <Avatar name="Alan Turing" status="busy" size="lg" />
      <Avatar name="Katherine Johnson" status="offline" size="lg" />
      <Avatar name="Linus Torvalds" status="online" size="md" />
      <Avatar name="Linus Torvalds" status="online" size="sm" />
    </div>
  ),
};

export const Group: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <AvatarGroup size="sm" max={3}>
        {people.slice(0, 3).map((name) => (
          <Avatar key={name} name={name} />
        ))}
      </AvatarGroup>
      <AvatarGroup size="md" max={4}>
        {people.map((name) => (
          <Avatar key={name} name={name} />
        ))}
      </AvatarGroup>
      <AvatarGroup size="lg" max={5}>
        {people.map((name) => (
          <Avatar key={name} name={name} />
        ))}
      </AvatarGroup>
    </div>
  ),
};

export const InContext: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Billing v2</CardTitle>
        <CardDescription>Lead and members</CardDescription>
      </CardHeader>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Avatar name="Margaret Hamilton" status="online" />
          <span className="text-fg">Margaret Hamilton</span>
        </div>
        <AvatarGroup size="sm" max={3}>
          {people.slice(1, 7).map((name) => (
            <Tooltip key={name} content={name}>
              <button
                type="button"
                className="inline-flex rounded-full focus-visible:ring-2 focus-visible:ring-focus outline-none"
              >
                <Avatar name={name} />
              </button>
            </Tooltip>
          ))}
        </AvatarGroup>
      </div>
    </Card>
  ),
};
