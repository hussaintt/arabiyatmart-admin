"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, RefreshCw, Search, UserRound, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomSelect } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminFetch, type ApiError } from "@/lib/api";
import { adminPaths } from "@/lib/api/paths";
import { queryKeys } from "@/lib/api/query-keys";
import { AdminUser, personName, roleNames } from "./types";

type Response = { data: AdminUser[]; nextCursor: string | null; hasMore: boolean; total: number };

export function UsersList() {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<string | null>>([]);
  const params = useMemo(() => {
    const value = new URLSearchParams({ limit: "25" });
    if (search) value.set("q", search);
    if (status !== "ALL") value.set("status", status);
    if (type !== "ALL") value.set("type", type);
    if (cursor) value.set("cursor", cursor);
    return value.toString();
  }, [cursor, search, status, type]);
  const query = useQuery({ queryKey: queryKeys.users(params), queryFn: () => adminFetch<Response>(`${adminPaths.users}?${params}`) });

  function submit(event: FormEvent) { event.preventDefault(); setSearch(draft.trim()); setCursor(null); setHistory([]); }
  function next() { if (!query.data?.nextCursor) return; setHistory((items) => [...items, cursor]); setCursor(query.data.nextCursor); }
  function previous() { setHistory((items) => { const nextHistory = [...items]; setCursor(nextHistory.pop() ?? null); return nextHistory; }); }

  return <div className="space-y-6 pb-10">
    <Header title="المستخدمون والحسابات" description="تحكم في المشترين والبائعين والمشرفين، حالات الحساب، وتاريخ النشاط." onRefresh={() => query.refetch()} refreshing={query.isFetching} />
    <Card><CardHeader className="border-b"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><CardTitle>دليل الحسابات</CardTitle><p className="mt-1 text-xs text-muted-foreground">{query.data?.total.toLocaleString("ar-EG") ?? "—"} حساب</p></div><form onSubmit={submit} className="grid gap-2 sm:grid-cols-3 xl:flex"><div className="relative sm:col-span-3 xl:w-72"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={draft} onChange={(e) => setDraft(e.target.value)} className="ps-9" placeholder="الاسم، البريد أو الهاتف" /></div><div className="w-36"><CustomSelect value={type} onChange={(e) => { setType(e.target.value); setCursor(null); }} options={[{ value: "ALL", label: "كل الأنواع" }, { value: "customer", label: "عملاء" }, { value: "seller", label: "بائعون" }, { value: "admin", label: "إدارة" }]} /></div><div className="w-36"><CustomSelect value={status} onChange={(e) => { setStatus(e.target.value); setCursor(null); }} options={[{ value: "ALL", label: "كل الحالات" }, { value: "ACTIVE", label: "نشط" }, { value: "PENDING", label: "قيد التفعيل" }, { value: "SUSPENDED", label: "موقوف" }]} /></div><Button type="submit">بحث</Button></form></div></CardHeader><CardContent className="p-0">
      {query.isLoading ? <Loading /> : query.error ? <ErrorState error={query.error as ApiError} /> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>الحساب</TableHead><TableHead>الحالة</TableHead><TableHead>الأدوار</TableHead><TableHead>آخر دخول</TableHead><TableHead>تاريخ الإنشاء</TableHead></TableRow></TableHeader><TableBody>{query.data?.data.map((user) => <TableRow key={user.publicId}><TableCell><Link href={`/users/${user.publicId}`} className="flex min-w-64 items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-muted"><UserRound className="size-4" /></span><span><strong className="block">{personName(user)}</strong><span className="mt-1 block text-xs text-muted-foreground" dir="ltr">{user.email}</span></span></Link></TableCell><TableCell><Badge variant={user.status === "ACTIVE" ? "default" : user.status === "SUSPENDED" ? "destructive" : "secondary"}>{user.status}</Badge></TableCell><TableCell><div className="flex flex-wrap gap-1">{roleNames(user).map((role) => <Badge key={role} variant="outline">{role}</Badge>)}</div></TableCell><TableCell className="text-xs text-muted-foreground">{date(user.lastLoginAt)}</TableCell><TableCell className="text-xs text-muted-foreground">{date(user.createdAt)}</TableCell></TableRow>)}</TableBody></Table></div>}
      {!query.isLoading && !query.data?.data.length && <div className="grid min-h-56 place-items-center text-center"><div><UsersRound className="mx-auto size-7 text-muted-foreground" /><p className="mt-2 font-bold">لا توجد حسابات مطابقة</p></div></div>}
    </CardContent>{query.data && (history.length > 0 || query.data.hasMore) && <div className="flex justify-end gap-2 border-t p-4"><Button variant="outline" size="sm" onClick={previous} disabled={!history.length}><ChevronRight /> السابق</Button><Button variant="outline" size="sm" onClick={next} disabled={!query.data.hasMore}>التالي <ChevronLeft /></Button></div>}</Card>
  </div>;
}

export function Header({ title, description, onRefresh, refreshing }: { title: string; description: string; onRefresh: () => void; refreshing: boolean }) { return <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">إدارة السوق</p><h1 className="mt-1 text-2xl font-black md:text-3xl">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p></div><Button variant="outline" onClick={onRefresh}><RefreshCw className={refreshing ? "animate-spin" : ""} /> تحديث</Button></div>; }
export function Loading() { return <div className="grid min-h-56 place-items-center text-sm text-muted-foreground">جارٍ تحميل البيانات…</div>; }
export function ErrorState({ error }: { error: ApiError }) { return <div className="grid min-h-56 place-items-center text-center"><div><p className="font-bold text-destructive">تعذّر تحميل البيانات</p><p className="mt-2 text-sm text-muted-foreground">{error.message}</p></div></div>; }
export function date(value?: string | null) { return value ? new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—"; }
