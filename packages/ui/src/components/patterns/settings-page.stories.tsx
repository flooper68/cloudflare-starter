import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Bell,
  Building2,
  CreditCard,
  KeyRound,
  Palette,
  Plug,
  Shield,
  User,
  Users,
} from "lucide-react";
import { useState } from "react";

import { brand, LogoMark } from "../../brand/brand";
import { Button } from "../button";
import { Input } from "../input";
import { Select, SelectItem } from "../select";
import { Switch } from "../switch";
import { TeamIcon } from "./app-shell";
import {
  SettingsHeader,
  SettingsLayout,
  SettingsNav,
  SettingsNavBack,
  SettingsNavGroup,
  SettingsNavItem,
  SettingsRow,
  SettingsSection,
} from "./settings-page";

/**
 * Linear's settings: a nav of groups on the left (hidden on small screens), a centred column
 * of sections on the right. Each `SettingsRow` puts the label and description on the left and
 * the control on the right, stacking on narrow widths.
 */
const meta = {
  title: "Patterns/SettingsPage",
  component: SettingsLayout,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { nav: null, children: null },
  argTypes: { nav: { control: false }, children: { control: false } },
} satisfies Meta<typeof SettingsLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A settings-row select: the shared Select with string options. */
function OptionSelect({
  value,
  options,
  onChange,
  label,
}: {
  readonly value: string;
  readonly options: readonly string[];
  readonly onChange: (value: string) => void;
  readonly label: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={onChange}
      size="sm"
      aria-label={label}
      className="w-44"
    >
      {options.map((option) => (
        <SelectItem key={option} value={option}>
          {option}
        </SelectItem>
      ))}
    </Select>
  );
}

function Nav({ active }: { readonly active: string }) {
  return (
    <SettingsNav back={<SettingsNavBack />}>
      <SettingsNavGroup label="Account" icon={<User />}>
        <SettingsNavItem active={active === "preferences"}>
          Preferences
        </SettingsNavItem>
        <SettingsNavItem>Profile</SettingsNavItem>
        <SettingsNavItem icon={<Bell />}>Notifications</SettingsNavItem>
        <SettingsNavItem icon={<Shield />}>Security & access</SettingsNavItem>
      </SettingsNavGroup>
      <SettingsNavGroup label={brand.name} icon={<LogoMark />}>
        <SettingsNavItem icon={<Building2 />} active={active === "workspace"}>
          Workspace
        </SettingsNavItem>
        <SettingsNavItem icon={<Users />}>Members</SettingsNavItem>
        <SettingsNavItem icon={<Plug />}>Integrations</SettingsNavItem>
        <SettingsNavItem icon={<KeyRound />}>API</SettingsNavItem>
        <SettingsNavItem icon={<CreditCard />}>Billing</SettingsNavItem>
      </SettingsNavGroup>
      <SettingsNavGroup label="Your teams">
        <SettingsNavItem icon={<TeamIcon name="Engineering" />}>
          Engineering
        </SettingsNavItem>
        <SettingsNavItem icon={<TeamIcon name="Design" tone="warning" />}>
          Design
        </SettingsNavItem>
      </SettingsNavGroup>
    </SettingsNav>
  );
}

export const Preferences: Story = {
  render: function Render() {
    const [theme, setTheme] = useState("System");
    const [home, setHome] = useState("Inbox");
    return (
      <div className="h-dvh">
        <SettingsLayout nav={<Nav active="preferences" />}>
          <SettingsHeader
            title="Preferences"
            description="Manage how the app looks and behaves for you."
          />
          <SettingsSection title="General">
            <SettingsRow
              label="Default home view"
              description="The page that opens when you start the app."
            >
              <OptionSelect
                label="Default home view"
                value={home}
                options={["Inbox", "My issues", "Active issues"]}
                onChange={setHome}
              />
            </SettingsRow>
            <SettingsRow
              label="Display full names"
              description="Show full names of people instead of shorter usernames."
            >
              <Switch aria-label="Display full names" defaultChecked />
            </SettingsRow>
            <SettingsRow
              label="First day of the week"
              description="Used for date pickers and cycles."
            >
              <OptionSelect
                label="First day of the week"
                value="Monday"
                options={["Monday", "Sunday"]}
                onChange={() => {}}
              />
            </SettingsRow>
          </SettingsSection>
          <SettingsSection title="Interface and theme">
            <SettingsRow
              label="Interface theme"
              description="Pick light, dark, or follow your system."
            >
              <OptionSelect
                label="Interface theme"
                value={theme}
                options={["System", "Light", "Dark"]}
                onChange={setTheme}
              />
            </SettingsRow>
            <SettingsRow
              label="Use pointer cursors"
              description="Change the cursor to a pointer over interactive elements."
            >
              <Switch aria-label="Use pointer cursors" />
            </SettingsRow>
            <SettingsRow
              label="Accent colour"
              description="Comes from the brand; edit brand.css to change it."
            >
              <span className="inline-flex items-center gap-2 text-sm text-fg-muted">
                <Palette className="size-4" /> Brand accent
              </span>
            </SettingsRow>
          </SettingsSection>
        </SettingsLayout>
      </div>
    );
  },
};

export const Workspace: Story = {
  render: () => (
    <div className="h-dvh">
      <SettingsLayout nav={<Nav active="workspace" />}>
        <SettingsHeader
          title="Workspace"
          description={`General settings for ${brand.name}.`}
        />
        <SettingsSection title="Details">
          <SettingsRow
            label="Logo"
            description="Recommended size is 256×256px."
          >
            <LogoMark className="size-8" />
            <Button variant="secondary" size="sm">
              Upload
            </Button>
          </SettingsRow>
          <SettingsRow label="Name" htmlFor="ws-name">
            <Input
              id="ws-name"
              size="sm"
              defaultValue={brand.name}
              className="w-56"
            />
          </SettingsRow>
          <SettingsRow
            label="URL"
            htmlFor="ws-url"
            description="Changing it breaks existing links."
          >
            <Input
              id="ws-url"
              size="sm"
              defaultValue="acme"
              leading={<span className="text-xs">app/</span>}
              className="w-56"
            />
          </SettingsRow>
        </SettingsSection>
        <SettingsSection
          title="Danger zone"
          description="These actions can't be undone."
          tone="danger"
        >
          <SettingsRow
            label="Export data"
            description="Download all issues, projects and comments as CSV."
          >
            <Button variant="secondary" size="sm">
              Export
            </Button>
          </SettingsRow>
          <SettingsRow
            label="Delete workspace"
            description="Permanently delete the workspace and everything in it."
          >
            <Button variant="danger" size="sm">
              Delete workspace
            </Button>
          </SettingsRow>
        </SettingsSection>
      </SettingsLayout>
    </div>
  ),
};
