import {
  Button,
  Card,
  CardDescription,
  CardTitle,
} from "@cloudflare-starter/ui";

const demos = [
  {
    title: "R2 Upload Demo",
    description:
      "Create a DB-backed file record, mint a presigned upload URL, upload directly to R2, and fetch a signed download URL.",
    href: "/app/upload-demo",
  },
  {
    title: "Queue Demo",
    description:
      "Send a typed hello-world message into Cloudflare Queues and process it from a dedicated worker.",
    href: "/app/queue-demo",
  },
  {
    title: "Mailjet Demo",
    description:
      "Send a test email to the currently signed-in Clerk account using the Mailjet adapter.",
    href: "/app/email-demo",
  },
] as const;

interface HomePageProps {
  readonly signedIn: boolean;
}

export function HomePage({ signedIn }: HomePageProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-6 py-10">
      <header className="rounded-[2rem] border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">
          Personal Cloudflare Starter
        </p>
        <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-950 md:text-5xl">
              Bun, Astro, React, Clerk, R2, Queues, Mailjet.
            </h1>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              A Cloudflare-first starter kit for personal products. The demos
              are intentionally real: typed APIs, protected pages, DB-backed
              uploads, a real queue consumer, and provider-backed email.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a href={signedIn ? "/app/dashboard" : "/sign-up"}>
              <Button>{signedIn ? "Open app" : "Create account"}</Button>
            </a>
            <a href={signedIn ? "/app/queue-demo" : "/sign-in"}>
              <Button variant="outline">
                {signedIn ? "Queue demo" : "Sign in"}
              </Button>
            </a>
          </div>
        </div>
      </header>

      <section className="grid gap-5 md:grid-cols-3">
        {demos.map((demo) => (
          <Card key={demo.title} className="flex flex-col gap-4">
            <CardTitle>{demo.title}</CardTitle>
            <CardDescription className="grow leading-6">
              {demo.description}
            </CardDescription>
            <a
              className="text-sm font-semibold text-teal-700 hover:text-teal-800"
              href={signedIn ? demo.href : "/sign-in"}
            >
              {signedIn ? "Open demo" : "Sign in to use"}
            </a>
          </Card>
        ))}
      </section>
    </main>
  );
}
