import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  apiBaseUrl,
  cookieNames,
  sessionCookieOptions,
  sessionTokens,
} from "@/lib/admin-session";

type TokenResponse = { accessToken: string; refreshToken: string; expiresIn: number };
type AdminSessionResponse = {
  data?: {
    publicId?: string;
    email?: string;
    firstName?: string | null;
    lastName?: string | null;
    roles?: string[];
    capabilities?: string[];
  };
};

function failure(message: string, status: number) {
  return NextResponse.json({ error: { code: "ADMIN_SESSION_ERROR", message } }, { status });
}

async function identityFor(accessToken: string) {
  const response = await fetch(`${apiBaseUrl()}/v1/admin/session`, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const body = (await response.json()) as AdminSessionResponse;
  const user = body.data;
  if (!user?.email || !user.capabilities?.length) return null;
  return {
    publicId: user.publicId ?? "",
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: user.roles ?? [],
    capabilities: user.capabilities,
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  if (!body?.email || !body.password) return failure("أدخل البريد الإلكتروني وكلمة المرور", 400);

  const login = await fetch(`${apiBaseUrl()}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ email: body.email, password: body.password }),
    cache: "no-store",
  });
  if (!login.ok) return failure("بيانات الدخول غير صحيحة", login.status === 429 ? 429 : 401);

  const tokens = (await login.json()) as TokenResponse;
  const identity = await identityFor(tokens.accessToken);
  if (!identity) {
    await fetch(`${apiBaseUrl()}/v1/auth/logout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    }).catch(() => undefined);
    return failure("هذا الحساب غير مصرح له باستخدام لوحة التحكم", 403);
  }

  const response = NextResponse.json({ data: { user: identity } });
  const names = cookieNames();
  response.cookies.set(names.access, tokens.accessToken, sessionCookieOptions(tokens.expiresIn));
  response.cookies.set(names.refresh, tokens.refreshToken, sessionCookieOptions(7 * 24 * 60 * 60));
  response.cookies.set(names.csrf, crypto.randomBytes(32).toString("base64url"), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  return response;
}

export async function GET() {
  const { accessToken } = await sessionTokens();
  if (!accessToken) return failure("لم يتم تسجيل الدخول", 401);
  const identity = await identityFor(accessToken);
  if (!identity) return failure("انتهت الجلسة", 401);
  return NextResponse.json({ data: { user: identity } });
}

export async function DELETE() {
  const { refreshToken } = await sessionTokens();
  if (refreshToken) {
    await fetch(`${apiBaseUrl()}/v1/auth/logout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }
  const response = new NextResponse(null, { status: 204 });
  const names = cookieNames();
  response.cookies.delete(names.access);
  response.cookies.delete(names.refresh);
  response.cookies.delete(names.csrf);
  return response;
}
