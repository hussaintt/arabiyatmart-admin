export type ApiError = Error & { status?: number; code?: string };

function csrfToken() {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((value) => value.startsWith("ym_admin_csrf="))
    ?.split("=")[1];
}

export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = csrfToken();
    if (csrf) headers.set("x-csrf-token", csrf);
  }

  const response = await fetch(`/api/backend${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message ?? "تعذّر إكمال الطلب") as ApiError;
    error.status = response.status;
    error.code = payload?.error?.code;
    throw error;
  }
  return payload as T;
}

export async function startSession(email: string, password: string) {
  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "same-origin",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? "تعذّر تسجيل الدخول");
  return payload as { data: { user: { email: string; roles: string[] } } };
}

export async function endSession() {
  await fetch("/api/session", { method: "DELETE", credentials: "same-origin" });
}
