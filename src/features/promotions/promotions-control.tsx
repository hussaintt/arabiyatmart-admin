"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Car,
  ChevronLeft,
  ChevronRight,
  Coins,
  Crown,
  Flame,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminFetch, type ApiError } from "@/lib/api";
import { adminPaths } from "@/lib/api/paths";
import { mediaUrl } from "@/lib/media";
import { date, ErrorState, Header, Loading } from "@/features/people/users-list";

// --- Types ---

export type PromotionTier = "PREMIUM" | "EXTRA_PREMIUM";
export type PromotionType = "FEATURED" | "TOP_OF_SEARCH" | "HOMEPAGE";
export type PromotionStatus = "ACTIVE" | "EXPIRED" | "PENDING_PAYMENT" | "CANCELLED";

export type ListingPromotionItem = {
  id: number;
  publicId: string;
  status: PromotionStatus;
  tier: PromotionTier;
  type: PromotionType;
  durationDays: number;
  priceCents: number;
  currency: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  listing: {
    publicId: string;
    slug: string;
    year: number;
    status: string;
    make?: { nameI18n?: { ar?: string; en?: string } } | null;
    model?: { nameI18n?: { ar?: string; en?: string } } | null;
    images?: Array<{ file: { key: string } }>;
    user?: { publicId: string; email: string; firstName?: string | null; lastName?: string | null } | null;
  };
  vendor?: { publicId: string; displayName: string; slug: string } | null;
};

type CursorResponse<T> = {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

export function PromotionsControl({
  canWrite,
  canAdjust,
}: {
  canWrite: boolean;
  canAdjust: boolean;
}) {
  const client = useQueryClient();
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [tier, setTier] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<string | null>>([]);

  const [boostListing, setBoostListing] = useState<string | null>(null);
  const [isBoostOpen, setIsBoostOpen] = useState(false);
  const [isAdjustCreditsOpen, setIsAdjustCreditsOpen] = useState(false);

  const params = useMemo(() => {
    const p = new URLSearchParams({ limit: "25" });
    if (search) p.set("q", search);
    if (status !== "ALL") p.set("status", status);
    if (tier !== "ALL") p.set("tier", tier);
    if (type !== "ALL") p.set("type", type);
    if (cursor) p.set("cursor", cursor);
    return p.toString();
  }, [cursor, search, status, tier, type]);

  const query = useQuery({
    queryKey: ["admin-promotions", params],
    queryFn: () => adminFetch<CursorResponse<ListingPromotionItem>>(`${adminPaths.promotions}?${params}`),
  });

  const next = () => {
    if (!query.data?.nextCursor) return;
    setHistory((prev) => [...prev, cursor]);
    setCursor(query.data.nextCursor);
  };

  const previous = () => {
    setHistory((prev) => {
      const copy = [...prev];
      setCursor(copy.pop() ?? null);
      return copy;
    });
  };

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    setSearch(draft.trim());
    setCursor(null);
    setHistory([]);
  }

  const promotions = query.data?.data ?? [];
  const activeCount = promotions.filter((p) => p.status === "ACTIVE").length;
  const extraPremiumCount = promotions.filter((p) => p.tier === "EXTRA_PREMIUM" && p.status === "ACTIVE").length;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">إدارة التسويق</p>
          <h1 className="mt-1 text-2xl font-black md:text-3xl">ترويج الإعلانات (Boost)</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            مراقبة الإعلانات المميزة، منح ترقيات مجانية وتعويضية، وتعديل أرصدة التمييز للمعارض.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={query.isFetching ? "animate-spin" : ""} /> تحديث
          </Button>
          {canAdjust && (
            <Button variant="outline" onClick={() => setIsAdjustCreditsOpen(true)}>
              <Coins className="me-1 size-4" /> تعديل رصيد معرض
            </Button>
          )}
          {canWrite && (
            <Button
              onClick={() => {
                setBoostListing(null);
                setIsBoostOpen(true);
              }}
            >
              <Zap className="me-1 size-4" /> ترقية إعلان (Boost)
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard title="الإعلانات المميزة حالياً" value={activeCount} icon={Flame} variant="success" />
        <MetricCard title="باقات Extra Premium النشطة" value={extraPremiumCount} icon={Crown} variant="warning" />
        <MetricCard
          title="باقات Premium النشطة"
          value={activeCount - extraPremiumCount}
          icon={Sparkles}
        />
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle>سجل الإعلانات المروجة</CardTitle>
              <CardDescription>البحث بالمعرف أو رابط الإعلان والتصفية حسب نوع وموضع الترقية</CardDescription>
            </div>
            <form onSubmit={submitSearch} className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="ابحث بمعرف الإعلان أو الترويج…"
                  className="ps-9"
                />
              </div>
              <div className="w-36">
                <CustomSelect
                  value={tier}
                  onChange={(e) => {
                    setTier(e.target.value);
                    setCursor(null);
                    setHistory([]);
                  }}
                  options={[
                    { value: "ALL", label: "كل الباقات" },
                    { value: "PREMIUM", label: "Premium" },
                    { value: "EXTRA_PREMIUM", label: "Extra Premium" },
                  ]}
                />
              </div>
              <div className="w-36">
                <CustomSelect
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value);
                    setCursor(null);
                    setHistory([]);
                  }}
                  options={[
                    { value: "ALL", label: "كل المواضع" },
                    { value: "HOMEPAGE", label: "الرئيسية (Homepage)" },
                    { value: "TOP_OF_SEARCH", label: "أعلى البحث (Search)" },
                    { value: "FEATURED", label: "مميز (Featured)" },
                  ]}
                />
              </div>
              <div className="w-36">
                <CustomSelect
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setCursor(null);
                    setHistory([]);
                  }}
                  options={[
                    { value: "ALL", label: "كل الحالات" },
                    { value: "ACTIVE", label: "نشط حالياً" },
                    { value: "EXPIRED", label: "منتهي" },
                    { value: "PENDING_PAYMENT", label: "بانتظار الدفع" },
                    { value: "CANCELLED", label: "ملغي" },
                  ]}
                />
              </div>
              <Button type="submit">بحث</Button>
            </form>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {query.isLoading ? (
            <Loading />
          ) : query.error ? (
            <ErrorState error={query.error as ApiError} />
          ) : promotions.length === 0 ? (
            <div className="grid min-h-56 place-items-center text-center p-6">
              <div>
                <Zap className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-2 font-bold">لا توجد إعلانات مروجة مطابقة للبحث</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الإعلان</TableHead>
                    <TableHead>المالك / المعرض</TableHead>
                    <TableHead>مستوى الترقية</TableHead>
                    <TableHead>موضع الظهور</TableHead>
                    <TableHead>المدة</TableHead>
                    <TableHead>تاريخ البدء</TableHead>
                    <TableHead>تاريخ الانتهاء</TableHead>
                    <TableHead>الحالة</TableHead>
                    {canWrite && <TableHead className="text-end">الإجراءات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promotions.map((item) => {
                    const coverImg = item.listing?.images?.[0]?.file?.key
                      ? mediaUrl(item.listing.images[0].file.key)
                      : null;
                    const makeName = item.listing?.make?.nameI18n?.ar || item.listing?.make?.nameI18n?.en || "";
                    const modelName = item.listing?.model?.nameI18n?.ar || item.listing?.model?.nameI18n?.en || "";
                    const carTitle = [makeName, modelName, item.listing?.year].filter(Boolean).join(" ") || "إعلان سيارة";

                    return (
                      <TableRow key={item.publicId}>
                        <TableCell>
                          <Link
                            href={`/listings/${item.listing?.publicId}`}
                            className="flex items-center gap-3 hover:underline"
                          >
                            <div className="relative h-12 w-16 overflow-hidden rounded-lg border bg-muted">
                              {coverImg ? (
                                <img src={coverImg} alt="" className="size-full object-cover" />
                              ) : (
                                <div className="grid size-full place-items-center text-muted-foreground">
                                  <Car className="size-4" />
                                </div>
                              )}
                            </div>
                            <div>
                              <span className="font-bold block">{carTitle}</span>
                              <span className="text-xs text-muted-foreground font-mono" dir="ltr">
                                {item.listing?.publicId}
                              </span>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          {item.vendor ? (
                            <div>
                              <span className="font-bold block">{item.vendor.displayName}</span>
                              <Badge variant="outline" className="text-[0.65rem]">معرض سيارات</Badge>
                            </div>
                          ) : (
                            <div>
                              <span className="text-xs font-semibold block">
                                {[item.listing?.user?.firstName, item.listing?.user?.lastName].filter(Boolean).join(" ") || "مستخدم"}
                              </span>
                              <span className="text-[0.7rem] text-muted-foreground" dir="ltr">
                                {item.listing?.user?.email}
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.tier === "EXTRA_PREMIUM" ? (
                            <Badge className="bg-amber-500 hover:bg-amber-600 font-bold">
                              <Crown className="size-3 me-1" /> Extra Premium
                            </Badge>
                          ) : (
                            <Badge variant="default" className="font-semibold">
                              <Sparkles className="size-3 me-1" /> Premium
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs font-semibold">
                            {item.type === "HOMEPAGE"
                              ? "الصفحة الرئيسية"
                              : item.type === "TOP_OF_SEARCH"
                              ? "أعلى البحث"
                              : "مميز"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-bold">{item.durationDays} يوم</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{date(item.startsAt)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{date(item.endsAt)}</TableCell>
                        <TableCell>
                          <PromotionStatusBadge status={item.status} />
                        </TableCell>
                        {canWrite && (
                          <TableCell className="text-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setBoostListing(item.listing?.publicId);
                                setIsBoostOpen(true);
                              }}
                            >
                              <Zap className="size-3.5 me-1 text-primary" /> تمديد الترقية
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {query.data && (history.length > 0 || query.data.hasMore) && (
          <div className="flex justify-end gap-2 border-t p-4">
            <Button variant="outline" size="sm" onClick={previous} disabled={!history.length}>
              <ChevronRight /> السابق
            </Button>
            <Button variant="outline" size="sm" onClick={next} disabled={!query.data.hasMore}>
              التالي <ChevronLeft />
            </Button>
          </div>
        )}
      </Card>

      {/* Admin Boost Modal */}
      {isBoostOpen && (
        <AdminBoostModal
          initialListingPublicId={boostListing}
          onClose={() => {
            setIsBoostOpen(false);
            setBoostListing(null);
          }}
          onSuccess={async () => {
            setIsBoostOpen(false);
            setBoostListing(null);
            await client.invalidateQueries({ queryKey: ["admin-promotions"] });
          }}
        />
      )}

      {/* Admin Adjust Credits Modal */}
      {isAdjustCreditsOpen && (
        <AdjustCreditsModal
          onClose={() => setIsAdjustCreditsOpen(false)}
          onSuccess={async () => {
            setIsAdjustCreditsOpen(false);
            await client.invalidateQueries({ queryKey: ["admin-promotions"] });
          }}
        />
      )}
    </div>
  );
}

function PromotionStatusBadge({ status }: { status: PromotionStatus }) {
  switch (status) {
    case "ACTIVE":
      return <Badge className="bg-emerald-600 hover:bg-emerald-700">نشط</Badge>;
    case "EXPIRED":
      return <Badge variant="secondary">منتهي</Badge>;
    case "PENDING_PAYMENT":
      return <Badge variant="outline" className="border-amber-500 text-amber-600">بانتظار الدفع</Badge>;
    case "CANCELLED":
      return <Badge variant="destructive">ملغي</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export function AdminBoostModal({
  initialListingPublicId,
  onClose,
  onSuccess,
}: {
  initialListingPublicId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [listingId, setListingId] = useState(initialListingPublicId ?? "");
  const [tier, setTier] = useState<PromotionTier>("PREMIUM");
  const [placement, setPlacement] = useState<PromotionType>("TOP_OF_SEARCH");
  const [durationDays, setDurationDays] = useState("10");
  const [reason, setReason] = useState("");

  const handleTierChange = (newTier: PromotionTier) => {
    setTier(newTier);
    if (newTier === "EXTRA_PREMIUM") {
      setDurationDays("30");
      setPlacement("HOMEPAGE");
    } else {
      setDurationDays("10");
      setPlacement("TOP_OF_SEARCH");
    }
  };

  const mutation = useMutation({
    mutationFn: () =>
      adminFetch(adminPaths.promotionBoost, {
        method: "POST",
        body: JSON.stringify({
          listingPublicId: listingId.trim(),
          tier,
          placement,
          durationDays: Number(durationDays),
          reason: reason.trim(),
        }),
      }),
    onSuccess,
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ترقية الإعلان (Admin Boost)</DialogTitle>
          <DialogDescription>
            منح الإعلان ترقية فورية (مجانية أو تعويضية) ترفعه في نتائج البحث أو الصفحة الرئيسية.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>معرف الإعلان (Listing Public ID / Slug)</Label>
            <Input
              value={listingId}
              onChange={(e) => setListingId(e.target.value)}
              placeholder="مثال: cm7abcde123 أو رابط الإعلان"
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>مستوى الترقية (Tier)</Label>
              <CustomSelect
                value={tier}
                onChange={(e) => handleTierChange(e.target.value as PromotionTier)}
                options={[
                  { value: "PREMIUM", label: "Premium (10 أيام)" },
                  { value: "EXTRA_PREMIUM", label: "Extra Premium (30 يوم)" },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label>موضع الترويج (Placement)</Label>
              <CustomSelect
                value={placement}
                onChange={(e) => setPlacement(e.target.value as PromotionType)}
                options={[
                  { value: "TOP_OF_SEARCH", label: "أعلى نتائج البحث" },
                  { value: "HOMEPAGE", label: "الصفحة الرئيسية (Homepage)" },
                  { value: "FEATURED", label: "شريط المميز" },
                ]}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>عدد أيام الترقية</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>سبب الترقية (سجل التدقيق)</Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: تعويض عن عطل فني، أو ترقية ترويجية لمعرض شريك..."
              className="min-h-20 w-full rounded-xl border border-input bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {(mutation.error as ApiError | null) && (
            <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
              {(mutation.error as ApiError).message}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            إلغاء
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !listingId.trim() || reason.trim().length < 3}
          >
            {mutation.isPending ? "جارٍ الترقية…" : "تأكيد الترقية"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustCreditsModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [vendorId, setVendorId] = useState("");
  const [amount, setAmount] = useState("5");
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      adminFetch(adminPaths.vendorCreditAdjust(vendorId.trim()), {
        method: "POST",
        body: JSON.stringify({
          amount: Number(amount),
          reason: reason.trim(),
        }),
      }),
    onSuccess,
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>تعديل رصيد التمييز للمعرض</DialogTitle>
          <DialogDescription>
            إضافة أو خصم رصيد إعلانات مميزة (Featured Credits) في دفتر أستاذ المعرض.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>معرف المعرض (Vendor Public ID / ID)</Label>
            <Input
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              placeholder="مثال: vnd_abc123 أو معرف المعرض"
              dir="ltr"
            />
          </div>

          <div className="space-y-1.5">
            <Label>مقدار التعديل (موجب للإضافة، سالب للخصم)</Label>
            <Input
              type="number"
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="مثال: 5 أو -2"
              dir="ltr"
            />
            <p className="text-[0.7rem] text-muted-foreground">
              القيمة الموجبة (مثل 5) تمنح رصيداً إضافياً، والقيمة السالبة (مثل -2) تخصم من الرصيد الحالي.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>سبب التعديل (سجل التدقيق)</Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: مكافأة مبيعات ربع سنوية، أو تصحيح يدوي للرصيد..."
              className="min-h-20 w-full rounded-xl border border-input bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {(mutation.error as ApiError | null) && (
            <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
              {(mutation.error as ApiError).message}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            إلغاء
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !vendorId.trim() || !Number(amount) || reason.trim().length < 3}
          >
            {mutation.isPending ? "جارٍ التعديل…" : "حفظ التعديل"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  variant = "default",
}: {
  title: string;
  value: number;
  icon: typeof Zap;
  variant?: "default" | "warning" | "success";
}) {
  const bgClass =
    variant === "warning"
      ? "bg-amber-500/10 text-amber-600"
      : variant === "success"
      ? "bg-emerald-500/10 text-emerald-600"
      : "bg-muted text-muted-foreground";

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span className={`grid size-12 place-items-center rounded-xl ${bgClass}`}>
          <Icon className="size-6" />
        </span>
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-black">{value.toLocaleString("ar-EG")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
