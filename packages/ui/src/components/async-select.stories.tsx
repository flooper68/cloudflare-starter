import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
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

/** The popover moves focus to its search field once it has opened. */
const searchFocused = (canvasElement: HTMLElement) =>
  waitFor(() =>
    expect(canvasElement.ownerDocument.activeElement).toHaveAttribute(
      "cmdk-input"
    )
  );

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

/** Results arrive after the debounce and the fake latency (300–700ms). */
const loaded = { timeout: 3000 };

/** Interaction test: search, wait for results, pick one. */
export const SearchAndPick: Story = {
  args: { onValueChange: fn() },
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("combobox", { name: /Assignee/ });

    await step(
      "Typing searches; results replace the loading state",
      async () => {
        await userEvent.click(trigger);
        await searchFocused(canvasElement);
        await userEvent.keyboard("hop");
        await expect(
          await page.findByRole("option", { name: /Grace Hopper/ }, loaded)
        ).toBeVisible();
      }
    );

    await step("Clicking an option selects it and closes", async () => {
      await userEvent.click(page.getByRole("option", { name: /Grace Hopper/ }));
      await expect(args.onValueChange).toHaveBeenCalledWith(
        expect.objectContaining({ value: "grace-hopper" })
      );
      await waitFor(() => expect(page.queryByRole("listbox")).toBeNull());
      await expect(trigger).toHaveTextContent("Grace Hopper");
    });
  },
};

/** Nothing loads until two characters are typed. */
export const MinimumQueryLength: Story = {
  args: { minQueryLength: 2, defaultOpen: true },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(
      await page.findByText("Type at least 2 characters to search")
    ).toBeInTheDocument();
    await searchFocused(canvasElement);
    await userEvent.keyboard("a");
    await waitFor(() =>
      expect(
        page.getByText("Type at least 2 characters to search")
      ).toBeVisible()
    );
    await userEvent.keyboard("d");
    await expect(
      await page.findByRole("option", { name: /Ada Lovelace/ }, loaded)
    ).toBeVisible();
  },
};

/** The loader rejects: the list shows the error and a retry button. */
export const ErrorState: Story = {
  args: { loader: failingSearch, defaultOpen: true },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByRole("alert", {}, loaded)).toHaveTextContent(
      "Couldn't load results"
    );
    await userEvent.click(page.getByRole("button", { name: "Try again" }));
    // Retrying loads again (the error gives way to "Searching…"), then fails again.
    await expect(await page.findByText("Searching…")).toBeInTheDocument();
    await expect(page.queryByRole("alert")).toBeNull();
    await expect(await page.findByRole("alert", {}, loaded)).toHaveTextContent(
      "Couldn't load results"
    );
  },
};

/** Type a name that is not in the directory (e.g. "zzz") to see the empty state. */
export const EmptyState: Story = {
  args: {
    defaultOpen: true,
    emptyText: "No one in Acme matches that name",
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await searchFocused(canvasElement);
    await userEvent.keyboard("zzz");
    await expect(
      await page.findByText("No one in Acme matches that name", {}, loaded)
    ).toBeVisible();
    await expect(page.queryByRole("option")).toBeNull();
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
