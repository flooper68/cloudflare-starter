import type { Decorator, Preview } from "@storybook/react-vite";
import "@cloudflare-starter/ui/globals.css";
import { TooltipProvider } from "@cloudflare-starter/ui";
import { useEffect } from "react";

/** Applies the toolbar theme to <html data-theme>, like the app does. */
const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals.theme as string) ?? "dark";
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <TooltipProvider>
      <Story />
    </TooltipProvider>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: "Colour theme",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "dark", title: "Dark" },
          { value: "light", title: "Light" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "dark" },
  parameters: {
    layout: "centered",
    backgrounds: { disabled: true },
    a11y: { test: "todo" },
    controls: { expanded: true },
    options: {
      storySort: {
        order: [
          "Introduction",
          "Foundations",
          ["Brand", "Colors", "Typography", "Elevation"],
          "Actions",
          "Forms",
          "Overlays",
          "Feedback",
          "Data display",
          "Navigation",
          "Patterns",
        ],
      },
    },
  },
};

export default preview;
