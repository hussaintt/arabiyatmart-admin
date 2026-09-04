"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarClock, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomSelect } from "@/components/ui/custom-select";
import { adminFetch, type ApiError } from "@/lib/api";
import { adminPaths } from "@/lib/api/paths";

type Broadcast = { publicId: string; channel: string; audience: string; title: string; body: string | null; status: string; estimatedRecipients: number; scheduledAt: string | null; createdAt: string };
type Result = { data: Broadcast[]; meta: { hasMore: boolean; nextCursor: string | null } };

export function NotificationsControl({ canSend }: { canSend: boolean }) {
  const client = useQueryClient();
  const [form, setForm] = useState({ channel: "PUSH", audience: "ALL_CUSTOMERS", title: "", body: "", actionUrl: "", scheduledAt: "" });
  const history = useQuery({ queryKey: ["admin-notification-broadcasts"], queryFn: () => adminFetch<Result>(`${adminPaths.notifications}?limit=30`) });
  const send = useMutation({
    mutationFn: () => adminFetch(adminPaths.notificationBroadcast, {
      method: "POST",
      body: JSON.stringify({ ...form, actionUrl: form.actionUrl || undefined, scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined }),
    }),
    onSuccess: async () => {
      setForm({ channel: "PUSH", audience: "ALL_CUSTOMERS", title: "", body: "", actionUrl: "", scheduledAt: "" });
      await client.invalidateQueries({ queryKey: ["admin-notification-broadcasts"] });
    },
  });
  return <div className="space-y-6 pb-10">
    <div><h1 className="flex items-center gap-2 text-2xl font-black"><Bell className="size-6" /> الإشعارات</h1><p className="mt-2 text-sm text-muted-foreground">أنشئ رسائل فورية أو مجدولة، وراجع سجل الإرسال والجمهور المستهدف.</p></div>
    {canSend && <Card><CardHeader><CardTitle>رسالة جديدة</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="القناة"><CustomSelect value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} options={[{ value: "PUSH", label: "إشعار التطبيق" }, { value: "EMAIL", label: "البريد الإلكتروني" }, { value: "SMS", label: "رسالة نصية" }]} /></Field><Field label="الجمهور"><CustomSelect value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} options={[{ value: "ALL_CUSTOMERS", label: "كل العملاء" }, { value: "ALL_VENDORS", label: "كل المعارض" }, { value: "ALL", label: "كل المستخدمين" }]} /></Field><Field label="العنوان"><Input value={form.title} maxLength={200} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field><Field label="وقت الإرسال (اختياري)"><Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></Field></div><Field label="النص"><textarea value={form.body} maxLength={1000} onChange={(e) => setForm({ ...form, body: e.target.value })} className="min-h-28 w-full rounded-xl border bg-background p-3 text-sm" /></Field><Field label="رابط الإجراء (اختياري)"><Input dir="ltr" value={form.actionUrl} onChange={(e) => setForm({ ...form, actionUrl: e.target.value })} placeholder="/listing/example" /></Field>{send.error && <p className="text-sm text-destructive">{(send.error as ApiError).message}</p>}<div className="flex justify-end"><Button onClick={() => send.mutate()} disabled={send.isPending || !form.title.trim() || !form.body.trim()}>{form.scheduledAt ? <CalendarClock /> : <Send />}{send.isPending ? "جارٍ الحفظ…" : form.scheduledAt ? "جدولة الرسالة" : "إرسال الرسالة"}</Button></div></CardContent></Card>}
    <Card><CardHeader><CardTitle>سجل الإرسال</CardTitle></CardHeader><CardContent className="space-y-3">{history.isLoading ? <p className="text-sm text-muted-foreground">جارٍ التحميل…</p> : history.error ? <p className="text-sm text-destructive">{(history.error as ApiError).message}</p> : history.data?.data.length ? history.data.data.map((item) => <div key={item.publicId} className="rounded-xl border p-4"><div className="flex flex-wrap items-center gap-2"><strong>{item.title}</strong><Badge variant={item.status === "SENT" ? "default" : "secondary"}>{item.status}</Badge><Badge variant="outline">{item.channel}</Badge><span className="ms-auto text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("ar-EG")}</span></div><p className="mt-2 text-sm text-muted-foreground">{item.body}</p><p className="mt-2 text-xs text-muted-foreground">{item.audience} · {item.estimatedRecipients.toLocaleString("ar-EG")} مستلم {item.scheduledAt ? `· مجدول ${new Date(item.scheduledAt).toLocaleString("ar-EG")}` : ""}</p></div>) : <p className="text-sm text-muted-foreground">لا توجد رسائل مسجلة.</p>}</CardContent></Card>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
