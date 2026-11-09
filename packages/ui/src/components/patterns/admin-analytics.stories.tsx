import type { Meta, StoryObj } from "@storybook/react-vite";
import { BarChart3 } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";

import { DataState } from "../data-state";
import { EmptyState } from "../empty-state";
import {
  AdminAnalytics,
  type AdminAnalyticsData,
  type AdminAnalyticsReport,
  AdminAnalyticsSkeleton,
} from "./admin-analytics";

const report: AdminAnalyticsReport = {
  status: "ok",
  days: 7,
  generatedAt: "2026-11-09T09:30:00.000Z",
  funnel: [
    { id: "visit", label: "Visits", unit: "visits", count: 1840, share: null },
    {
      id: "interest",
      label: "Got the pitch",
      unit: "visits",
      count: 912,
      share: 912 / 1840,
    },
    {
      id: "intent",
      label: "Clicked a call to action",
      unit: "visits",
      count: 377,
      share: 377 / 912,
    },
    {
      id: "sign_up_started",
      label: "Started sign-up",
      unit: "attempts",
      count: 141,
      share: 141 / 377,
    },
    {
      id: "signed_up",
      label: "Signed up",
      unit: "people",
      count: 96,
      share: 96 / 141,
    },
    {
      id: "first_try",
      label: "Tried a feature",
      unit: "people",
      count: 71,
      share: 71 / 96,
    },
    {
      id: "depth",
      label: "Tried 3+ features",
      unit: "people",
      count: 28,
      share: 28 / 71,
    },
    {
      id: "returned",
      label: "Came back within 7 days",
      unit: "people",
      count: 19,
      share: 19 / 28,
    },
  ],
  signUp: {
    started: 141,
    completed: 96,
    failures: [
      { key: "invalid", count: 22 },
      { key: "exists", count: 9 },
      { key: "bot_check", count: 6 },
      { key: "rate_limited", count: 2 },
    ],
  },
  activation: {
    cohort: 96,
    tried: 71,
    medianMinutesToFirstTry: 4.5,
    firstFeatures: [
      { feature: "notes", label: "Notes", people: 38 },
      { feature: "agents", label: "Agent (MCP) connected", people: 17 },
      { feature: "command_palette", label: "Command palette", people: 9 },
      { feature: "files", label: "Files", people: 7 },
    ],
    depth: [
      { key: "0", count: 25 },
      { key: "1", count: 26 },
      { key: "2", count: 17 },
      { key: "3+", count: 28 },
    ],
    returnedWithinWindow: 19,
  },
  features: [
    { feature: "notes", label: "Notes", people: 58 },
    { feature: "agents", label: "Agent (MCP) connected", people: 31 },
    { feature: "command_palette", label: "Command palette", people: 27 },
    { feature: "files", label: "Files", people: 19 },
    { feature: "invitations", label: "Invitations", people: 11 },
    { feature: "container_run", label: "Container workflow", people: 8 },
  ],
  sources: {
    referrers: [
      { key: "", count: 802 },
      { key: "news.ycombinator.com", count: 511 },
      { key: "github.com", count: 309 },
      { key: "www.google.com", count: 154 },
      { key: "x.com", count: 64 },
    ],
    campaigns: [{ key: "newsletter", count: 120 }],
    webAnalytics: null,
  },
  engagement: {
    pages: [
      { key: "home", count: 1420 },
      { key: "docs", count: 980 },
    ],
    scrollDepth: [
      { key: "25", count: 1100 },
      { key: "50", count: 760 },
      { key: "75", count: 410 },
      { key: "100", count: 220 },
    ],
    videos: [{ video: "agent-adds-note", played: 140, completed: 61 }],
    featureMap: [
      { key: "select", count: 233 },
      { key: "filter", count: 71 },
    ],
    docsSections: [
      { key: "guides", count: 412 },
      { key: "reference", count: 301 },
      { key: "features", count: 155 },
    ],
  },
  ctas: [
    { cta: "demo", placement: "hero", clicks: 201 },
    { cta: "github", placement: "hero", clicks: 96 },
    { cta: "copy_prompt", placement: "start", clicks: 52 },
    { cta: "demo", placement: "header", clicks: 28 },
  ],
  routes: [
    {
      route: "/api/trpc/[...trpc]",
      requests: 18_220,
      errors: 12,
      meanMs: 48,
      slowestMs: 2210,
    },
    {
      route: "/app/[...path]",
      requests: 3_101,
      errors: 0,
      meanMs: 61,
      slowestMs: 640,
    },
    { route: "/mcp", requests: 902, errors: 3, meanMs: 112, slowestMs: 4100 },
  ],
  notes: [
    "Web Analytics visits and referrers need WEB_ANALYTICS_SITE_TAG; the referrers below come from the site's own events.",
  ],
};

/**
 * The admin portal's Analytics page (`/admin/analytics`): the product funnel from a visit
 * to a return, with its breakdowns, read from Workers Analytics Engine. The page wraps it
 * in `DataState` and keeps the period in the URL.
 */
const meta = {
  title: "Patterns/Admin/Analytics",
  component: AdminAnalytics,
  tags: ["autodocs"],
  args: { data: report, days: 7, onDaysChange: fn() },
  render: (args) => (
    <div className="w-[1040px] max-w-full">
      <AdminAnalytics {...args} />
    </div>
  ),
} satisfies Meta<typeof AdminAnalytics>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A week of the public demo. */
export const Content: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const funnel = canvas.getByRole("list", { name: "Funnel" });
    await expect(within(funnel).getByText("Visits")).toBeVisible();
    await expect(within(funnel).getByText("1,840")).toBeVisible();
    await expect(
      within(funnel).getByText("Came back within 7 days")
    ).toBeVisible();
    await expect(canvas.getByText("news.ycombinator.com")).toBeVisible();
    await expect(canvas.getByText("4.5 min")).toBeVisible();
    await expect(
      canvas.getByRole("table", { name: "Errors and latency per route" })
    ).toBeVisible();
  },
};

/** Switching the period asks for the other report. */
export const SwitchPeriod: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("radio", { name: "30 days" }));
    await expect(args.onDaysChange).toHaveBeenCalledWith(30);
  },
};

/** With WEB_ANALYTICS_SITE_TAG: Cloudflare Web Analytics visits and referrers too. */
export const WithWebAnalytics: Story = {
  args: {
    data: {
      ...report,
      notes: [],
      sources: {
        ...report.sources,
        webAnalytics: {
          visits: 2210,
          pageViews: 5120,
          referrers: [
            { key: "news.ycombinator.com", count: 640 },
            { key: "github.com", count: 350 },
          ],
          countries: [{ key: "United States", count: 900 }],
        },
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(
        "Cloudflare Web Analytics: 2,210 visits, 5,120 page views"
      )
    ).toBeVisible();
  },
};

const empty: AdminAnalyticsData = {
  ...report,
  funnel: report.funnel.map((step) => ({ ...step, count: 0, share: null })),
  signUp: { started: 0, completed: 0, failures: [] },
  activation: {
    cohort: 0,
    tried: 0,
    medianMinutesToFirstTry: null,
    firstFeatures: [],
    depth: report.activation.depth.map((row) => ({ ...row, count: 0 })),
    returnedWithinWindow: 0,
  },
  features: [],
  sources: { referrers: [], campaigns: [], webAnalytics: null },
  engagement: {
    pages: [],
    scrollDepth: report.engagement.scrollDepth.map((row) => ({
      ...row,
      count: 0,
    })),
    videos: [],
    featureMap: [],
    docsSections: [],
  },
  ctas: [],
  routes: [],
  notes: [],
};

/** A new deployment: nothing recorded yet. */
export const NothingYet: Story = {
  args: { data: empty, days: 1 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("No visits in this period.")).toBeVisible();
    await expect(canvas.getByText("Nobody tried a feature yet.")).toBeVisible();
  },
};

/** The read token is not set: which settings to set. */
export const NotConfigured: Story = {
  args: {
    data: {
      status: "not_configured",
      missing: ["ANALYTICS_READ_TOKEN", "ANALYTICS_ACCOUNT_ID"],
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Analytics are not connected")
    ).toBeVisible();
  },
};

function Page({ status }: { readonly status: "pending" | "error" }) {
  return (
    <div className="w-[1040px] max-w-full">
      <DataState
        status={status}
        data={undefined as AdminAnalyticsData | undefined}
        error={
          new Error(
            "Cloudflare refused the analytics token: it needs Account Analytics Read on this account"
          )
        }
        onRetry={() => {}}
        loading={<AdminAnalyticsSkeleton />}
        empty={<EmptyState icon={<BarChart3 />} title="Nothing to show yet" />}
      >
        {(value) => (
          <AdminAnalytics data={value} days={7} onDaysChange={() => {}} />
        )}
      </DataState>
    </div>
  );
}

/** Loading. */
export const Loading: Story = { render: () => <Page status="pending" /> };

/** The API failed, with retry. */
export const ErrorStateStory: Story = {
  name: "Error",
  render: () => <Page status="error" />,
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: /try again/i })
    ).toBeVisible();
  },
};
