import { Button, EmptyState } from "@cloudflare-starter/ui";
import { Link } from "@tanstack/react-router";
import { FileQuestion } from "lucide-react";

/** Any `/app` or `/admin` path the SPA has no route for (the router's notFoundComponent). */
export function AppNotFoundPage() {
  return (
    <EmptyState
      icon={<FileQuestion />}
      title="Page not found"
      description="The page you opened doesn't exist, or you can't see it."
      primaryAction={
        <Button asChild variant="secondary">
          <Link to="/app/dashboard">Back to dashboard</Link>
        </Button>
      }
    />
  );
}
