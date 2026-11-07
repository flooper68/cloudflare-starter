import {
  Button,
  Card,
  CardDescription,
  CardTitle,
} from "@cloudflare-starter/ui";
import { Link } from "@tanstack/react-router";

const demos = [
  {
    to: "/app/upload-demo",
    title: "Upload",
    description:
      "Upload through the FILES binding or straight to R2 with a presigned URL, list the workspace's files and download them.",
  },
  {
    to: "/app/queue-demo",
    title: "Queue",
    description:
      "Enqueue a typed job on Cloudflare Queues and watch the Worker's consumer run it.",
  },
  {
    to: "/app/email-demo",
    title: "Email",
    description:
      "Send a test email to your own address through Cloudflare Email Service.",
  },
] as const;

/**
 * `/app/demos`: the developer demos of the platform's bindings (R2, Queues, Email),
 * moved off the dashboard. They stay in the sidebar's Demos section too.
 */
export function DemosPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-fg">Developer demos</h2>
        <p className="text-sm text-fg-muted">
          Small screens that exercise the Cloudflare bindings the starter sets
          up. A project usually removes them.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {demos.map((demo) => (
          <Card key={demo.to} className="flex flex-col gap-3">
            <CardTitle>{demo.title}</CardTitle>
            <CardDescription className="grow">
              {demo.description}
            </CardDescription>
            <div>
              <Button asChild size="sm">
                <Link to={demo.to}>Open {demo.title.toLowerCase()} demo</Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
