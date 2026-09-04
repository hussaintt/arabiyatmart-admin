import "server-only";

import { redirect } from "next/navigation";
import { apiBaseUrl, type AdminIdentity, sessionTokens } from "@/lib/admin-session";
import type { AdminCapability } from "@/lib/auth/permissions";

type SessionResponse = { data?: AdminIdentity };

export async function resolveAdminSession(): Promise<AdminIdentity | null> {
  const { accessToken } = await sessionTokens();
  if (!accessToken) return null;
  const response = await fetch(`${apiBaseUrl()}/v1/admin/session`, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return null;
  const body = (await response.json()) as SessionResponse;
  return body.data ?? null;
}

export async function requireAdminSession() {
  const session = await resolveAdminSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdminCapability(capability: AdminCapability) {
  const session = await requireAdminSession();
  if (!session.capabilities.includes(capability)) redirect("/dashboard?forbidden=1");
  return session;
}
