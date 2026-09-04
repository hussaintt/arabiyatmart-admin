/**
 * Resolve media URLs returned by the backend.
 *
 * The local storage driver intentionally returns `/uploads/...` so the API can
 * be mounted behind a proxy. The admin is served from a different origin in
 * development (and may be served from a CDN in production), so relative URLs
 * must be anchored to the configured backend origin before being assigned to
 * an image element.
 */
export function mediaUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  // Uploaded previews and externally hosted media are already browser-ready.
  if (/^(?:https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith("//")) {
    const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
    return `${protocol}${value}`;
  }
  if (value.startsWith("/api/")) return value;

  const backendOrigin = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
  if (!backendOrigin) return value;
  return `${backendOrigin}${value.startsWith("/") ? value : `/${value}`}`;
}
