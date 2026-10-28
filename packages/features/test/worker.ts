// Entry the test runtime needs; the integration tests call use cases directly.
export default {
  fetch: () => new Response("features integration tests"),
} satisfies ExportedHandler;
