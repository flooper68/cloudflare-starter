import type { Preview } from "@storybook/react-vite";
import "@cloudflare-starter/ui/globals.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    options: {
      storySort: {
        order: ["UI", ["Button", "Card", "Input", "Label"]],
      },
    },
  },
};

export default preview;
