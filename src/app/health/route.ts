/** Lightweight process check for the Render web-service health probe. */
export function GET() {
  return Response.json({ status: "ok" });
}
