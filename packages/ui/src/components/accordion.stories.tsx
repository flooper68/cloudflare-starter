import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bell, KeyRound, Webhook } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./accordion";
import { Badge } from "./badge";

interface AccordionStoryArgs {
  /** One open section at a time, or several. */
  type: "single" | "multiple";
  /** Single mode: allow closing the open section. */
  collapsible: boolean;
}

/**
 * Collapsible sections with a subtle rotating chevron. `type="single"` keeps one section
 * open (add `collapsible` to allow closing it), `type="multiple"` lets several stay open.
 */
const meta = {
  title: "Data display/Accordion",
  component: Accordion,
  tags: ["autodocs"],
  args: { type: "single", collapsible: true },
  argTypes: {
    type: { control: "inline-radio", options: ["single", "multiple"] },
  },
  decorators: [
    (Story) => (
      <div className="w-[480px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<AccordionStoryArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

const faq = [
  {
    value: "cycles",
    title: "How do cycles work?",
    body: "Cycles are time-boxed iterations, usually one or two weeks. Unfinished issues roll over to the next cycle automatically.",
  },
  {
    value: "triage",
    title: "Who sees the triage inbox?",
    body: "Everyone on the team. Issues created by integrations or people outside the team land there first.",
  },
  {
    value: "estimates",
    title: "Can we use t-shirt sizes for estimates?",
    body: "Yes. Choose between exponential, fibonacci, linear and t-shirt scales in the team settings.",
  },
];

export const Playground: Story = {
  render: ({ type, collapsible }) => {
    const items = faq.map((item) => (
      <AccordionItem key={item.value} value={item.value}>
        <AccordionTrigger>{item.title}</AccordionTrigger>
        <AccordionContent>{item.body}</AccordionContent>
      </AccordionItem>
    ));
    return type === "single" ? (
      <Accordion type="single" collapsible={collapsible} defaultValue="cycles">
        {items}
      </Accordion>
    ) : (
      <Accordion type="multiple" defaultValue={["cycles"]}>
        {items}
      </Accordion>
    );
  },
};

export const Multiple: Story = {
  render: () => (
    <Accordion type="multiple" defaultValue={["cycles", "estimates"]}>
      {faq.map((item) => (
        <AccordionItem key={item.value} value={item.value}>
          <AccordionTrigger>{item.title}</AccordionTrigger>
          <AccordionContent>{item.body}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Accordion type="single" collapsible>
      <AccordionItem value="a">
        <AccordionTrigger>Available section</AccordionTrigger>
        <AccordionContent>Content.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="b" disabled>
        <AccordionTrigger trailing="Business plan">
          Audit log streaming
        </AccordionTrigger>
        <AccordionContent>Content.</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const SettingsSections: Story = {
  render: () => (
    <div className="rounded-lg border border-line bg-surface-raised px-4">
      <Accordion type="multiple" defaultValue={["notifications"]}>
        <AccordionItem value="notifications">
          <AccordionTrigger icon={<Bell />} trailing="3 enabled">
            Notifications
          </AccordionTrigger>
          <AccordionContent>
            Email for assignments and mentions, desktop push for comments on
            issues you are subscribed to, and a weekly digest on Monday.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="api">
          <AccordionTrigger
            icon={<KeyRound />}
            trailing={<Badge size="sm">2 keys</Badge>}
          >
            API keys
          </AccordionTrigger>
          <AccordionContent>
            Personal API keys act as you. Revoke keys you no longer use.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="webhooks">
          <AccordionTrigger icon={<Webhook />} trailing="None">
            Webhooks
          </AccordionTrigger>
          <AccordionContent>
            Send issue and comment events to your own endpoint.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};
