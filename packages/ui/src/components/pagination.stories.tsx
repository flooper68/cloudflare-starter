import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Pagination } from "./pagination";

/**
 * Page navigation: "1–20 of 312", a page-size select, numbered pages with gaps, and
 * previous/next. Pages are 1-based. `DataTable` uses it in its footer.
 */
const meta = {
  title: "Navigation/Pagination",
  component: Pagination,
  tags: ["autodocs"],
  args: {
    page: 1,
    pageCount: 16,
    total: 312,
    pageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],
    siblingCount: 1,
    compact: false,
    onPageChange: () => {},
    onPageSizeChange: () => {},
  },
  decorators: [
    (Story) => (
      <div className="w-[640px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => {
    const [page, setPage] = useState(args.page);
    const [pageSize, setPageSize] = useState(args.pageSize ?? 20);
    const total = args.total ?? 312;
    return (
      <Pagination
        {...args}
        page={page}
        pageSize={pageSize}
        pageCount={Math.ceil(total / pageSize)}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    );
  },
};

export const Middle: Story = { args: { page: 8 } };

export const LastPage: Story = { args: { page: 16 } };

export const FewPages: Story = {
  args: { page: 2, pageCount: 4, total: 72 },
};

export const PagesOnly: Story = {
  args: {
    page: 5,
    total: undefined,
    pageSizeOptions: undefined,
  },
};

export const Compact: Story = {
  args: { page: 3, compact: true, pageSizeOptions: undefined },
};

export const Empty: Story = {
  args: { page: 1, pageCount: 0, total: 0 },
};
