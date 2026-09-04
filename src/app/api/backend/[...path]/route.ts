import { NextRequest, NextResponse } from "next/server";
import { apiBaseUrl, cookieNames, sessionCookieOptions, sessionTokens } from "@/lib/admin-session";

type RouteContext = { params: Promise<{ path: string[] }> };
type TokenResponse = { accessToken: string; refreshToken: string; expiresIn: number };
const ALLOWED_PREFIX = "v1/admin/";
const refreshFlights = new Map<string, Promise<TokenResponse | null>>();

function isStateChanging(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse | null> {
  const activeFlight = refreshFlights.get(refreshToken);
  if (activeFlight) return activeFlight;
  const flight = fetch(`${apiBaseUrl()}/v1/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  })
    .then(async (response) => response.ok ? await response.json() as TokenResponse : null)
    .catch(() => null)
    .finally(() => refreshFlights.delete(refreshToken));
  refreshFlights.set(refreshToken, flight);
  return flight;
}

function clearSession(response: NextResponse) {
  const names = cookieNames();
  response.cookies.delete(names.access);
  response.cookies.delete(names.refresh);
  response.cookies.delete(names.csrf);
  return response;
}

async function forward(request: NextRequest, path: string[], accessToken: string, body?: ArrayBuffer) {
  const target = `${apiBaseUrl()}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", request.headers.get("accept") ?? "application/json");
  headers.set("authorization", `Bearer ${accessToken}`);
  headers.set("x-request-id", request.headers.get("x-request-id") ?? crypto.randomUUID());
  const retryBody = body?.slice(0);
  return fetch(target, { method: request.method, headers, body: retryBody?.byteLength ? retryBody : undefined, cache: "no-store" });
}

function proxiedResponse(response: Response) {
  const next = new NextResponse(response.body, { status: response.status });
  const type = response.headers.get("content-type");
  if (type) next.headers.set("content-type", type);
  return next;
}

async function handle(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const joinedPath = path.join("/");
  if (!joinedPath.startsWith(ALLOWED_PREFIX)) {
    return NextResponse.json({ error: { code: "ADMIN_PROXY_FORBIDDEN", message: "Unsupported admin API path" } }, { status: 403 });
  }
  const names = cookieNames();
  if (isStateChanging(request.method)) {
    const csrfCookie = request.cookies.get(names.csrf)?.value;
    if (!csrfCookie || request.headers.get("x-csrf-token") !== csrfCookie) {
      return NextResponse.json({ error: { code: "CSRF_INVALID", message: "Invalid request token" } }, { status: 403 });
    }
  }

  const { accessToken, refreshToken } = await sessionTokens();
  const body = isStateChanging(request.method) ? await request.arrayBuffer() : undefined;
  let activeToken = accessToken;
  let tokensToSet: TokenResponse | null = null;
  if (!activeToken && refreshToken) {
    tokensToSet = await refreshAccessToken(refreshToken);
    activeToken = tokensToSet?.accessToken;
  }
  if (!activeToken) {
    const failure = NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Session required" } }, { status: 401 });
    return refreshToken ? clearSession(failure) : failure;
  }

  let upstream = await forward(request, path, activeToken, body);
  if (upstream.status === 401 && refreshToken) {
    const refreshed = await refreshAccessToken(refreshToken);
    if (!refreshed) return clearSession(proxiedResponse(upstream));
    tokensToSet = refreshed;
    upstream = await forward(request, path, refreshed.accessToken, body);
  }

  const response = proxiedResponse(upstream);
  if (tokensToSet) {
    response.cookies.set(names.access, tokensToSet.accessToken, sessionCookieOptions(tokensToSet.expiresIn));
    response.cookies.set(names.refresh, tokensToSet.refreshToken, sessionCookieOptions(7 * 24 * 60 * 60));
  }
  return response;
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
