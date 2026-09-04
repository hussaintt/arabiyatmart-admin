"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCode,
  FileSpreadsheet,
  Layers3,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { adminFetch, type ApiError } from "@/lib/api";
import { adminPaths } from "@/lib/api/paths";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type JobResult = {
  sourceUrl?: string;
  externalId?: string;
  status: string;
  title?: string | null;
  year?: number | null;
  price?: number | null;
  currency?: string | null;
  listingPublicId?: string | null;
  listingSlug?: string | null;
  listingStatus?: string | null;
  importedImages?: number | null;
  skippedImages?: number | null;
  error?: string | null;
  finishedAt?: string | null;
};

type RowError = {
  lineNumber: number;
  externalId?: string | null;
  message: string;
};

type JobDetailData = {
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
  updatedAt: string;
  committedAt?: string | null;
  report?: {
    options?: Record<string, unknown>;
    results?: JobResult[];
    rowErrors?: RowError[];
    error?: string | null;
  } | null;
};

function formatNumber(value?: number | null) {
  if (value === undefined || value === null) return "—";
  return new Intl.NumberFormat("ar-EG").format(value);
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso)
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "COMMITTED":
    case "VALIDATED":
    case "completed":
      return <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">مكتمل</Badge>;
    case "COMMITTING":
    case "VALIDATING":
    case "running":
    case "PENDING":
      return <Badge className="bg-blue-600 text-white animate-pulse">جارٍ المعالجة</Badge>;
    case "FAILED":
    case "error":
      return <Badge variant="destructive">فشل</Badge>;
    case "CANCELLED":
    case "stopped":
      return <Badge variant="outline">ملغى</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export function JobDetail({ jobId }: { jobId: string }) {
  const query = useQuery({
    queryKey: ["import-job-detail", jobId],
    queryFn: () => adminFetch<JobDetailData>(adminPaths.job(jobId)),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "COMMITTING" || s === "VALIDATING" || s === "PENDING" ? 2000 : false;
    },
  });

  const job = query.data;

  if (query.isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground">
        جارٍ تحميل تفاصيل الوظيفة…
      </div>
    );
  }

  if (query.error || !job) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-center">
        <div>
          <p className="font-bold text-destructive">تعذّر فتح سجل الوظيفة</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {(query.error as ApiError)?.message ?? "لم يتم العثور على الوظيفة"}
          </p>
          <Button variant="outline" className="mt-4" render={<Link href="/jobs" />}>
            العودة لسجل الوظائف
          </Button>
        </div>
      </div>
    );
  }

  const results: JobResult[] = job.report?.results ?? [];
  const rowErrors: RowError[] = job.report?.rowErrors ?? [];
  const options = job.report?.options ?? {};
  const progressPercent =
    job.totalRows && job.validRows != null
      ? Math.min(100, Math.round(((job.validRows + (job.errorRows ?? 0)) / job.totalRows) * 100))
      : null;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Link
            href="/jobs"
            className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="size-4" /> سجل الوظائف
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight md:text-3xl">
              {job.label ?? job.fileName ?? job.type}
            </h1>
            <StatusBadge status={job.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
            {job.publicId} · نوع: {job.type}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={cn("size-4 me-1.5", query.isFetching && "animate-spin")} />
            تحديث
          </Button>
          <Button variant="default" render={<Link href="/jobs" />}>
            كل الوظائف
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Boxes className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">إجمالي الصفوف</p>
              <p className="mt-1 text-2xl font-black">{formatNumber(job.totalRows)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-700">
              <CheckCircle2 className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">الصفوف الناجحة</p>
              <p className="mt-1 text-2xl font-black text-emerald-700">{formatNumber(job.validRows)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-destructive/15 text-destructive">
              <AlertTriangle className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">الصفوف الفاشلة</p>
              <p className="mt-1 text-2xl font-black text-destructive">
                {formatNumber(job.errorRows ?? job.errorCount ?? rowErrors.length)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
              <Clock className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">وقت البدء</p>
              <p className="mt-1 text-sm font-bold">{formatDate(job.createdAt)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar if active */}
      {progressPercent !== null && job.status !== "COMMITTED" && job.status !== "FAILED" && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>نسبة الإنجاز</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Failure reason if any */}
      {job.report?.error && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-destructive">
          <div className="flex items-start gap-3">
            <XCircle className="size-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">خطأ في تنفيذ الوظيفة</p>
              <p className="mt-1 text-sm leading-6">{job.report.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Row Errors Table if any */}
      {rowErrors.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="border-b bg-destructive/5 pb-4">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              سجل أخطاء الصفوف ({rowErrors.length.toLocaleString("ar-EG")})
            </CardTitle>
            <CardDescription>
              الصفوف التي لم تستوفِ شروط التحقق وتم استبعادها من النشر لحماية السوق.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">رقم السطر</TableHead>
                    <TableHead className="w-44">المعرّف الخارجي</TableHead>
                    <TableHead>سبب الخطأ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowErrors.map((err, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs tabular-nums">{err.lineNumber}</TableCell>
                      <TableCell className="font-mono text-xs" dir="ltr">
                        {err.externalId ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-destructive">
                        {err.message}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Table if any */}
      {results.length > 0 && (
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="size-5" />
              نتائج المعالجة ({results.length.toLocaleString("ar-EG")} عنصر)
            </CardTitle>
            <CardDescription>
              سجل العناصر التي تمت معالجتها وحالة إنشاء كل إعلان في السوق.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>العنصر</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>السعر</TableHead>
                    <TableHead>الصور</TableHead>
                    <TableHead>الإعلان المنشأ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((res, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <p className="font-bold">{res.title || res.externalId || "—"}</p>
                        {res.sourceUrl && (
                          <a
                            href={res.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                            dir="ltr"
                          >
                            رابط المصدر <ExternalLink className="size-3" />
                          </a>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            res.status === "CREATED"
                              ? "default"
                              : res.status === "FAILED"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {res.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums font-semibold">
                        {res.price ? `${res.price.toLocaleString("ar-EG")} ${res.currency ?? "EGP"}` : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums text-xs">
                        {res.importedImages != null ? `${res.importedImages} مستوردة` : "—"}
                      </TableCell>
                      <TableCell>
                        {res.listingPublicId ? (
                          <Link
                            href={`/listings/${res.listingPublicId}`}
                            className="inline-flex items-center gap-1 font-bold text-primary hover:underline text-xs"
                          >
                            فتح الإعلان <ExternalLink className="size-3" />
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Options & Metadata */}
      {Object.keys(options).length > 0 && (
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <FileCode className="size-4" /> معايير التشغيل (Job Options)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <pre
              className="max-h-60 overflow-y-auto rounded-xl bg-muted/50 p-4 font-mono text-xs text-muted-foreground"
              dir="ltr"
            >
              {JSON.stringify(options, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
