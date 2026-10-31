import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { DataExportList } from "./data-export-list";

const ready = {
  id: "export-1",
  scope: "user",
  status: "ready",
  createdAt: "2026-10-31T12:00:00Z",
  expiresAt: "2026-11-01T12:00:00Z",
  sizeBytes: 1048576,
  failure: null,
};
const meta = {
  title: "Patterns/DataExportList",
  component: DataExportList,
  tags: ["autodocs"],
  args: { items: [ready], onDownload: fn() },
} satisfies Meta<typeof DataExportList>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playground: Story = {};
export const Empty: Story = { args: { items: [] } };
export const Queued: Story = {
  args: { items: [{ ...ready, status: "queued", expiresAt: null }] },
};
export const Building: Story = {
  args: { items: [{ ...ready, status: "building", expiresAt: null }] },
};
export const Expired: Story = {
  args: { items: [{ ...ready, status: "expired" }] },
};
export const Failed: Story = {
  args: {
    items: [
      {
        ...ready,
        status: "failed",
        failure: "Internal secret must never be displayed",
      },
    ],
  },
};
export const Downloading: Story = { args: { downloadingId: "export-1" } };
export const Download: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "Download" }));
    await expect(args.onDownload).toHaveBeenCalledWith("export-1");
  },
};
