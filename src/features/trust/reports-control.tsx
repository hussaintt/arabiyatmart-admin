"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  Car,
  CheckCircle2,
  ChevronLeft,
  Copy,
  Eye,
  FileCheck,
  FileText,
  Flag,
  GitMerge,
  Layers,
  Phone,
  Play,
  RefreshCw,
  Scan,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  XCircle,
} from "lucide-react";
import { ActionDialog } from "@/components/admin/action-dialog";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminFetch, type ApiError } from "@/lib/api";
import { adminPaths } from "@/lib/api/paths";
import { mediaUrl } from "@/lib/media";
import { date, ErrorState, Header, Loading } from "@/features/people/users-list";

// --- Types ---

type Report = {
  publicId: string;
  category: string;
  details: string | null;
  status: string;
  createdAt: string;
  listing: { publicId: string; slug: string; title: string };
};

type ListingSummary = {
  id: number;
  publicId: string;
  slug: string;
  title: string;
  year: number;
  priceCents: number;
  currency: string;
  mileageKm: number;
  vin?: string | null;
  contactPhone?: string | null;
  status: string;
  make?: { nameI18n?: { ar?: string; en?: string } } | null;
  model?: { nameI18n?: { ar?: string; en?: string } } | null;
  city?: { name?: { ar?: string; en?: string } } | null;
  images?: Array<{ file: { key: string } }>;
  vendor?: { publicId: string; displayName: string } | null;
  user?: { publicId: string; email: string; firstName?: string | null; lastName?: string | null; phone?: string | null } | null;
};

type DuplicateReview = {
  publicId: string;
  score: number;
  signals?: Record<string, unknown> | null;
  status: "OPEN" | "MERGED" | "DISMISSED";
  resolutionReason?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: { publicId: string; email: string } | null;
  createdAt: string;
  candidate: ListingSummary;
  canonical: ListingSummary;
};

type Verification = {
  id: number;
  realId?: number;
  publicId: string;
  type: "vendor" | "user";
  documentType: string;
  idNumber?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  reviewedBy?: { publicId: string; email: string } | null;
  file?: { key: string } | null;
  frontFile?: { publicId: string; key: string } | null;
  backFile?: { publicId: string; key: string } | null;
  user?: { publicId: string; firstName?: string | null; lastName?: string | null; email: string } | null;
  vendor?: { publicId: string; displayName: string; slug: string } | null;
};

type CursorResponse<T> = { data: T[]; meta: { nextCursor: string | null; hasMore: boolean } };

export function ReportsControl({ canModerate }: { canModerate: boolean }) {
  const [activeTab, setActiveTab] = useState("reports");

  return (
    <div className="space-y-6 pb-12">
      <Header
        title="الثقة والسلامة ومكافحة الاحتيال"
        description="مراجعة بلاغات المستخدمين، كشف وفحص الإعلانات المكررة، وتدقيق هويات الأفراد والتجار."
        onRefresh={() => {}}
        refreshing={false}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid h-12 w-full max-w-xl grid-cols-3 rounded-xl bg-muted/70 p-1">
          <TabsTrigger value="reports" className="rounded-lg font-bold">
            <Flag className="me-2 size-4" /> بلاغات الإعلانات
          </TabsTrigger>
          <TabsTrigger value="duplicates" className="rounded-lg font-bold">
            <Copy className="me-2 size-4" /> فحص الإعلانات المكررة
          </TabsTrigger>
          <TabsTrigger value="verifications" className="rounded-lg font-bold">
            <UserCheck className="me-2 size-4" /> توثيق الهويات (KYC)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-6">
          <ReportsTab canModerate={canModerate} />
        </TabsContent>

        <TabsContent value="duplicates" className="space-y-6">
          <DuplicatesTab canModerate={canModerate} />
        </TabsContent>

        <TabsContent value="verifications" className="space-y-6">
          <VerificationsTab canModerate={canModerate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: LISTING REPORTS
// ─────────────────────────────────────────────────────────────────────────────

function ReportsTab({ canModerate }: { canModerate: boolean }) {
  const client = useQueryClient();
  const [status, setStatus] = useState("OPEN");
  const [cursor, setCursor] = useState<string | null>(null);
  const [target, setTarget] = useState<{ report: Report; status: "ACTIONED" | "DISMISSED" } | null>(null);

  const params = new URLSearchParams({
    limit: "30",
    ...(status !== "ALL" ? { status } : {}),
    ...(cursor ? { cursor } : {}),
  }).toString();

  const query = useQuery({
    queryKey: ["trust-reports", params],
    queryFn: () => adminFetch<CursorResponse<Report>>(`${adminPaths.reports}?${params}`),
  });

  const mutation = useMutation({
    mutationFn: (resolutionNote: string) =>
      adminFetch(adminPaths.report(target!.report.publicId), {
        method: "PATCH",
        body: JSON.stringify({ status: target!.status, resolutionNote }),
      }),
    onSuccess: async () => {
      setTarget(null);
      await client.invalidateQueries({ queryKey: ["trust-reports"] });
    },
  });

  const reports = query.data?.data ?? [];
  const openCount = reports.filter((r) => r.status === "OPEN").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric title="طابور البلاغات المفتوحة" value={openCount} icon={ShieldAlert} />
        <Metric title="المعروضة حالياً" value={reports.length} icon={Flag} />
        <Metric title="تم اتخاذ إجراء" value={reports.filter((r) => r.status === "ACTIONED").length} icon={CheckCircle2} />
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>بلاغات الإعلانات</CardTitle>
              <CardDescription>شكاوى المشترين حول الأسعار الخاطئة أو الاحتيال أو السيارات المباعة</CardDescription>
            </div>
            <div className="w-44">
              <CustomSelect
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setCursor(null);
                }}
                options={[
                  { value: "OPEN", label: "مفتوحة" },
                  { value: "ACTIONED", label: "تم الإجراء" },
                  { value: "DISMISSED", label: "مرفوضة" },
                  { value: "ALL", label: "الكل" },
                ]}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {query.isLoading ? (
            <Loading />
          ) : query.error ? (
            <ErrorState error={query.error as ApiError} />
          ) : reports.length === 0 ? (
            <div className="grid min-h-56 place-items-center text-center p-6">
              <div>
                <CheckCircle2 className="mx-auto size-8 text-emerald-600" />
                <p className="mt-2 font-bold">لا توجد بلاغات في هذا الطابور</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الإعلان</TableHead>
                    <TableHead>التصنيف</TableHead>
                    <TableHead>التفاصيل</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الوقت</TableHead>
                    {canModerate && <TableHead className="text-end">القرار</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.publicId}>
                      <TableCell>
                        <Link href={`/listings/${report.listing.publicId}`} className="font-bold hover:underline">
                          {report.listing.title}
                        </Link>
                        <p className="mt-1 text-xs text-muted-foreground font-mono" dir="ltr">
                          {report.publicId}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{report.category}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs text-xs text-muted-foreground">
                        {report.details || "بلا تفاصيل"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={report.status === "OPEN" ? "destructive" : "secondary"}>
                          {report.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{date(report.createdAt)}</TableCell>
                      {canModerate && (
                        <TableCell className="text-end">
                          {report.status === "OPEN" && (
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="sm"
                                onClick={() => setTarget({ report, status: "ACTIONED" })}
                                className="bg-emerald-600 hover:bg-emerald-700"
                              >
                                <CheckCircle2 className="size-3.5 me-1" /> اتخاذ إجراء
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setTarget({ report, status: "DISMISSED" })}
                              >
                                <XCircle className="size-3.5 me-1" /> رفض
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {query.data?.meta.hasMore && (
          <div className="flex justify-end border-t p-4">
            <Button variant="outline" onClick={() => setCursor(query.data!.meta.nextCursor)}>
              المزيد <ChevronLeft />
            </Button>
          </div>
        )}
      </Card>

      <ActionDialog
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        title={target?.status === "ACTIONED" ? "تأكيد اتخاذ الإجراء" : "رفض البلاغ"}
        description={
          target?.status === "ACTIONED"
            ? "أكد أن محتوى البلاغ روجع واتُخذ الإجراء المناسب على الإعلان أو الحساب."
            : "سيُغلق البلاغ باعتباره غير مثبت."
        }
        confirmLabel={target?.status === "ACTIONED" ? "تأكيد الإجراء" : "رفض البلاغ"}
        requireReason
        pending={mutation.isPending}
        error={(mutation.error as ApiError | null)?.message}
        onConfirm={(note) => mutation.mutate(note)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: DUPLICATE REVIEW QUEUE
// ─────────────────────────────────────────────────────────────────────────────

function DuplicatesTab({ canModerate }: { canModerate: boolean }) {
  const client = useQueryClient();
  const [status, setStatus] = useState("OPEN");
  const [cursor, setCursor] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<{
    review: DuplicateReview;
    action: "MERGE" | "DISMISS";
  } | null>(null);

  const params = new URLSearchParams({
    limit: "25",
    ...(status !== "ALL" ? { status } : {}),
    ...(cursor ? { cursor } : {}),
  }).toString();

  const query = useQuery({
    queryKey: ["admin-duplicates", params],
    queryFn: () => adminFetch<CursorResponse<DuplicateReview>>(`${adminPaths.duplicates}?${params}`),
  });

  const scanMutation = useMutation({
    mutationFn: () => adminFetch<{ data: { scanned: number; flagged: number } }>(adminPaths.duplicatesScan, { method: "POST" }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["admin-duplicates"] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: ({ publicId, action, resolutionReason }: { publicId: string; action: "MERGE" | "DISMISS"; resolutionReason?: string }) =>
      adminFetch(adminPaths.duplicateResolve(publicId), {
        method: "PATCH",
        body: JSON.stringify({ action, resolutionReason }),
      }),
    onSuccess: async () => {
      setResolveTarget(null);
      await client.invalidateQueries({ queryKey: ["admin-duplicates"] });
    },
  });

  const duplicates = query.data?.data ?? [];
  const openCount = duplicates.filter((d) => d.status === "OPEN").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-4 sm:grid-cols-2 flex-1 max-w-xl">
          <Metric title="تنبيهات تطابق قيد المراجعة" value={openCount} icon={Copy} />
          <Metric title="إعلانات تم دمجها" value={duplicates.filter((d) => d.status === "MERGED").length} icon={GitMerge} />
        </div>
        {canModerate && (
          <Button
            variant="outline"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            className="font-bold"
          >
            <Scan className={`me-2 size-4 ${scanMutation.isPending ? "animate-spin" : ""}`} />
            {scanMutation.isPending ? "جارٍ فحص الإعلانات…" : "تشغيل فحص التشابه الآن"}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>قائمة تطابق الإعلانات (Duplicate Queue)</CardTitle>
              <CardDescription>مقارنة الإعلانات المتطابقة في رقم الشاسيه (VIN) أو صور السيارة ورقم البائع</CardDescription>
            </div>
            <div className="w-44">
              <CustomSelect
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setCursor(null);
                }}
                options={[
                  { value: "OPEN", label: "قيد المراجعة (Open)" },
                  { value: "MERGED", label: "تم الدمج (Merged)" },
                  { value: "DISMISSED", label: "مستبعدة (Dismissed)" },
                  { value: "ALL", label: "الكل" },
                ]}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {query.isLoading ? (
            <Loading />
          ) : query.error ? (
            <ErrorState error={query.error as ApiError} />
          ) : duplicates.length === 0 ? (
            <div className="grid min-h-56 place-items-center text-center p-6">
              <div>
                <CheckCircle2 className="mx-auto size-8 text-emerald-600" />
                <p className="mt-2 font-bold">لا توجد إعلانات مكررة قيد المراجعة</p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {duplicates.map((item) => (
                <div key={item.publicId} className="p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge className={item.score >= 80 ? "bg-red-600" : "bg-amber-600"}>
                        نسبة التطابق: {Math.round(item.score)}%
                      </Badge>
                      <Badge variant="outline">{item.status}</Badge>
                      <span className="text-xs text-muted-foreground font-mono" dir="ltr">
                        {item.publicId}
                      </span>
                    </div>
                    {canModerate && item.status === "OPEN" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-primary font-bold"
                          onClick={() => setResolveTarget({ review: item, action: "MERGE" })}
                        >
                          <GitMerge className="me-1 size-3.5" /> دمج الإعلان (Merge)
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setResolveTarget({ review: item, action: "DISMISS" })}
                        >
                          <XCircle className="me-1 size-3.5" /> تجاهل كإعلان أصلي
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Side by side comparison */}
                  <div className="grid gap-4 md:grid-cols-2 rounded-xl border bg-muted/20 p-4">
                    {/* Candidate (New Duplicate) */}
                    <div className="space-y-2 rounded-lg border bg-card p-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="destructive" className="text-xs">الإعلان المشبوه (المرشح)</Badge>
                        <span className="text-xs text-muted-foreground font-mono" dir="ltr">
                          {item.candidate?.publicId}
                        </span>
                      </div>
                      <Link
                        href={`/listings/${item.candidate?.publicId}`}
                        className="font-bold text-sm hover:underline block"
                      >
                        {item.candidate?.title} ({item.candidate?.year})
                      </Link>
                      <div className="text-xs space-y-1 text-muted-foreground">
                        <p><strong>السعر:</strong> {(item.candidate?.priceCents / 100).toLocaleString("ar-EG")} ج.م</p>
                        <p><strong>المسافة:</strong> {item.candidate?.mileageKm?.toLocaleString("ar-EG")} كم</p>
                        <p><strong>الشاسيه (VIN):</strong> <span dir="ltr" className="font-mono">{item.candidate?.vin || "غير متوفر"}</span></p>
                        <p><strong>البائع:</strong> {item.candidate?.vendor?.displayName || item.candidate?.user?.email}</p>
                        <p><strong>الهاتف:</strong> <span dir="ltr">{item.candidate?.contactPhone || item.candidate?.user?.phone || "—"}</span></p>
                      </div>
                    </div>

                    {/* Canonical (Original) */}
                    <div className="space-y-2 rounded-lg border bg-card p-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-800">الإعلان الأصلي المقابل</Badge>
                        <span className="text-xs text-muted-foreground font-mono" dir="ltr">
                          {item.canonical?.publicId}
                        </span>
                      </div>
                      <Link
                        href={`/listings/${item.canonical?.publicId}`}
                        className="font-bold text-sm hover:underline block"
                      >
                        {item.canonical?.title} ({item.canonical?.year})
                      </Link>
                      <div className="text-xs space-y-1 text-muted-foreground">
                        <p><strong>السعر:</strong> {(item.canonical?.priceCents / 100).toLocaleString("ar-EG")} ج.م</p>
                        <p><strong>المسافة:</strong> {item.canonical?.mileageKm?.toLocaleString("ar-EG")} كم</p>
                        <p><strong>الشاسيه (VIN):</strong> <span dir="ltr" className="font-mono">{item.canonical?.vin || "غير متوفر"}</span></p>
                        <p><strong>البائع:</strong> {item.canonical?.vendor?.displayName || item.canonical?.user?.email}</p>
                        <p><strong>الهاتف:</strong> <span dir="ltr">{item.canonical?.contactPhone || item.canonical?.user?.phone || "—"}</span></p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {resolveTarget && (
        <ActionDialog
          open={Boolean(resolveTarget)}
          onOpenChange={(open) => {
            if (!open) setResolveTarget(null);
          }}
          title={resolveTarget.action === "MERGE" ? "تأكيد دمج الإعلان المكرر" : "تجاهل الشبهة واحتفاظ بالإعلان"}
          description={
            resolveTarget.action === "MERGE"
              ? "سيتم ربط هذا الإعلان بالإعلان الأصلي وأرشفته لمنع تكرار العرض في السوق وحماية المشترين."
              : "سيتم إغلاق التنبيه كحالة غير مكررة والسماح للإعلان بالظهور كإعلان مستقل."
          }
          confirmLabel={resolveTarget.action === "MERGE" ? "تأكيد الدمج" : "تأكيد التجاهل"}
          requireReason
          pending={resolveMutation.isPending}
          error={(resolveMutation.error as ApiError | null)?.message}
          onConfirm={(reason) =>
            resolveMutation.mutate({
              publicId: resolveTarget.review.publicId,
              action: resolveTarget.action,
              resolutionReason: reason,
            })
          }
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3: IDENTITY & KYC VERIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

function VerificationsTab({ canModerate }: { canModerate: boolean }) {
  const client = useQueryClient();
  const [status, setStatus] = useState("PENDING");
  const [docType, setDocType] = useState("ALL");
  const [cursor, setCursor] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ front?: string | null; back?: string | null; title: string } | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{
    verification: Verification;
    action: "APPROVED" | "REJECTED";
  } | null>(null);

  const params = new URLSearchParams({
    limit: "25",
    ...(status !== "ALL" ? { status } : {}),
    ...(docType !== "ALL" ? { documentType: docType } : {}),
    ...(cursor ? { cursor } : {}),
  }).toString();

  const query = useQuery({
    queryKey: ["admin-verifications", params],
    queryFn: () => adminFetch<CursorResponse<Verification>>(`${adminPaths.verifications}?${params}`),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ publicId, status, rejectionReason }: { publicId: string; status: "APPROVED" | "REJECTED"; rejectionReason?: string }) =>
      adminFetch(adminPaths.verificationReview(publicId), {
        method: "PATCH",
        body: JSON.stringify({ status, rejectionReason }),
      }),
    onSuccess: async () => {
      setReviewTarget(null);
      await client.invalidateQueries({ queryKey: ["admin-verifications"] });
    },
  });

  const verifications = query.data?.data ?? [];
  const pendingCount = verifications.filter((v) => v.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric title="طلبات توثيق قيد الفحص" value={pendingCount} icon={UserCheck} />
        <Metric
          title="هويات معتمدة"
          value={verifications.filter((v) => v.status === "APPROVED").length}
          icon={ShieldCheck}
        />
        <Metric
          title="طلبات مرفوضة"
          value={verifications.filter((v) => v.status === "REJECTED").length}
          icon={XCircle}
        />
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>طلبات توثيق الهوية (Citizen & Vendor KYC)</CardTitle>
              <CardDescription>فحص بطاقات الرقم القومي للمستخدمين والسجلات التجارية للمعارض</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="w-40">
                <CustomSelect
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setCursor(null);
                  }}
                  options={[
                    { value: "ALL", label: "كل الحالات" },
                    { value: "PENDING", label: "قيد المراجعة" },
                    { value: "APPROVED", label: "معتمدة" },
                    { value: "REJECTED", label: "مرفوضة" },
                  ]}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {query.isLoading ? (
            <Loading />
          ) : query.error ? (
            <ErrorState error={query.error as ApiError} />
          ) : verifications.length === 0 ? (
            <div className="grid min-h-56 place-items-center text-center p-6">
              <div>
                <UserCheck className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-2 font-bold">لا توجد طلبات توثيق في هذا الطابور</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>صاحب الطلب</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>نوع الوثيقة</TableHead>
                    <TableHead>الرقم القومي / السجل</TableHead>
                    <TableHead>المستندات المرفوعة</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>تاريخ التقديم</TableHead>
                    {canModerate && <TableHead className="text-end">القرار</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {verifications.map((item) => {
                    const frontUrl = item.frontFile?.key ? mediaUrl(item.frontFile.key) : null;
                    const backUrl = item.backFile?.key ? mediaUrl(item.backFile.key) : null;
                    const singleUrl = item.file?.key ? mediaUrl(item.file.key) : null;

                    const title = item.type === "vendor"
                      ? (item.vendor?.displayName || "معرض سيارات")
                      : ([item.user?.firstName, item.user?.lastName].filter(Boolean).join(" ") || item.user?.email || "فرد");

                    return (
                      <TableRow key={item.publicId}>
                        <TableCell>
                          <span className="font-bold block">{title}</span>
                          <span className="text-xs text-muted-foreground font-mono" dir="ltr">
                            {item.publicId}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.type === "vendor" ? "outline" : "secondary"}>
                            {item.type === "vendor" ? "معرض (Vendor)" : "فرد (Citizen)"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.documentType}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold" dir="ltr">
                          {item.idNumber || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {frontUrl || backUrl ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 gap-1 text-xs"
                                onClick={() =>
                                  setPreviewDoc({
                                    front: frontUrl,
                                    back: backUrl,
                                    title: `${title} - بطاقة الرقم القومي`,
                                  })
                                }
                              >
                                <Eye className="size-3.5" /> عرض الوجهين
                              </Button>
                            ) : singleUrl ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 gap-1 text-xs"
                                onClick={() =>
                                  setPreviewDoc({
                                    front: singleUrl,
                                    title: `${title} - المستند`,
                                  })
                                }
                              >
                                <Eye className="size-3.5" /> عرض المستند
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">بلا مستندات</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              item.status === "APPROVED"
                                ? "bg-emerald-600"
                                : item.status === "PENDING"
                                ? "bg-amber-500"
                                : "bg-destructive"
                            }
                          >
                            {item.status === "APPROVED"
                              ? "موثق ✓"
                              : item.status === "PENDING"
                              ? "قيد المراجعة"
                              : "مرفوض"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{date(item.createdAt)}</TableCell>
                        {canModerate && (
                          <TableCell className="text-end">
                            {item.status === "PENDING" && (
                              <div className="flex justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => setReviewTarget({ verification: item, action: "APPROVED" })}
                                >
                                  <CheckCircle2 className="size-3.5 me-1" /> اعتماد
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:bg-destructive/10"
                                  onClick={() => setReviewTarget({ verification: item, action: "REJECTED" })}
                                >
                                  <XCircle className="size-3.5 me-1" /> رفض
                                </Button>
                              </div>
                            )}
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
      </Card>

      {/* Document Preview Modal */}
      {previewDoc && (
        <Dialog open onOpenChange={(open) => !open && setPreviewDoc(null)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{previewDoc.title}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2 sm:grid-cols-2">
              {previewDoc.front && (
                <div className="space-y-1.5 text-center">
                  <p className="text-xs font-bold text-muted-foreground">الوجه الأمامي</p>
                  <div className="overflow-hidden rounded-xl border bg-muted/30 p-1">
                    <img src={previewDoc.front} alt="Front ID" className="size-full rounded-lg object-contain max-h-64" />
                  </div>
                </div>
              )}
              {previewDoc.back && (
                <div className="space-y-1.5 text-center">
                  <p className="text-xs font-bold text-muted-foreground">الوجه الخلفي</p>
                  <div className="overflow-hidden rounded-xl border bg-muted/30 p-1">
                    <img src={previewDoc.back} alt="Back ID" className="size-full rounded-lg object-contain max-h-64" />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewDoc(null)}>
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Review Dialog */}
      {reviewTarget && (
        <ActionDialog
          open={Boolean(reviewTarget)}
          onOpenChange={(open) => {
            if (!open) setReviewTarget(null);
          }}
          title={reviewTarget.action === "APPROVED" ? "اعتماد توثيق الهوية" : "رفض توثيق الهوية"}
          description={
            reviewTarget.action === "APPROVED"
              ? "سيتم تفعيل شارة التوثيق لحساب المستخدم أو المعرض وإتاحة النشر والخدمات المتقدمة."
              : "يرجى ذكر سبب الرفض (مثل: صورة الهوية غير واضحة أو البطاقة منتهية الصلاحية)."
          }
          confirmLabel={reviewTarget.action === "APPROVED" ? "تأكيد الاعتماد" : "تأكيد الرفض"}
          requireReason={reviewTarget.action === "REJECTED"}
          destructive={reviewTarget.action === "REJECTED"}
          pending={reviewMutation.isPending}
          error={(reviewMutation.error as ApiError | null)?.message}
          onConfirm={(reason) =>
            reviewMutation.mutate({
              publicId: reviewTarget.verification.publicId,
              status: reviewTarget.action,
              rejectionReason: reason,
            })
          }
        />
      )}
    </div>
  );
}

function Metric({ title, value, icon: Icon }: { title: string; value: number; icon: typeof Flag }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span className="grid size-11 place-items-center rounded-xl bg-muted">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-black">{value.toLocaleString("ar-EG")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
