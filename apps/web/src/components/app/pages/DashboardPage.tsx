import {
  Button,
  Card,
  CardDescription,
  CardTitle,
} from "@cloudflare-starter/ui";
import { Link } from "@tanstack/react-router";

const sections = [
  {
    href: "/app/profile",
    title: "Profile",
    description:
      "Inspect the signed-in user and manage password changes in-app.",
  },
  {
    href: "/app/upload-demo",
    title: "Upload Demo",
    description:
      "Create a file record, upload directly to R2, and mint a signed download URL.",
  },
  {
    href: "/app/queue-demo",
    title: "Queue Demo",
    description:
      "Send a typed message to Cloudflare Queues and verify the worker consumes it.",
  },
  {
    href: "/app/email-demo",
    title: "Email Demo",
    description:
      "Send a Mailjet-backed test email to the currently signed-in user.",
  },
] as const;

export function DashboardPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">
          Dashboard
        </p>
        <h2 className="text-3xl font-semibold text-zinc-950">Starter app</h2>
        <p className="max-w-3xl text-sm leading-6 text-zinc-600">
          This dashboard is the authenticated entry route. Each destination
          below is now part of the `/app/*` SPA instead of a separate top-level
          Astro page.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.href} className="flex flex-col gap-4">
            <CardTitle>{section.title}</CardTitle>
            <CardDescription className="grow leading-6">
              {section.description}
            </CardDescription>
            <Link to={section.href}>
              <Button variant="outline">Open</Button>
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
}
