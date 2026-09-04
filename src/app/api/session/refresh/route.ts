import { NextRequest, NextResponse } from "next/server";
import { apiBaseUrl, cookieNames, sessionCookieOptions, sessionTokens } from "@/lib/admin-session";

type TokenResponse = { accessToken: string; refreshToken: string; expiresIn: number };

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export async function GET(request: NextRequest) {
  const { refreshToken } = await sessionTokens();
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", next);
  if (!refreshToken) return NextResponse.redirect(loginUrl);

  const refreshed = await fetch(`${apiBaseUrl()}/v1/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  }).catch(() => null);
  if (!refreshed?.ok) {
    const response = NextResponse.redirect(loginUrl);
    const names = cookieNames();
    response.cookies.delete(names.access);
    response.cookies.delete(names.refresh);
    response.cookies.delete(names.csrf);
    return response;
  }

  const tokens = await refreshed.json() as TokenResponse;
  const response = NextResponse.redirect(new URL(next, request.url));
  const names = cookieNames();
  response.cookies.set(names.access, tokens.accessToken, sessionCookieOptions(tokens.expiresIn));
  response.cookies.set(names.refresh, tokens.refreshToken, sessionCookieOptions(7 * 24 * 60 * 60));
  return response;
}
