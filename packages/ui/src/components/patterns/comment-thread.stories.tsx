import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import {
  CommentComposer,
  type CommentData,
  CommentItem,
  CommentThread,
} from "./comment-thread";
import { people } from "./fixtures";

/**
 * An issue's discussion: comments with reactions, and a composer with an auto-growing
 * textarea, attach and send buttons. ⌘↵ (Ctrl+↵) sends.
 */
const meta = {
  title: "Patterns/CommentThread",
  component: CommentThread,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { comments: [] },
  argTypes: { comments: { control: false }, composer: { control: false } },
} satisfies Meta<typeof CommentThread>;

export default meta;
type Story = StoryObj<typeof meta>;

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

const initialComments: readonly CommentData[] = [
  {
    id: "c1",
    author: people.ben,
    createdAt: minutesAgo(60 * 26),
    body: "Repro'd on Outlook web: the link is opened by Safe Links before the user clicks it, so the one-time token is already spent.",
    reactions: [
      { emoji: "👀", count: 2, people: ["Ada Novak", "Dan Whitfield"] },
    ],
  },
  {
    id: "c2",
    author: people.ada,
    createdAt: minutesAgo(95),
    body: "Plan: make the GET land on a confirm page and only consume the token on POST. Same flow for password reset.",
    edited: true,
    reactions: [
      {
        emoji: "👍",
        count: 3,
        reacted: true,
        people: ["You", "Ben Okafor", "Eva Lindqvist"],
      },
      { emoji: "🚀", count: 1, people: ["Chloé Martin"] },
    ],
  },
  {
    id: "c3",
    author: people.chloe,
    createdAt: minutesAgo(12),
    body: "I'll mock the confirm page today. Keep it to one button?",
  },
];

function toggleReaction(
  comments: readonly CommentData[],
  commentId: string,
  emoji: string
): CommentData[] {
  return comments.map((c) => {
    if (c.id !== commentId) return c;
    const reactions = [...(c.reactions ?? [])];
    const index = reactions.findIndex((r) => r.emoji === emoji);
    const current = reactions[index];
    if (!current) {
      reactions.push({ emoji, count: 1, reacted: true, people: ["You"] });
    } else {
      reactions[index] = {
        ...current,
        reacted: !current.reacted,
        count: current.count + (current.reacted ? -1 : 1),
      };
    }
    return { ...c, reactions };
  });
}

export const Playground: Story = {
  render: function Render() {
    const [comments, setComments] = useState(initialComments);
    return (
      <div className="max-w-2xl">
        <CommentThread
          comments={comments}
          onReact={(id, emoji) =>
            setComments((all) => toggleReaction(all, id, emoji))
          }
          composer={
            <CommentComposer
              author={people.ada}
              onAttach={() => {}}
              onSubmit={async (body) => {
                await new Promise((r) => setTimeout(r, 400));
                setComments((all) => [
                  ...all,
                  {
                    id: `c${all.length + 1}`,
                    author: people.ada,
                    createdAt: new Date(),
                    body,
                  },
                ]);
              }}
            />
          }
        />
      </div>
    );
  },
};

export const Composer: Story = {
  render: () => (
    <div className="max-w-2xl">
      <CommentComposer
        author={people.ada}
        onAttach={() => {}}
        defaultValue={
          "Shipped behind the `confirm-magic-link` flag.\nRolling out to 10% tomorrow."
        }
      />
    </div>
  ),
};

export const ComposerDisabled: Story = {
  render: () => (
    <div className="max-w-2xl">
      <CommentComposer
        author={people.ada}
        disabled
        placeholder="Comments are locked on canceled issues"
      />
    </div>
  ),
};

export const SingleComment: Story = {
  render: () => (
    <div className="max-w-2xl">
      <CommentItem
        comment={initialComments[1] as CommentData}
        onReact={() => {}}
      />
    </div>
  ),
};
