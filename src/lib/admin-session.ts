import { cookies } from "next/headers";

const ACCESS_COOKIE = "ym_admin_access";
const REFRESH_COOKIE = "ym_admin_refresh";
export const CSRF_COOKIE = "ym_admin_csrf";

export type AdminIdentity = {
  publicId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  roles: string[];
  capabilities: string[];
};

export function apiBaseUrl() {
  return (process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function sessionTokens() {
  const store = await cookies();
  return {
    accessToken: store.get(ACCESS_COOKIE)?.value,
    refreshToken: store.get(REFRESH_COOKIE)?.value,
  };
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}

export function cookieNames() {
  return { access: ACCESS_COOKIE, refresh: REFRESH_COOKIE, csrf: CSRF_COOKIE };
}
