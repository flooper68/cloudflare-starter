import {
  Button,
  Card,
  CardDescription,
  CardTitle,
} from "@cloudflare-starter/ui";
import { Link } from "@tanstack/react-router";

export function AppNotFoundPage() {
  return (
    <section className="space-y-6">
      <Card className="space-y-4">
        <CardTitle>Page not found</CardTitle>
        <CardDescription>
          This route is not registered inside the `/app/*` SPA.
        </CardDescription>
        <div>
          <Link to="/app/dashboard">
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        </div>
      </Card>
    </section>
  );
}
