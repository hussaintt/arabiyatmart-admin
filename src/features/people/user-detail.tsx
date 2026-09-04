"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Ban, BriefcaseBusiness, CheckCircle2, MapPin, Pencil, Shield, UserRound } from "lucide-react";
import { ActionDialog } from "@/components/admin/action-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminFetch, type ApiError } from "@/lib/api";
import { adminPaths } from "@/lib/api/paths";
import { queryKeys } from "@/lib/api/query-keys";
import { AdminUser, personName, roleNames } from "./types";
import { date, ErrorState, Loading } from "./users-list";

export function UserDetail({ publicId, canWrite }: { publicId: string; canWrite: boolean }) {
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [statusAction, setStatusAction] = useState<"ACTIVE" | "SUSPENDED" | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", locale: "ar" });
  const query = useQuery({ queryKey: queryKeys.user(publicId), queryFn: () => adminFetch<AdminUser>(adminPaths.user(publicId)) });
  const user = query.data;
  const refresh = async () => { await client.invalidateQueries({ queryKey: queryKeys.user(publicId) }); await client.invalidateQueries({ queryKey: ["admin-users"] }); };
  const update = useMutation({ mutationFn: () => adminFetch(adminPaths.user(publicId), { method: "PATCH", body: JSON.stringify({ ...form, phone: form.phone || undefined }) }), onSuccess: async () => { setEditing(false); await refresh(); } });
  const status = useMutation({ mutationFn: ({ nextStatus, reason }: { nextStatus: "ACTIVE" | "SUSPENDED"; reason?: string }) => adminFetch(adminPaths.userStatus(publicId), { method: "PATCH", body: JSON.stringify({ status: nextStatus, reason: reason || undefined }) }), onSuccess: async () => { setStatusAction(null); await refresh(); } });

  if (query.isLoading) return <Loading />;
  if (query.error || !user) return <ErrorState error={query.error as ApiError} />;
  function beginEdit() { setForm({ firstName: user!.firstName ?? "", lastName: user!.lastName ?? "", email: user!.email, phone: user!.phone ?? "", locale: user!.locale }); setEditing(true); }

  return <div className="space-y-6 pb-10">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><Link href="/users" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground"><ArrowRight className="size-4" /> المستخدمون</Link><div className="mt-3 flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-muted"><UserRound /></span><div><h1 className="text-2xl font-black">{personName(user)}</h1><p className="text-xs text-muted-foreground" dir="ltr">{user.publicId}</p></div><Badge variant={user.status === "ACTIVE" ? "default" : "destructive"}>{user.status}</Badge></div></div>{canWrite && <div className="flex gap-2"><Button variant="outline" onClick={() => editing ? setEditing(false) : beginEdit()}><Pencil /> تعديل</Button>{user.status === "SUSPENDED" ? <Button onClick={() => setStatusAction("ACTIVE")}><CheckCircle2 /> تفعيل</Button> : <Button variant="destructive" onClick={() => setStatusAction("SUSPENDED")}><Ban /> إيقاف</Button>}</div>}</div>
    <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
      <div className="space-y-6">
        <Card><CardHeader><CardTitle>بيانات الحساب</CardTitle></CardHeader><CardContent>{editing ? <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="الاسم الأول"><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field><Field label="اسم العائلة"><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field><Field label="البريد"><Input dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field><Field label="الهاتف"><Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field></div>{update.error && <p className="text-sm text-destructive">{(update.error as ApiError).message}</p>}<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(false)}>إلغاء</Button><Button onClick={() => update.mutate()} disabled={update.isPending}>حفظ</Button></div></div> : <div className="grid gap-3 sm:grid-cols-2"><Info label="البريد" value={user.email} /><Info label="الهاتف" value={user.phone ?? "—"} /><Info label="اللغة" value={user.locale} /><Info label="آخر دخول" value={date(user.lastLoginAt)} /><Info label="الإنشاء" value={date(user.createdAt)} /><Info label="الإعلانات" value={String(user._count?.listings ?? 0)} /></div>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><BriefcaseBusiness className="size-5" /> عضويات المعارض</CardTitle></CardHeader><CardContent>{user.vendorMemberships?.length ? <div className="space-y-2">{user.vendorMemberships.map((membership) => <Link key={membership.vendor.publicId} href={`/dealers/${membership.vendor.publicId}`} className="flex items-center justify-between rounded-xl border p-3"><strong>{membership.vendor.displayName.ar || membership.vendor.displayName.en}</strong><Badge variant="outline">{membership.vendor.status}</Badge></Link>)}</div> : <p className="text-sm text-muted-foreground">لا توجد عضويات معارض.</p>}</CardContent></Card>
      </div>
      <div className="space-y-6"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Shield className="size-5" /> الأدوار والصلاحيات</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{roleNames(user).map((role) => <Badge key={role}>{role}</Badge>)}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="size-5" /> العناوين والتحقق</CardTitle></CardHeader><CardContent className="space-y-3"><Info label="العناوين" value={String(user.addresses?.length ?? 0)} /><Info label="ملفات التحقق" value={String(user.userVerifications?.length ?? 0)} /></CardContent></Card></div>
    </div>
    <ActionDialog open={Boolean(statusAction)} onOpenChange={(open) => { if (!open) setStatusAction(null); }} title={statusAction === "SUSPENDED" ? "إيقاف الحساب" : "إعادة تفعيل الحساب"} description={statusAction === "SUSPENDED" ? "سيُمنع المستخدم من تسجيل الدخول، وتُبطل جلساته وتُوقف إعلاناته النشطة. اكتب سبب القرار لسجل التدقيق." : "سيتمكن المستخدم من دخول المنصة مجددًا."} confirmLabel={statusAction === "SUSPENDED" ? "إيقاف" : "تفعيل"} requireReason={statusAction === "SUSPENDED"} destructive={statusAction === "SUSPENDED"} pending={status.isPending} error={(status.error as ApiError | null)?.message} onConfirm={(reason) => { if (statusAction) status.mutate({ nextStatus: statusAction, reason }); }} />
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold" dir={label === "البريد" ? "ltr" : undefined}>{value}</p></div>; }
