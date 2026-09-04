import { NextRequest, NextResponse } from "next/server";

const protectedPath = ["/dashboard", "/listings", "/market", "/users", "/dealers", "/operations", "/trust", "/notifications", "/imports", "/scraper", "/jobs", "/gemini-batch-runner", "/settings", "/audit"];

function accessTokenExpired(token?: string) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp * 1000 <= Date.now() + 5_000;
  } catch {
    return true;
  }
}

export function proxy(request: NextRequest) {
  const access = request.cookies.get("ym_admin_access")?.value;
  const refresh = request.cookies.get("ym_admin_refresh")?.value;
  const isProtected = protectedPath.some((path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`));
  if (isProtected && accessTokenExpired(access)) {
    if (refresh) {
      const refreshUrl = new URL("/api/session/refresh", request.url);
      refreshUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(refreshUrl);
    }
    const url = new URL("/login", request.url);
    url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"] };
