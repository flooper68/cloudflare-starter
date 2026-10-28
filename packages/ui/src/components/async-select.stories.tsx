import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { AsyncSelect, type OptionLoader } from "./async-select";
import { Avatar } from "./avatar";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import type { ComboboxOption } from "./combobox";
import { Field } from "./field";

const directory = [
  "Ada Lovelace",
  "Alan Turing",
  "Barbara Liskov",
  "Dennis Ritchie",
  "Donald Knuth",
  "Edsger Dijkstra",
  "Frances Allen",
  "Grace Hopper",
  "Guido van Rossum",
  "John McCarthy",
  "Katherine Johnson",
  "Ken Thompson",
  "Leslie Lamport",
  "Linus Torvalds",
  "Margaret Hamilton",
  "Radia Perlman",
  "Tim Berners-Lee",
  "Yukihiro Matsumoto",
];

function toOption(name: string): ComboboxOption {
  return {
    value: name.toLowerCase().replace(/\s/g, "-"),
    label: name,
    icon: <Avatar name={name} size="xs" />,
    description: `${name.split(" ")[0]?.toLowerCase()}@acme.dev`,
  };
}

/** Resolves after `ms` unless the signal aborts first (then rejects, like fetch). */
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

/** Fake people search: 300–700ms latency, cancellable, max 8 results. */
const searchPeople: OptionLoader = async (query, signal) => {
  await wait(300 + Math.random() * 400, signal);
  const needle = query.toLowerCase();
  return directory
    .filter((name) => name.toLowerCase().includes(needle))
    .slice(0, 8)
    .map(toOption);
};

const failingSearch: OptionLoader = async (_query, signal) => {
  await wait(500, signal);
  throw new Error("503 Service Unavailable");
};

/**
 * A Combobox whose options come from `loader(query, signal)`: debounced (200ms), stale
 * requests are aborted, and the list shows loading, empty and error (with retry) states.
 * `minQueryLength` waits for a few characters before searching.
 */
const meta = {
  title: "Forms/AsyncSelect",
  component: AsyncSelect,
  tags: ["autodocs"],
  args: {
    loader: searchPeople,
    placeholder: "Assign to…",
    searchPlaceholder: "Search people…",
    minQueryLength: 0,
    debounceMs: 200,
    size: "md",
    disabled: false,
    deselectable: true,
    "aria-label": "Assignee",
  },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    loader: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="h-96 w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AsyncSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Open: Story = {
  args: { defaultOpen: true },
};

export const WithValue: Story = {
  args: { defaultValue: toOption("Grace Hopper") },
};

/** Nothing loads until two characters are typed. */
export const MinimumQueryLength: Story = {
  args: { minQueryLength: 2, defaultOpen: true },
};

/** The loader rejects: the list shows the error and a retry button. */
export const ErrorState: Story = {
  args: { loader: failingSearch, defaultOpen: true },
};

/** Type a name that is not in the directory (e.g. "zzz") to see the empty state. */
export const EmptyState: Story = {
  args: {
    defaultOpen: true,
    emptyText: "No one in Acme matches that name",
  },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: toOption("Linus Torvalds") },
};

export const InAForm: Story = {
  render: function Render() {
    const [lead, setLead] = useState<ComboboxOption | null>(null);
    const [submitted, setSubmitted] = useState(false);
    return (
      <Card className="w-80">
        <CardHeader>
          <CardTitle>Project lead</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmitted(true);
            }}
          >
            <Field
              label="Lead"
              description="Searches the whole workspace directory."
              error={submitted && !lead ? "Every project needs a lead" : null}
            >
              <AsyncSelect
                loader={searchPeople}
                value={lead}
                onValueChange={setLead}
                placeholder="Choose a lead"
                searchPlaceholder="Search people…"
              />
            </Field>
            <button type="submit" className="sr-only">
              Save
            </button>
          </form>
        </CardContent>
      </Card>
    );
  },
};
