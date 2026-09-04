"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowDownUp, Car, ChevronLeft, ChevronRight, RefreshCw, Search, ShieldCheck, Trash2 } from "lucide-react";
import { ActionDialog } from "@/components/admin/action-dialog";
import { RemoveAllListingsDialog } from "@/components/admin/remove-all-listings-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomSelect } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminFetch, type ApiError } from "@/lib/api";
import { adminPaths } from "@/lib/api/paths";
import { queryKeys } from "@/lib/api/query-keys";
import type { AdminCapability } from "@/lib/auth/permissions";
import { mediaUrl } from "@/lib/media";
import { AdminListingRow, formatPrice, listingStatusLabels, localized } from "./types";

type ListResponse = {
  data: AdminListingRow[];
  meta: { page: number; limit: number; total: number; totalPages: number; hasMore: boolean };
};

type BulkAction = "approve" | "reject" | "archive" | "delete";
type SortOption = "created-desc" | "created-asc" | "updated-desc" | "price-asc" | "price-desc" | "views-desc" | "leads-desc";

const sortOptions: Record<SortOption, { label: string; sort: "createdAt" | "updatedAt" | "priceCents" | "viewsCount" | "leadsCount"; direction: "asc" | "desc" }> = {
  "created-desc": { label: "الأحدث إضافة", sort: "createdAt", direction: "desc" },
  "created-asc": { label: "الأقدم إضافة", sort: "createdAt", direction: "asc" },
  "updated-desc": { label: "آخر تحديث", sort: "updatedAt", direction: "desc" },
  "price-asc": { label: "السعر: الأقل أولاً", sort: "priceCents", direction: "asc" },
  "price-desc": { label: "السعر: الأعلى أولاً", sort: "priceCents", direction: "desc" },
  "views-desc": { label: "الأكثر مشاهدة", sort: "viewsCount", direction: "desc" },
  "leads-desc": { label: "الأكثر طلبًا", sort: "leadsCount", direction: "desc" },
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ACTIVE") return "default";
  if (["REJECTED", "REMOVED"].includes(status)) return "destructive";
  if (status === "PENDING_REVIEW") return "secondary";
  return "outline";
}

const actionCopy: Record<BulkAction, { title: string; description: string; confirm: string; reason: boolean; destructive?: boolean }> = {
  approve: { title: "اعتماد الإعلانات", description: "سيتم نشر الإعلانات المحددة إذا كانت حالتها تسمح بذلك.", confirm: "اعتماد", reason: false },
  reject: { title: "رفض الإعلانات", description: "اكتب سببًا واضحًا ليصل قرار المراجعة إلى أصحاب الإعلانات.", confirm: "رفض", reason: true, destructive: true },
  archive: { title: "أرشفة الإعلانات", description: "ستخرج الإعلانات المحددة من السوق مع الاحتفاظ بسجلها.", confirm: "أرشفة", reason: false },
  delete: { title: "حذف الإعلانات منطقيًا", description: "لن تُحذف السجلات نهائيًا، ويمكن استعادتها لاحقًا إلى طابور المراجعة.", confirm: "حذف منطقي", reason: true, destructive: true },
};

export function ListingsList({ capabilities }: { capabilities: AdminCapability[] | string[] }) {
  const queryClient = useQueryClient();
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [source, setSource] = useState("ALL");
  const [deleted, setDeleted] = useState("exclude");
  const [sortOption, setSortOption] = useState<SortOption>("created-desc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<BulkAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [removeAllOpen, setRemoveAllOpen] = useState(false);
  const [removeAllError, setRemoveAllError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(searchDraft.trim()); setPage(1); setSelected(new Set()); }, 350);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  const params = useMemo(() => {
    const currentSort = sortOptions[sortOption];
    const value = new URLSearchParams({ page: String(page), limit: "25", deleted, sort: currentSort.sort, direction: currentSort.direction });
    if (search) value.set("q", search);
    if (status !== "ALL") value.set("status", status);
    if (source !== "ALL") value.set("source", source);
    return value.toString();
  }, [deleted, page, search, source, sortOption, status]);

  const query = useQuery({
    queryKey: queryKeys.listings(params),
    queryFn: () => adminFetch<ListResponse>(`${adminPaths.listings}?${params}`),
  });

  const mutation = useMutation({
    mutationFn: ({ activeAction, reason }: { activeAction: BulkAction; reason: string }) =>
      adminFetch<{ meta: { requested: number; succeeded: number; failed: number } }>(adminPaths.listingBulk, {
        method: "POST",
        body: JSON.stringify({ publicIds: [...selected], action: activeAction, ...(reason ? { reason } : {}) }),
      }),
    onSuccess: async (result) => {
      if (result.meta.failed > 0) setActionError(`نجح ${result.meta.succeeded} وفشل ${result.meta.failed}. راجع حالات الإعلانات وحاول مجددًا.`);
      else { setAction(null); setActionError(null); setSelected(new Set()); }
      await queryClient.invalidateQueries({ queryKey: ["admin-listings"] });
    },
    onError: (error: ApiError) => setActionError(error.message),
  });

  const removeAllMutation = useMutation({
    mutationFn: ({
      scope,
      mode,
      reason,
    }: {
      scope: "all" | "filtered";
      mode: "soft" | "permanent";
      reason: string;
    }) =>
      adminFetch<{ data: { count: number; mode: string; scope: string } }>(
        adminPaths.listingRemoveAll,
        {
          method: "POST",
          body: JSON.stringify({
            scope,
            mode,
            reason,
            filters: scope === "filtered" ? {
              q: search || undefined,
              status: status !== "ALL" ? status : undefined,
              source: source !== "ALL" ? source : undefined,
              deleted: deleted as "exclude" | "only" | "include",
            } : undefined,
          }),
        },
      ),
    onSuccess: async () => {
      setRemoveAllOpen(false);
      setRemoveAllError(null);
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ["admin-listings"] });
    },
    onError: (error: ApiError) => setRemoveAllError(error.message),
  });

  const hasActiveFilters = Boolean(search || status !== "ALL" || source !== "ALL" || deleted !== "exclude");


  const rows = query.data?.data ?? [];
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.publicId));
  const canBulk = capabilities.includes("listings:bulk");
  const copy = action ? actionCopy[action] : null;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.publicId)));
  }

  function toggle(publicId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(publicId)) next.delete(publicId); else next.add(publicId);
      return next;
    });
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">المحتوى والسوق</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">إدارة الإعلانات</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">بحث وتصفية على الخادم، مراجعة جماعية، وحذف منطقي قابل للاستعادة مع سجل تدقيق كامل.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canBulk && (
            <Button
              variant="destructive"
              onClick={() => setRemoveAllOpen(true)}
              disabled={query.isFetching || (query.data?.meta.total === 0)}
            >
              <Trash2 className="size-4" /> حذف كل الإعلانات
            </Button>
          )}
          <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={query.isFetching ? "animate-spin" : ""} /> تحديث
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b border-border/60">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle>كل الإعلانات</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{query.data ? `${query.data.meta.total.toLocaleString("ar-EG")} سجل` : "جارٍ حساب النتائج…"}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap xl:justify-end">
              <div className="relative sm:col-span-2 xl:w-72">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="المعرّف، VIN، الهاتف أو البريد" className="ps-9" />
              </div>
              <div className="w-36">
                <CustomSelect
                  value={status}
                  onChange={(event) => { setStatus(event.target.value); setPage(1); setSelected(new Set()); }}
                  options={[
                    { value: "ALL", label: "كل الحالات" },
                    ...Object.entries(listingStatusLabels).map(([value, label]) => ({ value, label })),
                  ]}
                />
              </div>
              <div className="w-36">
                <CustomSelect
                  value={source}
                  onChange={(event) => { setSource(event.target.value); setPage(1); setSelected(new Set()); }}
                  options={[
                    { value: "ALL", label: "كل المصادر" },
                    { value: "APP", label: "التطبيق" },
                    { value: "ADMIN", label: "الإدارة" },
                    { value: "IMPORT", label: "استيراد" },
                    { value: "SCRAPER", label: "مصدر خارجي" },
                  ]}
                />
              </div>
              <div className="w-36">
                <CustomSelect
                  value={deleted}
                  onChange={(event) => { setDeleted(event.target.value); setPage(1); setSelected(new Set()); }}
                  options={[
                    { value: "exclude", label: "الحالية فقط" },
                    { value: "only", label: "المحذوفة فقط" },
                    { value: "include", label: "الكل" },
                  ]}
                />
              </div>
              <div className="relative w-44">
                <ArrowDownUp className="pointer-events-none absolute start-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                <CustomSelect
                  aria-label="ترتيب الإعلانات"
                  value={sortOption}
                  onChange={(event) => { setSortOption(event.target.value as SortOption); setPage(1); setSelected(new Set()); }}
                  className="ps-9"
                  options={Object.entries(sortOptions).map(([value, option]) => ({ value, label: option.label }))}
                />
              </div>
            </div>
          </div>
        </CardHeader>

        {canBulk && selected.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="me-2 text-xs font-bold">تم تحديد {selected.size.toLocaleString("ar-EG")}</span>
              <Button size="sm" onClick={() => setAction("approve")}><ShieldCheck /> اعتماد</Button>
              <Button size="sm" variant="outline" onClick={() => setAction("reject")}>رفض</Button>
              <Button size="sm" variant="outline" onClick={() => setAction("archive")}><Archive /> أرشفة</Button>
              <Button size="sm" variant="destructive" onClick={() => setAction("delete")}><Trash2 /> حذف منطقي</Button>
            </div>
            {query.data && query.data.meta.total > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setRemoveAllOpen(true)}
              >
                <Trash2 className="size-3.5" /> حذف كافة الإعلانات ({query.data.meta.total.toLocaleString("ar-EG")})…
              </Button>
            )}
          </div>
        )}

        <CardContent className="p-0">
          {query.isLoading ? (
            <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">جارٍ تحميل الإعلانات…</div>
          ) : query.error ? (
            <div className="grid min-h-64 place-items-center p-6 text-center"><div><p className="font-bold text-destructive">تعذّر تحميل الإعلانات</p><p className="mt-2 text-sm text-muted-foreground">{(query.error as ApiError).message}</p></div></div>
          ) : rows.length === 0 ? (
            <div className="grid min-h-64 place-items-center text-center"><div><Car className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-bold">لا توجد نتائج مطابقة</p></div></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  {canBulk && <TableHead className="w-10"><input aria-label="تحديد الصفحة" type="checkbox" checked={allSelected} onChange={toggleAll} className="size-4 accent-foreground" /></TableHead>}
                  <TableHead>الإعلان</TableHead><TableHead>الحالة</TableHead><TableHead>السعر</TableHead><TableHead>البائع / المصدر</TableHead><TableHead>الأداء</TableHead><TableHead>آخر تحديث</TableHead>
                </TableRow></TableHeader>
                <TableBody>{rows.map((listing) => (
                  <TableRow key={listing.publicId} className={listing.deletedAt ? "opacity-65" : ""}>
                    {canBulk && <TableCell><input aria-label={`تحديد ${listing.publicId}`} type="checkbox" checked={selected.has(listing.publicId)} onChange={() => toggle(listing.publicId)} className="size-4 accent-foreground" /></TableCell>}
                    <TableCell>
                      <Link href={`/listings/${listing.publicId}`} className="flex min-w-64 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted">
                          {mediaUrl(listing.coverImageUrl) ? <img src={mediaUrl(listing.coverImageUrl) ?? undefined} alt="" className="size-full object-cover" /> : <Car className="size-5 text-muted-foreground" />}
                        </span>
                        <span><span className="block font-bold">{localized(listing.makeName)} {localized(listing.modelName)} · {listing.year}</span><span className="mt-1 block text-[0.68rem] text-muted-foreground" dir="ltr">{listing.publicId}</span></span>
                      </Link>
                    </TableCell>
                    <TableCell><Badge variant={statusVariant(listing.status)}>{listingStatusLabels[listing.status] ?? listing.status}</Badge>{listing.deletedAt && <Badge variant="destructive" className="ms-1">محذوف</Badge>}</TableCell>
                    <TableCell className="font-bold tabular-nums">{formatPrice(listing.priceCents, listing.currency)}</TableCell>
                    <TableCell><p className="font-semibold">{listing.vendor ? localized(listing.vendor.displayName) : [listing.user?.firstName, listing.user?.lastName].filter(Boolean).join(" ") || listing.sellerType}</p><p className="mt-1 text-[0.68rem] text-muted-foreground">{listing.source}</p></TableCell>
                    <TableCell className="text-xs tabular-nums"><p>{listing.viewsCount.toLocaleString("ar-EG")} مشاهدة</p><p className="mt-1 text-muted-foreground">{listing.leadsCount.toLocaleString("ar-EG")} طلب</p></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(listing.updatedAt))}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {query.data && query.data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border/60 px-5 py-4">
            <p className="text-xs text-muted-foreground">صفحة {query.data.meta.page.toLocaleString("ar-EG")} من {query.data.meta.totalPages.toLocaleString("ar-EG")}</p>
            <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setPage((value) => Math.max(1, value - 1)); setSelected(new Set()); }} disabled={page <= 1}><ChevronRight /> السابق</Button><Button size="sm" variant="outline" onClick={() => { setPage((value) => value + 1); setSelected(new Set()); }} disabled={page >= query.data.meta.totalPages}>التالي <ChevronLeft /></Button></div>
          </div>
        )}
      </Card>

      {copy && <ActionDialog open={Boolean(action)} onOpenChange={(open) => { if (!open) { setAction(null); setActionError(null); } }} title={copy.title} description={copy.description} confirmLabel={copy.confirm} requireReason={copy.reason} destructive={copy.destructive} pending={mutation.isPending} error={actionError} onConfirm={(reason) => { if (action) mutation.mutate({ activeAction: action, reason }); }} />}

      <RemoveAllListingsDialog
        open={removeAllOpen}
        onOpenChange={(open) => {
          setRemoveAllOpen(open);
          if (!open) setRemoveAllError(null);
        }}
        totalCount={query.data?.meta.total ?? 0}
        filteredCount={query.data?.meta.total}
        hasActiveFilters={hasActiveFilters}
        pending={removeAllMutation.isPending}
        error={removeAllError}
        onConfirm={(payload) => removeAllMutation.mutate(payload)}
      />
    </div>
  );
}
