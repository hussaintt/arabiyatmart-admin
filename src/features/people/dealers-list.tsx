"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomSelect } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminFetch, type ApiError } from "@/lib/api";
import { adminPaths } from "@/lib/api/paths";
import { queryKeys } from "@/lib/api/query-keys";
import { mediaUrl } from "@/lib/media";
import { Dealer, dealerName } from "./types";
import { date, ErrorState, Header, Loading } from "./users-list";

type Response = { data: Dealer[]; nextCursor: string | null; hasMore: boolean };

export function DealersList() {
  const [status, setStatus] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [draft, setDraft] = useState<string>("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<string | null>>([]);
  const params = useMemo(() => {
    const q = new URLSearchParams({ limit: "25" });
    if (status !== "ALL") q.set("status", status);
    if (search) q.set("search", search);
    if (cursor) q.set("cursor", cursor);
    return q.toString();
  }, [status, search, cursor]);
  const query = useQuery({ queryKey: queryKeys.dealers(params), queryFn: () => adminFetch<Response>(`${adminPaths.dealers}?${params}`) });
  function submit(event: FormEvent) { event.preventDefault(); setSearch(draft.trim()); setCursor(null); setHistory([]); }
  return (
    <div className="space-y-6 pb-10">
      <Header title="المعارض والبائعون المحترفون" description="إدارة ملفات المعارض، حالة الاعتماد، الفريق، المخزون، والتحقق التجاري." onRefresh={() => query.refetch()} refreshing={query.isFetching} />
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>دليل المعارض</CardTitle>
            <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
              <div className="relative sm:w-72">
                <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="ps-9" placeholder="الاسم، البريد أو الرابط" />
              </div>
              <div className="sm:w-44">
                <CustomSelect
                  value={status}
                  onChange={(e) => { setStatus(e.target.value); setCursor(null); }}
                  options={[
                    { value: "ALL", label: "كل الحالات" },
                    { value: "PENDING", label: "بانتظار الاعتماد" },
                    { value: "APPROVED", label: "معتمد" },
                    { value: "SUSPENDED", label: "موقوف" },
                    { value: "REJECTED", label: "مرفوض" },
                    { value: "CLOSED", label: "مغلق" },
                  ]}
                />
              </div>
              <Button type="submit">بحث</Button>
            </form>
          </div>
        </CardHeader><CardContent className="p-0">{query.isLoading ? <Loading /> : query.error ? <ErrorState error={query.error as ApiError} /> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>المعرض</TableHead><TableHead>الحالة</TableHead><TableHead>النوع</TableHead><TableHead>المخزون</TableHead><TableHead>الفريق</TableHead><TableHead>التقييم</TableHead><TableHead>الإنشاء</TableHead></TableRow></TableHeader><TableBody>{query.data?.data.map((dealer) => <TableRow key={dealer.publicId}><TableCell><Link href={`/dealers/${dealer.publicId}`} className="flex min-w-64 items-center gap-3"><span className="grid size-11 place-items-center overflow-hidden rounded-xl border bg-muted">{mediaUrl(dealer.logoUrl) ? <img src={mediaUrl(dealer.logoUrl) ?? undefined} alt="" className="size-full object-cover" /> : <Building2 className="size-5" />}</span><span><strong className="block">{dealerName(dealer)}</strong><span className="mt-1 block text-xs text-muted-foreground" dir="ltr">{dealer.email}</span></span></Link></TableCell><TableCell><Badge variant={dealer.status === "APPROVED" ? "default" : dealer.status === "SUSPENDED" ? "destructive" : "secondary"}>{dealer.status}</Badge></TableCell><TableCell>{dealer.storeType}</TableCell><TableCell>{dealer._count.listings.toLocaleString("ar-EG")}</TableCell><TableCell>{dealer._count.members.toLocaleString("ar-EG")}</TableCell><TableCell>{Number(dealer.ratingAverage).toFixed(1)} ({dealer.reviewCount})</TableCell><TableCell className="text-xs text-muted-foreground">{date(dealer.createdAt)}</TableCell></TableRow>)}</TableBody></Table></div>}</CardContent>{query.data && (history.length > 0 || query.data.hasMore) && <div className="flex justify-end gap-2 border-t p-4"><Button size="sm" variant="outline" onClick={() => setHistory((items) => { const next = [...items]; setCursor(next.pop() ?? null); return next; })} disabled={!history.length}><ChevronRight /> السابق</Button><Button size="sm" variant="outline" onClick={() => { if (query.data?.nextCursor) { setHistory((items) => [...items, cursor]); setCursor(query.data.nextCursor); } }} disabled={!query.data.hasMore}>التالي <ChevronLeft /></Button></div>}</Card>
    </div>
  );
}
