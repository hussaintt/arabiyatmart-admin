"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Archive,
  Boxes,
  Car,
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  Clock3,
  Cloud,
  Database,
  FileClock,
  FileSearch,
  FileText,
  FileWarning,
  Filter,
  Gauge,
  Globe2,
  HardDrive,
  ImageOff,
  Inbox,
  Layers3,
  LockKeyhole,
  RefreshCw,
  Search,
  ServerCog,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { adminFetch, type ApiError } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import { AnimateInView, AnimatedItem, PageMotion } from "@/components/ui/animate-in-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomSelect } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Overview = {
  metrics: { listings: number; pendingReview: number; active: number; approvedVendors: number; openReports: number };
  listingStatuses: Record<string, number>;
  recentJobs: Job[];
  hatla2ee: Automation;
};

type Automation = {
  serverGateEnabled: boolean;
  authorizationValid: boolean;
  scheduleEnabled: boolean;
  canRun: boolean;
  reason: string | null;
};

type Job = {
  publicId: string;
  type: string;
  status: string;
  label?: string;
  fileName?: string;
  totalRows?: number | null;
  validRows?: number | null;
  errorRows?: number | null;
  currentProgress?: number | null;
  totalProgress?: number | null;
  errorCount?: number | null;
  createdAt: string;
  updatedAt?: string;
};

type Listing = {
  publicId: string;
  slug: string;
  status: string;
  year: number;
  priceCents: number;
  currency: string;
  makeName?: { ar?: string; en?: string } | string;
  modelName?: { ar?: string; en?: string } | string;
  cityName?: { ar?: string; en?: string } | string;
  make?: { name?: string | { ar?: string; en?: string } } | string;
  model?: { name?: string | { ar?: string; en?: string } } | string;
  city?: { name?: string | { ar?: string; en?: string } } | string;
  sellerType: string;
  coverImage?: string | null;
  coverImageUrl?: string | null;
  vendor?: { displayName?: string | { ar?: string; en?: string } } | null;
  contactPhone?: string | null;
  isDuplicate?: boolean;
};

type Source = {
  config: {
    authorizationReference: string | null;
    authorizationGrantedAt: string | null;
    authorizationExpiresAt: string | null;
    scheduleEnabled: boolean;
    pageLimit: number;
    delayMs: number;
    scheduleTime: string | null;
    updatedAt: string;
  } | null;
  automation: Automation;
};

const statusLabels: Record<string, string> = {
  ACTIVE: "نشط",
  ARCHIVED: "مؤرشف",
  CANCELLED: "ملغي",
  COMMITTED: "مكتمل",
  COMMITTING: "جارٍ الاعتماد",
  DRAFT: "مسودة",
  FAILED: "فشل",
  PENDING: "قيد الانتظار",
  PENDING_REVIEW: "بانتظار المراجعة",
  REJECTED: "مرفوض",
  VALIDATED: "تم التحقق",
  VALIDATING: "جارٍ التحقق",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar-EG").format(value);
}

function formatPrice(value: number, currency: string) {
  return `${formatNumber(Number(value) / 100)} ${currency}`;
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (["ACTIVE", "COMMITTED", "VALIDATED"].includes(status)) return "default";
  if (["FAILED", "REJECTED", "CANCELLED"].includes(status)) return "destructive";
  if (["PENDING", "PENDING_REVIEW", "VALIDATING", "COMMITTING"].includes(status)) return "secondary";
  return "outline";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={statusVariant(status)}>
      <CircleDot />
      {statusLabels[status] ?? status}
    </Badge>
  );
}

function modelText(value: unknown): string {
  if (!value) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.ar === "string" && obj.ar) return obj.ar;
    if (typeof obj.en === "string" && obj.en) return obj.en;
    if (typeof obj.name === "string" && obj.name) return obj.name;
    if (typeof obj.name === "object" && obj.name) return modelText(obj.name);
    if (typeof obj.displayName === "string" && obj.displayName) return obj.displayName;
    if (typeof obj.displayName === "object" && obj.displayName) return modelText(obj.displayName);
  }
  return String(value);
}

function QueryState({
  isLoading,
  error,
  onRetry,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
  children: ReactNode;
}) {
  const router = useRouter();
  const apiError = error as ApiError | null;

  useEffect(() => {
    if (apiError?.status === 401) router.replace("/login");
  }, [apiError?.status, router]);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="جارٍ تحميل البيانات">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="min-h-36">
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="size-10 rounded-xl" />
              </div>
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="admin-surface flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" />
        </span>
        <h2 className="mt-4 text-base font-bold">تعذّر تحميل البيانات</h2>
        <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
          {apiError?.message ?? "حدث خطأ غير معروف أثناء الاتصال بالخادم."}
        </p>
        {onRetry && (
          <Button className="mt-5" variant="outline" onClick={onRetry}>
            <RefreshCw /> إعادة المحاولة
          </Button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}

export function PageHeading({
  title,
  description,
  action,
  icon: Icon = Gauge,
  eyebrow = "Yalla Motors / Control Center",
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: LucideIcon;
  eyebrow?: string;
}) {
  return (
    <AnimateInView>
      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/75 px-5 py-5 shadow-sm backdrop-blur-sm md:px-7 md:py-6">
        <div className="admin-grid-pattern pointer-events-none absolute inset-0 opacity-35" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg md:size-14">
              <Icon className="size-5 md:size-6" />
            </span>
            <div className="min-w-0">
              <p className="eyebrow">{eyebrow}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-balance md:text-[2rem]">{title}</h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground md:text-[0.95rem]">{description}</p>
            </div>
          </div>
          {action && <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{action}</div>}
        </div>
      </div>
    </AnimateInView>
  );
}

function RefreshButton({ onClick, isRefreshing }: { onClick: () => void; isRefreshing?: boolean }) {
  return (
    <Button variant="outline" onClick={onClick} disabled={isRefreshing}>
      <RefreshCw className={cn(isRefreshing && "animate-spin")} />
      تحديث البيانات
    </Button>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  detail,
  tone = "text-primary bg-primary/10",
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  detail: string;
  tone?: string;
}) {
  return (
    <Card className="h-full hover:-translate-y-1 hover:border-foreground/15 hover:shadow-lg">
      <CardContent className="flex h-full flex-col justify-between gap-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            <p className="metric-value mt-3">{formatNumber(value)}</p>
          </div>
          <span className={cn("grid size-11 place-items-center rounded-2xl", tone)}>
            <Icon className="size-5" />
          </span>
        </div>
        <p className="flex items-center gap-1.5 border-t border-border/60 pt-3 text-[0.7rem] text-muted-foreground">
          <Activity className="size-3" /> {detail}
        </p>
      </CardContent>
    </Card>
  );
}

function SectionHeading({ title, description, icon: Icon }: { title: string; description: string; icon: LucideIcon }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
        <Icon className="size-4" />
      </span>
      <div>
        <h2 className="font-bold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function DashboardScreen() {
  const query = useQuery({
    queryKey: ["overview"],
    queryFn: () => adminFetch<Overview>("/v1/admin/control/overview"),
    refetchInterval: 30_000,
  });

  return (
    <PageMotion>
      <PageHeading
        title="لوحة التحكم"
        description="نظرة تشغيلية مباشرة على السوق، المراجعة، وجودة تدفق البيانات."
        icon={Gauge}
        action={<RefreshButton onClick={() => query.refetch()} isRefreshing={query.isFetching} />}
      />
      <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {query.data && (
          <>
            <AnimateInView stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <AnimatedItem><Metric label="إجمالي الإعلانات" value={query.data.metrics.listings} icon={Database} detail="كل المحتوى المسجل" /></AnimatedItem>
              <AnimatedItem><Metric label="بانتظار المراجعة" value={query.data.metrics.pendingReview} icon={Clock3} detail="تحتاج قرارًا إداريًا" tone="bg-amber-500/10 text-amber-700" /></AnimatedItem>
              <AnimatedItem><Metric label="إعلانات نشطة" value={query.data.metrics.active} icon={CheckCircle2} detail="ظاهرة في السوق الآن" tone="bg-emerald-500/10 text-emerald-700" /></AnimatedItem>
              <AnimatedItem><Metric label="تجّار معتمدون" value={query.data.metrics.approvedVendors} icon={ShieldCheck} detail="حسابات موثقة" /></AnimatedItem>
              <AnimatedItem><Metric label="بلاغات مفتوحة" value={query.data.metrics.openReports} icon={FileWarning} detail="تنتظر المعالجة" tone="bg-destructive/10 text-destructive" /></AnimatedItem>
            </AnimateInView>

            <AnimateInView stagger slow className="grid gap-4 xl:grid-cols-[1.45fr_0.8fr]">
              <AnimatedItem>
                <Card className="h-full">
                  <CardHeader className="border-b border-border/60 pb-4">
                    <SectionHeading title="آخر وظائف البيانات" description="تحديث تلقائي كل 30 ثانية مع حالة كل دفعة." icon={FileClock} />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {query.data.recentJobs.length ? (
                      query.data.recentJobs.slice(0, 5).map((job) => (
                        <Link key={job.publicId} href={`/jobs/${job.publicId}`} className="group flex items-center gap-3 rounded-xl border border-transparent p-3 transition-all hover:border-border hover:bg-muted/45">
                          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                            <Archive className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold">{job.fileName ?? job.label ?? job.type}</p>
                            <p className="mt-1 truncate text-[0.68rem] text-muted-foreground" dir="ltr">{job.publicId}</p>
                          </div>
                          <div className="hidden text-end sm:block">
                            <StatusBadge status={job.status} />
                            <p className="mt-1.5 text-[0.66rem] text-muted-foreground">{formatDate(job.createdAt)}</p>
                          </div>
                          <ChevronLeft className="size-4 text-muted-foreground/60 transition-transform group-hover:-translate-x-1" />
                        </Link>
                      ))
                    ) : (
                      <Empty icon={Inbox} title="لا توجد وظائف بيانات" text="ستظهر هنا عمليات الاستيراد والتحقق الجديدة." />
                    )}
                  </CardContent>
                </Card>
              </AnimatedItem>
              <AnimatedItem><AutomationSummary automation={query.data.hatla2ee} /></AnimatedItem>
            </AnimateInView>
          </>
        )}
      </QueryState>
    </PageMotion>
  );
}

function AutomationSummary({ automation }: { automation: Automation }) {
  const controls = [
    { label: "التفويض", enabled: automation.authorizationValid },
    { label: "بوابة الخادم", enabled: automation.serverGateEnabled },
    { label: "الجدولة", enabled: automation.scheduleEnabled },
  ];

  return (
    <Card className={cn("h-full", automation.canRun ? "border-emerald-500/30" : "border-amber-500/35")}>
      <CardHeader className="border-b border-border/60 pb-4">
        <SectionHeading title="تكامل هتلاقي" description="بوابات الأمان والتفويض الحالية." icon={Globe2} />
      </CardHeader>
      <CardContent className="flex h-full flex-col gap-5">
        <div className={cn("rounded-2xl p-4", automation.canRun ? "bg-emerald-500/10" : "bg-amber-500/10")}>
          <div className="flex items-start gap-3">
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", automation.canRun ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-700")}>
              {automation.canRun ? <CheckCircle2 className="size-5" /> : <LockKeyhole className="size-5" />}
            </span>
            <div>
              <p className="font-bold">{automation.canRun ? "التكامل متاح" : "التكامل مقفل بأمان"}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{automation.reason ?? "كل عمليات التشغيل مسجلة وقابلة للتدقيق."}</p>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {controls.map((control) => (
            <div key={control.label} className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2.5">
              <span className="text-xs font-semibold">{control.label}</span>
              <Badge variant={control.enabled ? "default" : "outline"}>{control.enabled ? "مفعّل" : "غير مفعّل"}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ListingsScreen() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const query = useQuery({
    queryKey: ["listings"],
    queryFn: () => adminFetch<{ data: Listing[]; meta: { hasMore: boolean } }>("/v1/admin/listings?limit=50"),
  });
  const listings = useMemo(() => query.data?.data ?? [], [query.data?.data]);
  const statusOptions = useMemo(() => Array.from(new Set(listings.map((item) => item.status))), [listings]);
  const filteredListings = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("ar");
    return listings.filter((listing) => {
      const haystack = [
        modelText(listing.makeName ?? listing.make),
        modelText(listing.modelName ?? listing.model),
        modelText(listing.cityName ?? listing.city),
        listing.publicId,
      ].join(" ").toLocaleLowerCase("ar");
      return (status === "ALL" || listing.status === status) && (!term || haystack.includes(term));
    });
  }, [listings, search, status]);

  return (
    <PageMotion>
      <PageHeading
        title="إدارة الإعلانات"
        description="راجع المحتوى، جودة الصور، حالة النشر، ومصدر كل إعلان من مساحة واحدة."
        icon={Car}
        action={<RefreshButton onClick={() => query.refetch()} isRefreshing={query.isFetching} />}
      />
      <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {query.data && (
          <AnimateInView className="data-table-shell">
            <div className="flex flex-col gap-4 border-b border-border/60 p-4 md:flex-row md:items-center md:justify-between md:p-5">
              <div>
                <p className="text-sm font-bold">قائمة الإعلانات</p>
                <p className="mt-1 text-xs text-muted-foreground">عرض {formatNumber(filteredListings.length)} من {formatNumber(listings.length)} إعلانًا</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 sm:w-72">
                  <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث بالسيارة، المدينة، أو المعرّف" className="ps-10" />
                </div>
                <div className="relative sm:w-52">
                  <Filter className="pointer-events-none absolute start-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                  <CustomSelect
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className="ps-10"
                    options={[
                      { value: "ALL", label: "كل الحالات" },
                      ...statusOptions.map((option) => ({ value: option, label: statusLabels[option] ?? option })),
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الإعلان</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>السعر</TableHead>
                    <TableHead>البائع</TableHead>
                    <TableHead>جودة الوسائط</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredListings.map((listing) => {
                    const image = mediaUrl(listing.coverImageUrl || listing.coverImage);
                    return (
                      <TableRow key={listing.publicId}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted text-muted-foreground">
                              {image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={image} alt="" className="size-full object-cover transition-transform duration-300 hover:scale-105" />
                              ) : <Car className="size-5" />}
                            </span>
                            <div className="min-w-0">
                              <p className="font-bold">{modelText(listing.makeName ?? listing.make)} {modelText(listing.modelName ?? listing.model)} <span className="text-muted-foreground">· {listing.year}</span></p>
                              <p className="mt-1 text-[0.68rem] text-muted-foreground">{modelText(listing.cityName ?? listing.city)} <span dir="ltr">· {listing.publicId}</span></p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><StatusBadge status={listing.status} /></TableCell>
                        <TableCell className="font-bold tabular-nums">{formatPrice(listing.priceCents, listing.currency)}</TableCell>
                        <TableCell>{listing.vendor?.displayName ? modelText(listing.vendor.displayName) : listing.sellerType}</TableCell>
                        <TableCell>
                          {image ? <Badge variant="outline"><CheckCircle2 /> صورة موثّقة</Badge> : <Badge variant="destructive"><ImageOff /> بلا صورة</Badge>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-3 p-3 lg:hidden">
              {filteredListings.map((listing) => (
                <article key={listing.publicId} className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-bold">{modelText(listing.makeName ?? listing.make)} {modelText(listing.modelName ?? listing.model)} · {listing.year}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">{modelText(listing.cityName ?? listing.city)}</p>
                    </div>
                    <StatusBadge status={listing.status} />
                  </div>
                  <div className="mt-4 flex items-end justify-between border-t border-border/60 pt-3">
                    <div><p className="text-[0.65rem] text-muted-foreground">السعر</p><p className="mt-1 font-bold tabular-nums">{formatPrice(listing.priceCents, listing.currency)}</p></div>
                    {mediaUrl(listing.coverImageUrl || listing.coverImage) ? <Badge variant="outline"><CheckCircle2 /> صورة جاهزة</Badge> : <Badge variant="destructive"><ImageOff /> ناقصة</Badge>}
                  </div>
                </article>
              ))}
            </div>
            {!filteredListings.length && <Empty icon={FileSearch} title="لا توجد نتائج مطابقة" text="غيّر عبارة البحث أو أعد اختيار حالة الإعلان." />}
            {query.data.meta.hasMore && <p className="border-t border-border/60 px-5 py-3 text-center text-xs text-muted-foreground">توجد نتائج إضافية على الخادم. استخدم عوامل التصفية للوصول إليها.</p>}
          </AnimateInView>
        )}
      </QueryState>
    </PageMotion>
  );
}

export function JobsScreen() {
  const query = useQuery({
    queryKey: ["jobs"],
    queryFn: () => adminFetch<{ items: Job[]; total: number }>("/v1/admin/listing-imports/jobs?limit=50"),
    refetchInterval: 15_000,
  });

  return (
    <PageMotion>
      <PageHeading title="سجل الوظائف" description="تابع دفعات الاستيراد والتحقق والنتائج الفعلية مع تحديث دوري." icon={Activity} action={<RefreshButton onClick={() => query.refetch()} isRefreshing={query.isFetching} />} />
      <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {query.data && (
          <>
            <AnimateInView stagger className="grid gap-4 sm:grid-cols-3">
              <AnimatedItem><Metric label="إجمالي الوظائف" value={query.data.total} icon={Boxes} detail="كل الدفعات المسجلة" /></AnimatedItem>
              <AnimatedItem><Metric label="مكتملة" value={query.data.items.filter((job) => ["COMMITTED", "VALIDATED"].includes(job.status)).length} icon={CheckCircle2} detail="ضمن الصفحة الحالية" tone="bg-emerald-500/10 text-emerald-700" /></AnimatedItem>
              <AnimatedItem><Metric label="تحتاج انتباهًا" value={query.data.items.filter((job) => ["FAILED", "CANCELLED"].includes(job.status)).length} icon={AlertTriangle} detail="فشل أو إلغاء" tone="bg-destructive/10 text-destructive" /></AnimatedItem>
            </AnimateInView>
            <AnimateInView className="data-table-shell">
              <div className="border-b border-border/60 p-5"><SectionHeading title="دفعات المعالجة" description="لا تبدأ الواجهة أي تنفيذ تلقائيًا؛ كل عملية لها سجل مستقل." icon={Layers3} /></div>
              <Table>
                <TableHeader><TableRow><TableHead>الدفعة</TableHead><TableHead>الحالة</TableHead><TableHead>الصفوف</TableHead><TableHead>الأخطاء</TableHead><TableHead>وقت الإنشاء</TableHead></TableRow></TableHeader>
                <TableBody>
                  {query.data.items.map((job) => (
                    <TableRow key={job.publicId} className="hover:bg-muted/50">
                      <TableCell>
                        <Link href={`/jobs/${job.publicId}`} className="block group">
                          <p className="font-bold group-hover:underline">{job.label ?? job.fileName ?? job.type}</p>
                          <p className="mt-1 text-[0.68rem] text-muted-foreground" dir="ltr">{job.publicId}</p>
                        </Link>
                      </TableCell>
                      <TableCell><StatusBadge status={job.status} /></TableCell>
                      <TableCell className="tabular-nums">{formatNumber(job.validRows ?? 0)} / {job.totalRows == null ? "—" : formatNumber(job.totalRows)}</TableCell>
                      <TableCell className={cn("tabular-nums", (job.errorRows ?? job.errorCount ?? 0) > 0 && "font-bold text-destructive")}>{formatNumber(job.errorRows ?? job.errorCount ?? 0)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(job.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!query.data.items.length && <Empty icon={Inbox} title="لا توجد وظائف بعد" text="ستظهر هنا أول دفعة عند بدء عملية استيراد أو تحقق." />}
            </AnimateInView>
          </>
        )}
      </QueryState>
    </PageMotion>
  );
}

export function ImportsScreen() {
  const query = useQuery({
    queryKey: ["datasets"],
    queryFn: () => adminFetch<{ data: Array<{ publicId: string; origin: string; csvFilename: string | null; archiveFilename: string | null; status: string; createdAt: string }> }>("/v1/admin/control/datasets"),
  });

  return (
    <PageMotion>
      <PageHeading title="مركز البيانات والاستيراد" description="راجع الحزم المرفوعة وحالة معالجتها قبل وصول أي محتوى إلى السوق." icon={UploadCloud} action={<RefreshButton onClick={() => query.refetch()} isRefreshing={query.isFetching} />} />
      <AnimateInView>
        <div className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md"><ShieldCheck className="size-5" /></span>
          <div className="flex-1"><h2 className="font-bold">قاعدة النشر الآمن</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">لا يُنشر أي إعلان مستورد دون صورة حقيقية جاهزة. تمر كل حزمة بالتحقق والمراجعة قبل الوصول للسوق.</p></div>
          <Badge variant="outline" className="self-start sm:self-auto"><LockKeyhole /> سياسة إلزامية</Badge>
        </div>
      </AnimateInView>
      <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {query.data && (
          <AnimateInView className="data-table-shell">
            <div className="flex items-center justify-between border-b border-border/60 p-5">
              <SectionHeading title="حزم البيانات" description={`${formatNumber(query.data.data.length)} حزمة محفوظة في التخزين المخصص للاستيعاب.`} icon={HardDrive} />
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>المصدر</TableHead><TableHead>الملفات</TableHead><TableHead>الحالة</TableHead><TableHead>التاريخ</TableHead></TableRow></TableHeader>
              <TableBody>
                {query.data.data.map((item) => (
                  <TableRow key={item.publicId}>
                    <TableCell><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-muted"><Cloud className="size-3.5" /></span><span className="font-bold">{item.origin}</span></div></TableCell>
                    <TableCell><p className="max-w-md truncate font-medium" dir="ltr">{item.csvFilename ?? item.archiveFilename ?? "—"}</p><p className="mt-1 text-[0.68rem] text-muted-foreground" dir="ltr">{item.publicId}</p></TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(item.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!query.data.data.length && <Empty icon={UploadCloud} title="لا توجد حزم مرفوعة" text="ستظهر هنا ملفات CSV وأرشيفات الصور عند إضافتها." />}
          </AnimateInView>
        )}
      </QueryState>
    </PageMotion>
  );
}

export function ScraperScreen() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["hatla2ee"], queryFn: () => adminFetch<Source>("/v1/admin/control/hatla2ee") });
  const [reference, setReference] = useState("");
  const [grantedAt, setGrantedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const config = query.data?.config;
  const savedReference = reference || config?.authorizationReference || "";

  async function saveAuthorization() {
    setNotice(null);
    try {
      await adminFetch("/v1/admin/control/hatla2ee", {
        method: "PUT",
        body: JSON.stringify({
          authorizationReference: savedReference,
          authorizationGrantedAt: grantedAt || config?.authorizationGrantedAt,
          authorizationExpiresAt: expiresAt || config?.authorizationExpiresAt || null,
          scheduleEnabled: false,
        }),
      });
      setNotice("تم حفظ سجل التفويض. يظل التشغيل مقفلاً حتى تفعيل بوابة الخادم بعد التحقق.");
      await client.invalidateQueries({ queryKey: ["hatla2ee"] });
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  return (
    <PageMotion>
      <PageHeading title="تكامل هتلاقي" description="إدارة التفويض وضوابط المصدر الخارجي ضمن بوابات أمان قابلة للتدقيق." icon={Globe2} />
      <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {query.data && (
          <>
            <AnimateInView><div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-5"><div className="flex gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-500/15 text-amber-800"><LockKeyhole className="size-5" /></span><div><h2 className="font-bold">التشغيل الآلي معطّل</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{query.data.automation.reason ?? "لا يمكن بدء الاستكشاف أو الجلب أو الصور من هنا."}</p></div></div></div></AnimateInView>
            <AnimateInView stagger className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
              <AnimatedItem><Card><CardHeader><CardTitle>سجل التفويض الكتابي</CardTitle><CardDescription>سجّل مرجع وتواريخ الحق القانوني. الحفظ لا يؤدي إلى تشغيل التكامل.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label htmlFor="reference">مرجع التفويض</Label><Input id="reference" value={savedReference} onChange={(event) => setReference(event.target.value)} placeholder="رقم العقد أو رسالة الموافقة" /></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="granted">تاريخ المنح</Label><Input id="granted" type="date" value={grantedAt || config?.authorizationGrantedAt?.slice(0, 10) || ""} onChange={(event) => setGrantedAt(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="expires">تاريخ الانتهاء (اختياري)</Label><Input id="expires" type="date" value={expiresAt || config?.authorizationExpiresAt?.slice(0, 10) || ""} onChange={(event) => setExpiresAt(event.target.value)} /></div></div><Button onClick={saveAuthorization}><ShieldCheck /> حفظ السجل</Button>{notice && <p className="rounded-xl border border-border/60 bg-muted/60 p-3 text-sm">{notice}</p>}</CardContent></Card></AnimatedItem>
              <AnimatedItem><Card className="h-full"><CardHeader><CardTitle>ضوابط التنفيذ</CardTitle><CardDescription>يجب اجتياز جميع الضوابط قبل أي تشغيل.</CardDescription></CardHeader><CardContent className="space-y-3"><Rule good={query.data.automation.authorizationValid} text="تفويض كتابي ساري" /><Rule good={query.data.automation.serverGateEnabled} text="بوابة الخادم مفعّلة" /><Rule good={query.data.automation.scheduleEnabled} text="الجدولة اليومية مفعّلة" /><p className="border-t border-border/60 pt-4 text-xs leading-6 text-muted-foreground">السياسة المبدئية: صفحة واحدة يوميًا بعد التفويض، تأخير ثابت، عامل واحد، وحد 100 صفحة.</p></CardContent></Card></AnimatedItem>
            </AnimateInView>
          </>
        )}
      </QueryState>
    </PageMotion>
  );
}

function Rule({ good, text }: { good: boolean; text: string }) {
  return <div className="flex items-center justify-between rounded-xl border border-border/60 p-3"><span className="text-sm font-semibold">{text}</span><Badge variant={good ? "default" : "outline"}>{good ? <CheckCircle2 /> : <LockKeyhole />}{good ? "مستوفى" : "غير مستوفى"}</Badge></div>;
}

export function AuditScreen() {
  const query = useQuery({
    queryKey: ["audit"],
    queryFn: () => adminFetch<{ data: Array<{ publicId: string; action: string; targetType: string; actor: { email: string; name: string } | null; createdAt: string }> }>("/v1/admin/control/audit"),
  });

  return (
    <PageMotion>
      <PageHeading title="سجل التدقيق" description="سجل زمني غير قابل للتعديل لكل عملية حساسة داخل لوحة التحكم." icon={FileText} action={<RefreshButton onClick={() => query.refetch()} isRefreshing={query.isFetching} />} />
      <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {query.data && (
          <AnimateInView className="data-table-shell">
            <div className="border-b border-border/60 p-5"><SectionHeading title="الأحداث المسجلة" description={`${formatNumber(query.data.data.length)} حدثًا في العرض الحالي.`} icon={FileSearch} /></div>
            <Table>
              <TableHeader><TableRow><TableHead>العملية</TableHead><TableHead>الهدف</TableHead><TableHead>المنفذ</TableHead><TableHead>الوقت</TableHead></TableRow></TableHeader>
              <TableBody>{query.data.data.map((log) => <TableRow key={log.publicId}><TableCell><div className="flex items-center gap-2"><span className="size-2 rounded-full bg-foreground" /><span className="font-bold">{log.action}</span></div></TableCell><TableCell><Badge variant="outline">{log.targetType}</Badge></TableCell><TableCell>{log.actor?.name || log.actor?.email || "النظام"}</TableCell><TableCell className="text-muted-foreground">{formatDate(log.createdAt)}</TableCell></TableRow>)}</TableBody>
            </Table>
            {!query.data.data.length && <Empty icon={FileText} title="لا توجد عمليات مسجلة" text="سيظهر هنا أثر كل تغيير إداري حساس." />}
          </AnimateInView>
        )}
      </QueryState>
    </PageMotion>
  );
}

const settings = [
  { title: "التخزين والوسائط", text: "الوسائط العامة وحزم الاستيعاب مفصولان في إعدادات الخادم، ولا تُعرض مفاتيح الوصول في المتصفح.", icon: HardDrive, label: "معزول" },
  { title: "الأمان والجلسات", text: "جلسة الإدارة محمية عبر Cookies من نوع HttpOnly، مع فحص CSRF لجميع عمليات التغيير.", icon: ShieldCheck, label: "محمي" },
  { title: "النشر والوصول", text: "مسارات الإدارة لا تُعرض دون جلسة مدير صالحة، بينما تبقى رحلة الزائر في السوق مستقلة.", icon: ServerCog, label: "مقيّد" },
  { title: "جودة البيانات", text: "الصور الحقيقية شرط للنشر؛ الإعلانات الناقصة تبقى للمراجعة ولا تصل إلى السوق.", icon: Sparkles, label: "إلزامي" },
];

export function SettingsScreen() {
  return (
    <PageMotion>
      <PageHeading title="إعدادات المنصة" description="مرجع واضح لحالة الإعدادات الإنتاجية والمفاتيح الوقائية دون كشف أي أسرار." icon={ServerCog} />
      <AnimateInView stagger slow className="grid gap-4 md:grid-cols-2">
        {settings.map((setting) => <AnimatedItem key={setting.title}><Setting {...setting} /></AnimatedItem>)}
      </AnimateInView>
      <AnimateInView>
        <div className="admin-surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
          <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted"><AlertTriangle className="size-4" /></span><div><h2 className="font-bold">الإعدادات الحساسة مُدارة من الخادم</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">المفاتيح، بيانات الاتصال، وسياسات التخزين لا يمكن تعديلها من المتصفح.</p></div></div>
          <Badge variant="outline"><LockKeyhole /> قراءة فقط</Badge>
        </div>
      </AnimateInView>
    </PageMotion>
  );
}

function Setting({ title, text, icon: Icon, label }: { title: string; text: string; icon: LucideIcon; label: string }) {
  return (
    <Card className="h-full hover:-translate-y-1 hover:border-foreground/15 hover:shadow-lg">
      <CardContent className="flex h-full flex-col gap-5">
        <div className="flex items-center justify-between"><span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-5" /></span><Badge variant="outline">{label}</Badge></div>
        <div><h2 className="text-base font-bold">{title}</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">{text}</p></div>
      </CardContent>
    </Card>
  );
}

function Empty({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"><Icon className="size-5" /></span>
      <p className="mt-3 text-sm font-bold">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}
