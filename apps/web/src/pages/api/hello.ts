import type { APIRoute } from "astro";

export const GET: APIRoute = () =>
  new Response(JSON.stringify({ message: "hello world" }), {
    headers: {
      "Content-Type": "application/json",
    },
  });
