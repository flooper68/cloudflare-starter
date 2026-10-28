import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { Toaster, toast } from "./toast";

/**
 * Short, transient feedback after an action. Mount `<Toaster />` once at the app root and
 * call `toast()` from anywhere: `toast.success`, `toast.error`, `toast.info`,
 * `toast.warning`, `toast.loading`, `toast.promise`. Add `description` for a second line
 * and `action: { label: "Undo", onClick }` for one follow-up action.
 */
const meta = {
  title: "Feedback/Toast",
  component: Toaster,
  tags: ["autodocs"],
  args: { position: "bottom-right", closeButton: false, expand: false },
  argTypes: {
    position: {
      control: "select",
      options: [
        "top-left",
        "top-center",
        "top-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ],
    },
  },
  decorators: [
    (Story, context) => (
      <>
        <Story />
        <Toaster {...context.args} />
      </>
    ),
  ],
  parameters: { docs: { story: { inline: false, iframeHeight: 360 } } },
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <Button onClick={() => toast("Issue ENG-142 created")}>Show toast</Button>
  ),
};

export const Types: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => toast("Moved 3 issues to Cycle 43")}>
        Default
      </Button>
      <Button onClick={() => toast.success("Project “Mobile app v2” created")}>
        Success
      </Button>
      <Button
        onClick={() =>
          toast.error("Couldn’t sync with GitHub", {
            description:
              "The token for acme/web expired. Reconnect in Settings.",
          })
        }
      >
        Error
      </Button>
      <Button onClick={() => toast.info("Tereza assigned ENG-142 to you")}>
        Info
      </Button>
      <Button
        onClick={() =>
          toast.warning("Cycle 42 ends tomorrow", {
            description: "7 issues are not done yet.",
          })
        }
      >
        Warning
      </Button>
      <Button onClick={() => toast.loading("Importing 240 issues from Jira…")}>
        Loading
      </Button>
      <Button variant="ghost" onClick={() => toast.dismiss()}>
        Dismiss all
      </Button>
    </div>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Button
      onClick={() =>
        toast("Issue deleted", {
          description: "ENG-131 Dark mode: chart tooltips are unreadable",
          action: {
            label: "Undo",
            onClick: () => toast.success("Issue restored"),
          },
        })
      }
    >
      Delete issue
    </Button>
  ),
};

export const PromiseToast: Story = {
  name: "Promise",
  render: () => (
    <div className="flex gap-2">
      <Button
        onClick={() =>
          toast.promise(new Promise((resolve) => setTimeout(resolve, 1500)), {
            loading: "Publishing project update…",
            success: "Update published to #mobile",
            error: "Couldn’t publish the update",
          })
        }
      >
        Resolves
      </Button>
      <Button
        onClick={() =>
          toast.promise(
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Network error")), 1500)
            ),
            {
              loading: "Exporting issues to CSV…",
              success: "Export ready",
              error: (error: Error) => `Export failed: ${error.message}`,
            }
          )
        }
      >
        Rejects
      </Button>
    </div>
  ),
};

/** `closeButton` shows a × on hover. */
export const WithCloseButton: Story = {
  args: { closeButton: true },
  render: () => (
    <Button onClick={() => toast.info("Notifications paused until 9:00")}>
      Show toast
    </Button>
  ),
};
