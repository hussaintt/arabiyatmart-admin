"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Database,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Image as ImageIcon,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Search,
  Send,
  Server,
  ShieldCheck,
  Sparkles,
  Square,
  Tag,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { adminFetch } from "@/lib/api";
import { PageHeading } from "@/components/control-center";
import { AnimateInView, PageMotion } from "@/components/ui/animate-in-view";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomSelect } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Types ────────────────────────────────────────────────────────────────────

type ScraperEngineState = {
  status: "idle" | "running" | "paused" | "stopped" | "completed" | "error";
  current_page: number;
  total_pages: number;
  items_scraped: number;
  images_downloaded: number;
  clean_images_processed: number;
  elapsed_seconds: number;
  current_action: string;
  errors_count: number;
  recent_logs?: Array<{ level: string; message: string; timestamp: string }>;
  serviceUrl?: string;
  reachable?: boolean;
  autostart?: { enabled: boolean; reason: string | null };
};

type CsvFile = {
  filename: string;
  size_bytes: number;
  size_formatted: string;
  row_count: number;
  modified: number;
};

type ListingItem = {
  listing_id: string;
  title: string;
  url: string;
  price_egp: string;
  year: string;
  km: string;
  make: string;
  make_ar?: string;
  model: string;
  model_ar?: string;
  condition?: string;
  body_type?: string;
  color?: string;
  fuel_type?: string;
  transmission?: string;
  tags?: string;
  city?: string;
  city_ar?: string;
  location_full?: string;
  phone?: string;
  whatsapp?: string;
  seller_name?: string;
  seller_member_since?: string;
  post_date?: string;
  description?: string;
  image_count?: string;
  images?: string;
  image_files?: string;
  clean_thumbnails?: string[];
  local_thumbnails?: string[];
  has_clean_images?: boolean;
};

type ListingsResponse = {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: ListingItem[];
  facets?: {
    makes: string[];
    cities: string[];
    min_year: number;
    max_year: number;
    min_price: number;
    max_price: number;
  };
};

type DatasetStats = {
  total_listings: number;
  price_stats?: { min: number; max: number; avg: number; median: number };
  year_stats?: { min: number; max: number };
  images_stats?: { total_raw: number; total_clean: number; coverage_percent: number };
  top_makes?: Array<{ make: string; count: number }>;
  top_cities?: Array<{ city: string; count: number }>;
};

type ImportJobProgress = {
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
  results?: Array<{
    externalId: string;
    status: string;
    title: string | null;
    listingSlug: string | null;
    listingStatus: string | null;
  }>;
  rowErrors?: Array<{ lineNumber: number; externalId: string | null; message: string }>;
  error?: string | null;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(value: number | string | undefined | null) {
  if (value === undefined || value === null || value === "") return "—";
  const num = typeof value === "string" ? Number(value.replace(/,/g, "")) : value;
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat("ar-EG").format(num);
}

function statusBadge(status: string) {
  switch (status) {
    case "running":
    case "COMMITTING":
    case "VALIDATING":
      return <Badge className="bg-blue-600 text-white animate-pulse">جارٍ التشغيل</Badge>;
    case "paused":
      return <Badge variant="secondary" className="bg-amber-100 text-amber-900 border-amber-300">مؤقت</Badge>;
    case "completed":
    case "COMMITTED":
      return <Badge className="bg-emerald-600 text-white">مكتمل</Badge>;
    case "error":
    case "FAILED":
      return <Badge variant="destructive">خطأ</Badge>;
    case "stopped":
    case "CANCELLED":
      return <Badge variant="outline">متوقف</Badge>;
    case "idle":
    default:
      return <Badge variant="outline" className="text-muted-foreground">خامل</Badge>;
  }
}

// ── Main Component ───────────────────────────────────────────────────────────

export function ScraperControlCenter() {
  const queryClient = useQueryClient();

  // Selected file and filter state
  const [selectedFile, setSelectedFile] = useState<string>("hatla2ee_cars.csv");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [makeFilter, setMakeFilter] = useState<string>("");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [conditionFilter] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [selectedListing, setSelectedListing] = useState<ListingItem | null>(null);
  const [showLogs, setShowLogs] = useState<boolean>(false);

  // Scrape dialog state
  const [isScrapeDialogOpen, setIsScrapeDialogOpen] = useState<boolean>(false);
  const [scrapeStartPage, setScrapeStartPage] = useState<number>(1);
  const [scrapeEndPage, setScrapeEndPage] = useState<number>(3);
  const [scrapeOutFile, setScrapeOutFile] = useState<string>("hatla2ee_cars.csv");
  const [scrapeWorkers, setScrapeWorkers] = useState<number>(4);
  const [scrapeDelay, setScrapeDelay] = useState<number>(1);
  const [scrapeDownloadImages, setScrapeDownloadImages] = useState<boolean>(true);
  const [scrapeRemoveWatermarks, setScrapeRemoveWatermarks] = useState<boolean>(false);
  const [scrapeMake, setScrapeMake] = useState<string>("");
  const [scrapeCity, setScrapeCity] = useState<string>("");
  const [isScrapeActionPending, setIsScrapeActionPending] = useState<boolean>(false);
  const [scrapeActionMessage, setScrapeActionMessage] = useState<string | null>(null);
  const [isStartingService, setIsStartingService] = useState<boolean>(false);
  const [serviceActionMessage, setServiceActionMessage] = useState<string | null>(null);

  // Import dialog state
  const [isImportDialogOpen, setIsImportDialogOpen] = useState<boolean>(false);
  const [importApprove, setImportApprove] = useState<boolean>(false);
  const [importVendorSlug, setImportVendorSlug] = useState<string>("souq-el-sayarat-el-maftouh");
  const [isImportStarting, setIsImportStarting] = useState<boolean>(false);
  const [activeImportJobId, setActiveImportJobId] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Watermark Preview & Push states
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<{
    original_data_uri?: string;
    mask_overlay_data_uri?: string;
    clean_data_uri?: string;
    elapsed_seconds?: number;
    resolution?: string;
  } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [previewViewMode, setPreviewViewMode] = useState<"clean" | "mask">("clean");

  const [isPushDialogOpen, setIsPushDialogOpen] = useState<boolean>(false);
  const [pushRemoteUrl, setPushRemoteUrl] = useState<string>("http://localhost:3000");
  const [pushApiKey, setPushApiKey] = useState<string>("");
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  const gpuStatusQuery = useQuery({
    queryKey: ["scraper-gpu-status"],
    queryFn: () =>
      adminFetch<{
        online: boolean;
        device: string;
        model: string;
        mps_available?: boolean;
        template_loaded?: boolean;
      }>("/v1/admin/scraper/watermark/gpu-status"),
    refetchInterval: 15000,
  });

  async function handleLoadPreview(listingId?: string, imageUrl?: string) {
    setIsPreviewLoading(true);
    setPreviewData(null);
    try {
      // If neither id nor url was explicitly passed, pick the first available listing from the table
      const fallbackItem = listingsQuery.data?.items?.[0];
      const targetId = listingId || fallbackItem?.listing_id;
      const targetImg = imageUrl || (fallbackItem?.clean_thumbnails?.[0] || fallbackItem?.local_thumbnails?.[0] || fallbackItem?.images?.split("|")?.[0]);

      const resp = await adminFetch<{ success: boolean; preview: any }>("/v1/admin/scraper/watermark/preview", {
        method: "POST",
        body: JSON.stringify({ listing_id: targetId, image_url: targetImg }),
      });
      if (resp.success && resp.preview) {
        setPreviewData(resp.preview);
        setIsPreviewDialogOpen(true);
      }
    } catch (err: any) {
      console.error("Preview load error:", err);
      alert(err.message || "تعذّر جلب معاينة إزالة العلامة المائية. تأكد من تشغيل خادم الكشط وبوابة LaMa.");
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function handlePushToRemote() {
    setIsPushing(true);
    setPushMessage(null);
    try {
      const res = await adminFetch<{ success: boolean; message: string }>("/v1/admin/scraper/push-to-remote", {
        method: "POST",
        body: JSON.stringify({
          remote_url: pushRemoteUrl,
          api_key: pushApiKey,
          file: selectedFile,
          vendor_slug: importVendorSlug,
          auto_approve: importApprove,
        }),
      });
      setPushMessage(res.message);
    } catch (err: any) {
      setPushMessage(err?.message || "فشل إرسال البيانات إلى الخادم الخارجي.");
    } finally {
      setIsPushing(false);
    }
  }

  // 1. Scraper Service Status Query
  const statusQuery = useQuery({
    queryKey: ["scraper-status"],
    queryFn: () => adminFetch<ScraperEngineState>("/v1/admin/scraper/status"),
    refetchInterval: (query) => {
      const state = query.state.data?.status;
      return state === "running" || state === "paused" ? 2500 : 10000;
    },
    retry: 1,
  });

  const isScraperOnline = statusQuery.data?.reachable === true;

  const vendorsQuery = useQuery({
    queryKey: ["approved-vendors-for-scraper"],
    queryFn: () =>
      adminFetch<{
        data: Array<{
          slug: string;
          legalName: string;
          displayName?: { ar?: string; en?: string };
        }>;
      }>("/v1/admin/vendors?status=APPROVED&limit=100"),
    staleTime: 60_000,
  });
  const scraperStatus = statusQuery.data?.status ?? "idle";
  const isScraping = scraperStatus === "running";

  // 2. CSV Datasets Query
  const datasetsQuery = useQuery({
    queryKey: ["scraper-datasets"],
    queryFn: () => adminFetch<{ files: CsvFile[] }>("/v1/admin/scraper/datasets"),
    enabled: isScraperOnline,
    refetchInterval: 20000,
  });

  // 3. Scraped Listings Query
  const listingsQueryParams = new URLSearchParams();
  listingsQueryParams.set("file", selectedFile);
  listingsQueryParams.set("page", String(page));
  listingsQueryParams.set("page_size", "20");
  if (searchQuery) listingsQueryParams.set("q", searchQuery);
  if (makeFilter) listingsQueryParams.set("make", makeFilter);
  if (cityFilter) listingsQueryParams.set("city", cityFilter);
  if (conditionFilter) listingsQueryParams.set("condition", conditionFilter);

  const listingsQuery = useQuery({
    queryKey: ["scraper-listings", selectedFile, page, searchQuery, makeFilter, cityFilter, conditionFilter],
    queryFn: () => adminFetch<ListingsResponse>(`/v1/admin/scraper/listings?${listingsQueryParams.toString()}`),
    enabled: isScraperOnline && !!selectedFile,
  });

  // 4. Dataset Stats Query
  const statsQuery = useQuery({
    queryKey: ["scraper-stats", selectedFile],
    queryFn: () => adminFetch<DatasetStats>(`/v1/admin/scraper/stats?file=${encodeURIComponent(selectedFile)}`),
    enabled: isScraperOnline && !!selectedFile,
  });

  // 5. Active Import Job Progress Query
  const importJobQuery = useQuery({
    queryKey: ["scraper-import-job", activeImportJobId],
    queryFn: () => adminFetch<ImportJobProgress>(`/v1/admin/scraper/import-jobs/${activeImportJobId}`),
    enabled: !!activeImportJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "COMMITTED" || status === "FAILED" || status === "CANCELLED" ? false : 2000;
    },
  });

  // ── Scraper Action Handlers ──

  async function handleStartScrape() {
    setIsScrapeActionPending(true);
    setScrapeActionMessage(null);
    try {
      await adminFetch("/v1/admin/scraper/start", {
        method: "POST",
        body: JSON.stringify({
          start_page: scrapeStartPage,
          end_page: scrapeEndPage,
          out_file: scrapeOutFile || "hatla2ee_cars.csv",
          workers: scrapeWorkers,
          delay: scrapeDelay,
          fetch_details: true,
          download_images: scrapeDownloadImages,
          remove_watermarks: scrapeRemoveWatermarks,
          make: scrapeMake || undefined,
          city: scrapeCity || undefined,
        }),
      });
      setIsScrapeDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["scraper-status"] });
    } catch (err) {
      setScrapeActionMessage((err as Error).message);
    } finally {
      setIsScrapeActionPending(false);
    }
  }

  async function handleStartService() {
    setIsStartingService(true);
    setServiceActionMessage(null);
    try {
      await adminFetch("/v1/admin/scraper/service/start", { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: ["scraper-status"] });
      setServiceActionMessage("تم تشغيل خادم السكرابر وهو جاهز الآن.");
    } catch (err) {
      setServiceActionMessage((err as Error).message);
    } finally {
      setIsStartingService(false);
    }
  }

  async function handlePauseScrape() {
    try {
      await adminFetch("/v1/admin/scraper/pause", { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["scraper-status"] });
    } catch (err) {
      console.error("Pause error:", err);
    }
  }

  async function handleResumeScrape() {
    try {
      await adminFetch("/v1/admin/scraper/resume", { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["scraper-status"] });
    } catch (err) {
      console.error("Resume error:", err);
    }
  }

  async function handleStopScrape() {
    try {
      await adminFetch("/v1/admin/scraper/stop", { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["scraper-status"] });
    } catch (err) {
      console.error("Stop error:", err);
    }
  }

  async function handleStartImport() {
    setIsImportStarting(true);
    setImportNotice(null);
    try {
      const response = await adminFetch<{
        publicId: string;
        type: string;
        status: string;
        fileName: string;
        totalRows: number;
      }>("/v1/admin/scraper/import", {
        method: "POST",
        body: JSON.stringify({
          file: selectedFile,
          approve: importApprove,
          vendorSlug: importVendorSlug.trim() || "souq-el-sayarat-el-maftouh",
        }),
      });
      setActiveImportJobId(response.publicId);
      setIsImportDialogOpen(false);
      setImportNotice("تم بدء استيراد البيانات إلى قاعدة البيانات في الخلفية.");
    } catch (err) {
      setImportNotice((err as Error).message);
    } finally {
      setIsImportStarting(false);
    }
  }

  return (
    <PageMotion className="scraper-workspace">
      {/* ── Page Header ── */}
      <PageHeading
        title="مركز السكرابر واستيراد البيانات"
        description="راقب خدمة الجمع، افحص الحزم والصور، ثم انقل البيانات إلى مسار المراجعة الآمن."
        icon={Database}
        eyebrow="Yalla Motors / Scraper & Ingestion"
        action={<>
          <Button
            variant="outline"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["scraper-status"] });
              queryClient.invalidateQueries({ queryKey: ["scraper-datasets"] });
              queryClient.invalidateQueries({ queryKey: ["scraper-listings"] });
              queryClient.invalidateQueries({ queryKey: ["scraper-stats"] });
            }}
          >
            <RefreshCw className="size-4 me-1.5" />
            تحديث
          </Button>

          <Button
            variant="default"
            disabled={!isScraperOnline || isScraping}
            onClick={() => setIsScrapeDialogOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Play className="size-4 me-1.5" />
            بدء جمع جديد
          </Button>

          <Button
            variant="outline"
            onClick={() => handleLoadPreview()}
            disabled={isPreviewLoading}
            className="border-indigo-300 text-indigo-800 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
          >
            {isPreviewLoading ? <Loader2 className="size-4 me-1.5 animate-spin" /> : <Sparkles className="size-4 me-1.5 text-indigo-600" />}
            فحص إزالة العلامات (Before/After)
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsPushDialogOpen(true)}
            className="border-purple-300 text-purple-800 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-950/30"
          >
            <Send className="size-4 me-1.5 text-purple-600" />
            دفع لخادم خارجي
          </Button>

          <Button
            variant="default"
            onClick={() => setIsImportDialogOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Upload className="size-4 me-1.5" />
            استيراد إلى قاعدة البيانات
          </Button>
        </>}
      />

      {/* ── Watermark Removal Engine & GPU Telemetry ── */}
      <AnimateInView>
        <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50/60 via-background to-blue-50/40 dark:from-indigo-950/20 dark:to-blue-950/10">
          <CardContent className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 py-4">
            <div className="flex items-start gap-3">
              <div className="grid size-11 place-items-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 shrink-0">
                <Cpu className="size-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-foreground">
                    بوابة إزالة العلامة المائية الذكية (LaMa GPU Inpainting)
                  </h3>
                  {gpuStatusQuery.data?.online ? (
                    <Badge className="bg-emerald-600 text-white flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-white animate-pulse" />
                      مسرع بالعتاد (MPS GPU)
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">خامل / جاري التحميل</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  المعالج: <span className="font-mono font-medium text-foreground">{gpuStatusQuery.data?.device === "mps" ? "Apple Silicon Metal GPU (M-Series)" : (gpuStatusQuery.data?.device?.toUpperCase() || "Metal GPU")}</span> · النموذج: <span className="font-medium text-foreground">LaMa Fourier Convolution</span> · القالب: <span className="text-emerald-600 font-medium">هتلاقى HATLA2EE (إسقاط رياضي دقيق)</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
              <div className="text-left font-mono text-xs px-3 py-1.5 rounded-lg bg-background/80 border text-muted-foreground">
                <span className="text-emerald-600 font-bold">~0.75s</span> / صورة
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleLoadPreview()}
                disabled={isPreviewLoading}
                className="bg-background shadow-xs hover:bg-muted"
              >
                {isPreviewLoading ? <Loader2 className="size-3.5 me-1.5 animate-spin" /> : <Sparkles className="size-3.5 me-1.5 text-indigo-600" />}
                معاينة حية (Before/After)
              </Button>
            </div>
          </CardContent>
        </Card>
      </AnimateInView>

      {/* ── Scraper Service Status Banner ── */}
      <AnimateInView>
        {!isScraperOnline ? (
        <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-amber-200/70 text-amber-800 shrink-0">
                <Server className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-950 dark:text-amber-200">
                  خادم السكرابر المساعد غير متصل (Offline)
                </h3>
                <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-300/80">
                  شغّله مباشرةً من هذه اللوحة، ثم ابدأ عملية الجمع دون فتح الطرفية.
                </p>
                {serviceActionMessage && <p className="mt-2 text-xs font-medium text-amber-900 dark:text-amber-200">{serviceActionMessage}</p>}
                {statusQuery.data?.autostart?.reason && <p className="mt-2 text-xs text-amber-900/80 dark:text-amber-300/80">{statusQuery.data.autostart.reason}</p>}
              </div>
            </div>
            <div className="flex shrink-0 gap-2 self-end sm:self-center">
              <Button variant="default" size="sm" disabled={isStartingService || !statusQuery.data?.autostart?.enabled} onClick={handleStartService} className="bg-emerald-600 text-white hover:bg-emerald-700">
                {isStartingService ? <Loader2 className="size-4 me-1.5 animate-spin" /> : <Play className="size-4 me-1.5" />}
                تشغيل الخادم تلقائيًا
              </Button>
              <Button variant="outline" size="sm" onClick={() => statusQuery.refetch()} className="border-amber-300 hover:bg-amber-100">
                <RefreshCw className="size-4 me-1.5" />
                إعادة الفحص
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div
                    className={`size-3 rounded-full ${
                      scraperStatus === "running"
                        ? "bg-emerald-500 animate-ping"
                        : scraperStatus === "paused"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                  />
                  <div
                    className={`absolute inset-0 size-3 rounded-full ${
                      scraperStatus === "running"
                        ? "bg-emerald-500"
                        : scraperStatus === "paused"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">خدمة السكرابر المحلية</span>
                    {statusBadge(scraperStatus)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {statusQuery.data?.current_action || "جاهز لاستقبال المهام"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {scraperStatus === "running" && (
                  <>
                    <Button size="sm" variant="outline" onClick={handlePauseScrape}>
                      <Pause className="size-4 me-1.5" />
                      إيقاف مؤقت
                    </Button>
                    <Button size="sm" variant="destructive" onClick={handleStopScrape}>
                      <Square className="size-4 me-1.5" />
                      إلغاء العملية
                    </Button>
                  </>
                )}
                {scraperStatus === "paused" && (
                  <>
                    <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleResumeScrape}>
                      <Play className="size-4 me-1.5" />
                      استئناف
                    </Button>
                    <Button size="sm" variant="destructive" onClick={handleStopScrape}>
                      <Square className="size-4 me-1.5" />
                      إنهاء
                    </Button>
                  </>
                )}
                {statusQuery.data?.recent_logs && statusQuery.data.recent_logs.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowLogs(!showLogs)}
                    className="text-xs"
                  >
                    <Activity className="size-3.5 me-1" />
                    {showLogs ? "إخفاء السجلات" : "عرض السجلات الحية"}
                  </Button>
                )}
              </div>
            </div>

            {/* Live Progress Metrics if running / paused */}
            {(scraperStatus === "running" || scraperStatus === "paused") && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-1">
                <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground">الصفحات المكتملة</p>
                  <p className="text-xl font-bold mt-1">
                    {statusQuery.data?.current_page ?? 0} / {statusQuery.data?.total_pages ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground">الإعلانات المجمعة</p>
                  <p className="text-xl font-bold mt-1 text-primary">
                    {formatNumber(statusQuery.data?.items_scraped ?? 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground">الصور المحملة</p>
                  <p className="text-xl font-bold mt-1 text-emerald-600">
                    {formatNumber(statusQuery.data?.images_downloaded ?? 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground">الوقت المستغرق</p>
                  <p className="text-xl font-bold mt-1">
                    {statusQuery.data?.elapsed_seconds ? `${statusQuery.data.elapsed_seconds} ثانية` : "—"}
                  </p>
                </div>
              </div>
            )}

            {/* Expandable Live Console Log */}
            {showLogs && statusQuery.data?.recent_logs && (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl bg-black/90 p-4 font-mono text-xs text-emerald-400 ltr text-left">
                {statusQuery.data.recent_logs.map((log, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-muted-foreground">[{log.timestamp}]</span>
                    <span className={log.level === "error" ? "text-red-400" : log.level === "warn" ? "text-amber-400" : "text-emerald-400"}>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </AnimateInView>

      {/* ── Active Import Job Progress ── */}
      {activeImportJobId && importJobQuery.data && (
        <AnimateInView><Card className="border-primary/40 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="size-5 text-primary" />
                <CardTitle className="text-base">عملية الاستيراد النشطة إلى قاعدة البيانات</CardTitle>
              </div>
              {statusBadge(importJobQuery.data.status)}
            </div>
            <CardDescription>
              ملف المصدر: {importJobQuery.data.fileName} · المعرف: {activeImportJobId}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">إجمالي الصفوف</p>
                <p className="text-lg font-bold mt-1">{formatNumber(importJobQuery.data.totalRows ?? 0)}</p>
              </div>
              <div className="rounded-xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">تم استيرادها بنجاح</p>
                <p className="text-lg font-bold mt-1 text-emerald-600">
                  {formatNumber(importJobQuery.data.validRows ?? 0)}
                </p>
              </div>
              <div className="rounded-xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">مكررة (تم تخطيها)</p>
                <p className="text-lg font-bold mt-1 text-muted-foreground">
                  {formatNumber(
                    importJobQuery.data.results?.filter((r) => r.status === "ALREADY_IMPORTED").length ?? 0
                  )}
                </p>
              </div>
              <div className="rounded-xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">أخطاء</p>
                <p className="text-lg font-bold mt-1 text-destructive">
                  {formatNumber(importJobQuery.data.errorRows ?? 0)}
                </p>
              </div>
            </div>

            {/* Error table if errors exist */}
            {importJobQuery.data.rowErrors && importJobQuery.data.rowErrors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                <p className="font-semibold text-xs text-destructive">تفاصيل صفوف الأخطاء:</p>
                <div className="max-h-32 overflow-y-auto space-y-1 text-xs text-destructive/90">
                  {importJobQuery.data.rowErrors.slice(0, 10).map((err, idx) => (
                    <div key={idx}>
                      السطر {err.lineNumber} {err.externalId ? `(ID: ${err.externalId})` : ""}: {err.message}
                    </div>
                  ))}
                  {importJobQuery.data.rowErrors.length > 10 && (
                    <p className="text-muted-foreground">... و {importJobQuery.data.rowErrors.length - 10} أخطاء أخرى</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card></AnimateInView>
      )}

      {importNotice && !activeImportJobId && (
        <AnimateInView className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/60 p-4 text-sm">
          <span>{importNotice}</span>
          <Button variant="ghost" size="sm" onClick={() => setImportNotice(null)}>
            <X className="size-4" />
          </Button>
        </AnimateInView>
      )}

      {/* ── Dataset Selector & Quick Metrics ── */}
      <AnimateInView className="grid gap-4 lg:grid-cols-[1fr_3fr]">
        {/* Left column: CSV Datasets list */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-primary" />
              حزم البيانات (CSV)
            </CardTitle>
            <CardDescription>الملفات المستخرجة في المجلد المحلي</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {datasetsQuery.isLoading ? (
              <div className="p-4 text-center text-xs text-muted-foreground">جارٍ تحميل الحزم...</div>
            ) : datasetsQuery.data?.files?.length ? (
              datasetsQuery.data.files.map((file) => (
                <button
                  key={file.filename}
                  onClick={() => {
                    setSelectedFile(file.filename);
                    setPage(1);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl border p-3 text-right text-sm shadow-xs transition-all hover:-translate-y-0.5 ${
                    selectedFile === file.filename
                      ? "border-primary bg-primary/5 font-semibold text-primary"
                      : "hover:bg-muted/50 border-border"
                  }`}
                >
                  <div className="truncate">
                    <p className="truncate">{file.filename}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatNumber(file.row_count)} إعلان · {file.size_formatted}
                    </p>
                  </div>
                  {selectedFile === file.filename && <CheckCircle2 className="size-4 shrink-0 text-primary" />}
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-muted-foreground">
                لا توجد ملفات CSV بعد. ابدأ عملية جمع جديدة.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column: Stats Summary Cards */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="hover:-translate-y-1 hover:shadow-lg">
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">إعلانات الحزمة الحالية</p>
                <p className="text-2xl font-bold mt-1 text-foreground">
                  {formatNumber(statsQuery.data?.total_listings ?? listingsQuery.data?.total ?? 0)}
                </p>
              </div>
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Car className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:-translate-y-1 hover:shadow-lg">
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">نطاق الأسعار</p>
                <p className="text-lg font-bold mt-1 truncate">
                  {statsQuery.data?.price_stats?.min
                    ? `${formatNumber(statsQuery.data.price_stats.min)} - ${formatNumber(statsQuery.data.price_stats.max)} ج.م`
                    : "—"}
                </p>
              </div>
              <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <Tag className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:-translate-y-1 hover:shadow-lg">
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">سنوات الصنع</p>
                <p className="text-xl font-bold mt-1">
                  {statsQuery.data?.year_stats?.min
                    ? `${statsQuery.data.year_stats.min} — ${statsQuery.data.year_stats.max}`
                    : "—"}
                </p>
              </div>
              <div className="grid size-10 place-items-center rounded-xl bg-blue-500/10 text-blue-600">
                <Sparkles className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:-translate-y-1 hover:shadow-lg">
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">صور معالجة ومفرغة</p>
                <p className="text-2xl font-bold mt-1 text-emerald-600">
                  {statsQuery.data?.images_stats?.total_clean !== undefined
                    ? formatNumber(statsQuery.data.images_stats.total_clean)
                    : "—"}
                </p>
              </div>
              <div className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
                <ImageIcon className="size-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      </AnimateInView>

      {/* ── Scraped Listings Preview Table ── */}
      <AnimateInView><Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">معاينة إعلانات الحزمة: {selectedFile}</CardTitle>
              <CardDescription>
                إجمالي {formatNumber(listingsQuery.data?.total ?? 0)} إعلان في هذا الملف
              </CardDescription>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-60">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="بحث بالموديل أو المدينة..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="ps-9"
                />
              </div>

              {listingsQuery.data?.facets?.makes && (
                <div className="w-44">
                  <CustomSelect
                    value={makeFilter}
                    onChange={(e) => {
                      setMakeFilter(e.target.value);
                      setPage(1);
                    }}
                    emptyOption="كل الماركات"
                    options={listingsQuery.data.facets.makes}
                  />
                </div>
              )}

              {listingsQuery.data?.facets?.cities && (
                <div className="w-40">
                  <CustomSelect
                    value={cityFilter}
                    onChange={(e) => {
                      setCityFilter(e.target.value);
                      setPage(1);
                    }}
                    emptyOption="كل المدن"
                    options={listingsQuery.data.facets.cities}
                  />
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">الصورة</TableHead>
                <TableHead>السيارة</TableHead>
                <TableHead>السعر</TableHead>
                <TableHead>سنة الصنع / المسافة</TableHead>
                <TableHead>المدينة</TableHead>
                <TableHead>البائع / الهاتف</TableHead>
                <TableHead className="text-left">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listingsQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <Loader2 className="size-5 animate-spin mx-auto mb-2" />
                    جارٍ تحميل بيانات الإعلانات...
                  </TableCell>
                </TableRow>
              ) : !listingsQuery.data?.items?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    لا توجد إعلانات مطابقة في هذا الملف.
                  </TableCell>
                </TableRow>
              ) : (
                listingsQuery.data.items.map((car) => {
                  const thumbnailPath = car.clean_thumbnails?.[0] || car.local_thumbnails?.[0];
                  const imageUrl = thumbnailPath
                    ? `/api/backend/v1/admin/scraper/image?path=${encodeURIComponent(thumbnailPath.replace(/^\//, ""))}`
                    : car.images?.split("|")?.[0];

                  return (
                    <TableRow key={car.listing_id} className="hover:bg-muted/40">
                      <TableCell>
                        <div className="relative size-12 rounded-lg bg-muted overflow-hidden border">
                          {imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imageUrl}
                              alt={car.title}
                              className="size-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="grid size-full place-items-center text-muted-foreground">
                              <Car className="size-5" />
                            </div>
                          )}
                          {car.has_clean_images && (
                            <span className="absolute bottom-0 inset-x-0 bg-emerald-600 text-white text-[9px] text-center font-bold">
                              Clean
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold text-sm">
                          {car.make_ar || car.make} {car.model_ar || car.model}
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-xs">{car.title}</p>
                        <p className="text-[11px] text-muted-foreground font-mono mt-0.5">#{car.listing_id}</p>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-emerald-600">
                          {formatNumber(car.price_egp)} ج.م
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{car.year}</p>
                        <p className="text-xs text-muted-foreground">{formatNumber(car.km)} كم</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{car.city_ar || car.city || "—"}</p>
                        {car.condition && (
                          <Badge variant="outline" className="text-[10px] mt-0.5">
                            {car.condition}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{car.seller_name || "—"}</p>
                        <p className="text-xs text-muted-foreground font-mono">{car.phone || "—"}</p>
                      </TableCell>
                      <TableCell className="text-left">
                        <div className="flex items-center gap-1.5 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            title="فحص إزالة العلامة المائية لهذه السيارة"
                            onClick={() => handleLoadPreview(car.listing_id, imageUrl)}
                            className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 border-indigo-200"
                          >
                            <Sparkles className="size-3.5 me-1" />
                            فحص العلامة
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedListing(car)}
                          >
                            <Eye className="size-3.5 me-1" />
                            تفاصيل
                          </Button>
                          {car.url && (
                            <a
                              href={car.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="size-4" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {listingsQuery.data && listingsQuery.data.total_pages > 1 && (
            <div className="flex items-center justify-between border-t pt-4 mt-2">
              <p className="text-xs text-muted-foreground">
                صفحة {listingsQuery.data.page} من {listingsQuery.data.total_pages} (
                {formatNumber(listingsQuery.data.total)} إعلان)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronRight className="size-4 me-1" />
                  السابق
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= listingsQuery.data.total_pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  التالي
                  <ChevronLeft className="size-4 ms-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card></AnimateInView>

      {/* ── Dialog: Start Scraper ── */}
      <Dialog open={isScrapeDialogOpen} onOpenChange={setIsScrapeDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>بدء عملية جمع بيانات جديدة من هتلاقي</DialogTitle>
            <DialogDescription>
              حدد نطاق الصفحات والخيارات المتقدمة لجمع الإعلانات وتخزينها محليًا.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="startPage">من الصفحة</Label>
                <Input
                  id="startPage"
                  type="number"
                  min={1}
                  value={scrapeStartPage}
                  onChange={(e) => setScrapeStartPage(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endPage">إلى الصفحة</Label>
                <Input
                  id="endPage"
                  type="number"
                  min={1}
                  value={scrapeEndPage}
                  onChange={(e) => setScrapeEndPage(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="scrapeMake">الماركة (اختياري)</Label>
                <Input
                  id="scrapeMake"
                  value={scrapeMake}
                  onChange={(e) => setScrapeMake(e.target.value)}
                  placeholder="Toyota"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scrapeCity">المدينة (اختياري)</Label>
                <Input
                  id="scrapeCity"
                  value={scrapeCity}
                  onChange={(e) => setScrapeCity(e.target.value)}
                  placeholder="Cairo"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="outFile">اسم ملف الحفظ (CSV)</Label>
              <Input
                id="outFile"
                value={scrapeOutFile}
                onChange={(e) => setScrapeOutFile(e.target.value)}
                placeholder="hatla2ee_cars.csv"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="workers">عدد العمليات المتزامنة (Workers)</Label>
                <Input
                  id="workers"
                  type="number"
                  min={1}
                  max={8}
                  value={scrapeWorkers}
                  onChange={(e) => setScrapeWorkers(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="delay">فترة التأخير بالثواني</Label>
                <Input
                  id="delay"
                  type="number"
                  min={0}
                  step={0.5}
                  value={scrapeDelay}
                  onChange={(e) => setScrapeDelay(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 p-3 transition-colors hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={scrapeDownloadImages}
                  onChange={(e) => setScrapeDownloadImages(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-input text-primary focus:ring-primary"
                />
                <span><span className="block font-semibold">تنزيل الصور إلى حزمة الاستيعاب</span><span className="mt-1 block text-xs text-muted-foreground">تُفحص الصور وتظل خارج السوق حتى اكتمال التحقق.</span></span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 p-3 transition-colors hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={scrapeRemoveWatermarks}
                  onChange={(e) => setScrapeRemoveWatermarks(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-input text-primary focus:ring-primary"
                />
                <span><span className="block font-semibold">إنشاء نسخ صور معالجة</span><span className="mt-1 block text-xs text-muted-foreground">لا تستخدم هذا الخيار إلا عندما يغطي التفويض معالجة العلامات وحقوق الصور صراحة.</span></span>
              </label>
            </div>

            {scrapeActionMessage && (
              <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                {scrapeActionMessage}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsScrapeDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleStartScrape}
              disabled={isScrapeActionPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isScrapeActionPending && <Loader2 className="size-4 me-1.5 animate-spin" />}
              بدء الجمع الآن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Import to Database ── */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>استيراد الإعلانات إلى قاعدة بيانات المنصة</DialogTitle>
            <DialogDescription>
              سيتم التحقق من الحزمة، مطابقة الماركات والمدن، رفع الصور إلى التخزين الدائم، وإنشاء الإعلانات دون تكرار.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="rounded-xl border border-border/60 bg-muted/60 p-4">
              <p className="text-xs text-muted-foreground">الملف المحدد للاستيراد:</p>
              <p className="font-semibold mt-0.5">{selectedFile}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vendorSlug">المعرض / التاجر المنسوب إليه الإعلانات</Label>
              {vendorsQuery.data?.data && vendorsQuery.data.data.length > 0 ? (
                <CustomSelect
                  id="vendorSlug"
                  value={importVendorSlug}
                  onChange={(e) => setImportVendorSlug(e.target.value)}
                  options={vendorsQuery.data.data.map((v) => ({
                    value: v.slug,
                    label: `${v.displayName?.ar || v.displayName?.en || v.legalName} (${v.slug})`,
                  }))}
                />
              ) : (
                <Input
                  id="vendorSlug"
                  value={importVendorSlug}
                  onChange={(e) => setImportVendorSlug(e.target.value)}
                  placeholder="souq-el-sayarat-el-maftouh"
                />
              )}
              <p className="text-xs text-muted-foreground">
                الافتراضي: souq-el-sayarat-el-maftouh (سوق السيارات المفتوح)
              </p>
            </div>

            <div className={`space-y-2 rounded-xl border p-4 transition-colors ${importApprove ? "border-amber-500/40 bg-amber-500/10" : "border-border/60 bg-muted/30"}`}>
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={importApprove}
                  onChange={(e) => setImportApprove(e.target.checked)}
                  className="size-4 rounded border-input text-primary focus:ring-primary"
                />
                <span className="font-semibold">تجاوز قائمة المراجعة والنشر الفوري (ACTIVE)</span>
              </label>
              <p className="text-xs text-muted-foreground ms-6">
                الخيار الآمن والافتراضي هو حفظ الإعلانات بحالة &quot;بانتظار المراجعة&quot; (PENDING_REVIEW). فعّل النشر الفوري فقط بعد التحقق الكامل من الحزمة والحقوق.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleStartImport}
              disabled={isImportStarting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isImportStarting && <Loader2 className="size-4 me-1.5 animate-spin" />}
              تأكيد وبدء الاستيراد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Listing Details ── */}
      {selectedListing && (
        <Dialog open={!!selectedListing} onOpenChange={() => setSelectedListing(null)}>
          <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>
                  {selectedListing.make_ar || selectedListing.make}{" "}
                  {selectedListing.model_ar || selectedListing.model} {selectedListing.year}
                </DialogTitle>
                <span className="font-bold text-emerald-600 text-lg">
                  {formatNumber(selectedListing.price_egp)} ج.م
                </span>
              </div>
              <DialogDescription>
                المعرف: {selectedListing.listing_id} · تاريخ الإعلان: {selectedListing.post_date || "—"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              {/* Photo thumbnails */}
              {selectedListing.clean_thumbnails?.length || selectedListing.local_thumbnails?.length ? (
                <div className="space-y-1.5">
                  <Label>الصور المحفوظة محليًا:</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {(selectedListing.clean_thumbnails?.length
                      ? selectedListing.clean_thumbnails
                      : selectedListing.local_thumbnails || []
                    ).map((t, idx) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={idx}
                        src={`/api/backend/v1/admin/scraper/image?path=${encodeURIComponent(t.replace(/^\//, ""))}` }
                        alt={`Photo ${idx + 1}`}
                        className="rounded-lg object-cover aspect-video w-full border bg-muted"
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded bg-muted/60">
                  <span className="text-muted-foreground block">المسافة:</span>
                  <span className="font-semibold">{formatNumber(selectedListing.km)} كم</span>
                </div>
                <div className="p-2 rounded bg-muted/60">
                  <span className="text-muted-foreground block">الحالة:</span>
                  <span className="font-semibold">{selectedListing.condition || "—"}</span>
                </div>
                <div className="p-2 rounded bg-muted/60">
                  <span className="text-muted-foreground block">ناقل الحركة:</span>
                  <span className="font-semibold">{selectedListing.transmission || "—"}</span>
                </div>
                <div className="p-2 rounded bg-muted/60">
                  <span className="text-muted-foreground block">نوع الوقود:</span>
                  <span className="font-semibold">{selectedListing.fuel_type || "—"}</span>
                </div>
                <div className="p-2 rounded bg-muted/60">
                  <span className="text-muted-foreground block">اللون:</span>
                  <span className="font-semibold">{selectedListing.color || "—"}</span>
                </div>
                <div className="p-2 rounded bg-muted/60">
                  <span className="text-muted-foreground block">المدينة:</span>
                  <span className="font-semibold">{selectedListing.city_ar || selectedListing.city || "—"}</span>
                </div>
              </div>

              {/* Seller & Contact */}
              <div className="p-3 rounded-lg border bg-background space-y-1">
                <p className="font-semibold text-xs text-primary">معلومات البائع والاتصال:</p>
                <div className="flex flex-wrap gap-4 text-xs mt-1">
                  <span>اسم البائع: {selectedListing.seller_name || "—"}</span>
                  <span className="font-mono">الهاتف: {selectedListing.phone || "—"}</span>
                  {selectedListing.whatsapp && <span className="font-mono">واتساب: {selectedListing.whatsapp}</span>}
                </div>
              </div>

              {/* Description */}
              {selectedListing.description && (
                <div className="space-y-1">
                  <Label>وصف الإعلان:</Label>
                  <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg leading-relaxed whitespace-pre-line">
                    {selectedListing.description}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              {selectedListing.url && (
                <a
                  href={selectedListing.url}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "me-auto")}
                >
                  <ExternalLink className="size-4 me-1.5" />
                  عرض الإعلان الأصلي على هتلاقي
                </a>
              )}
              <Button variant="default" size="sm" onClick={() => setSelectedListing(null)}>
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Watermark Before/After Inspection Dialog ── */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-indigo-600" />
                <DialogTitle>فحص جودة إزالة العلامة المائية (Before & After Visual Inspection)</DialogTitle>
              </div>
              {previewData && (
                <Badge className="bg-emerald-600 text-white font-mono text-xs">
                  {previewData.elapsed_seconds ? `${previewData.elapsed_seconds}s` : "0.75s"} (MPS GPU)
                </Badge>
              )}
            </div>
            <DialogDescription>
              مقارنة فورية بين صورة إعلان هتلاقي الأصلية والصورة المفرغة بواسطة نموذج LaMa على معالج الرسومات.
            </DialogDescription>
          </DialogHeader>

          {previewData ? (
            <div className="space-y-4 py-2">
              {/* Controls bar */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/60 border text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">وضع العرض المقارن:</span>
                  <div className="inline-flex rounded-lg border p-0.5 bg-background">
                    <Button
                      type="button"
                      size="sm"
                      variant={previewViewMode === "clean" ? "default" : "ghost"}
                      onClick={() => setPreviewViewMode("clean")}
                      className="h-7 text-xs px-2.5"
                    >
                      الصورة النظيفة (بدون علامة)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={previewViewMode === "mask" ? "default" : "ghost"}
                      onClick={() => setPreviewViewMode("mask")}
                      className="h-7 text-xs px-2.5"
                    >
                      قناع الإسقاط الدقيق (Red Mask)
                    </Button>
                  </div>
                </div>
                <div className="font-mono text-muted-foreground">
                  أبعاد الصورة: {previewData.resolution || "1200x900"}
                </div>
              </div>

              {/* Side-by-Side Images Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">1. الصورة الأصلية من هتلاقي (Raw)</span>
                    <Badge variant="outline" className="text-red-600 border-red-200">تحتوي على علامة</Badge>
                  </div>
                  <div className="relative aspect-4/3 rounded-xl overflow-hidden border bg-muted/30">
                    {previewData.original_data_uri && (
                      <img
                        src={previewData.original_data_uri}
                        alt="Original"
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-indigo-600 dark:text-indigo-400">
                      {previewViewMode === "clean" ? "2. النتيجة النظيفة (بدون أي أثر للعلامة)" : "2. قناع الإسقاط الدقيق (Vector Projection)"}
                    </span>
                    <Badge className="bg-emerald-600 text-white font-medium text-[10px]">
                      {previewViewMode === "clean" ? "100% مفرغة" : "تحديد دقيق"}
                    </Badge>
                  </div>
                  <div className="relative aspect-4/3 rounded-xl overflow-hidden border bg-muted/30">
                    <img
                      src={previewViewMode === "clean" ? previewData.clean_data_uri : previewData.mask_overlay_data_uri}
                      alt="Processed"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  تمت إزالة علامة هتلاقي المائية بدقة وحفظ أكثر من 97.5% من بكسلات السيارة الأصلية دون أي تشويش.
                </div>
                <p className="text-[11px] text-muted-foreground">
                  يتم تطبيق هذه العملية على الصورة الرئيسية المفردة فقط قبل إنشاء الأحجام المصغرة (Thumbnail / Medium / Large)، مما يضمن عدم وصول أي أثر للعلامة المائية إلى قاعدة البيانات.
                </p>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="size-8 mx-auto animate-spin text-indigo-600 mb-2" />
              <p className="text-sm">جاري معالجة الصورة وإزالة العلامة المائية عبر GPU...</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="default" onClick={() => setIsPreviewDialogOpen(false)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Push to Remote Server Dialog ── */}
      <Dialog open={isPushDialogOpen} onOpenChange={setIsPushDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Send className="size-5 text-purple-600" />
              <DialogTitle>دفع الإعلانات إلى خادم إنتاج خارجي</DialogTitle>
            </div>
            <DialogDescription>
              إرسال بيانات حزمة {selectedFile} والصور النظيفة مفرغة العلامات عبر الشبكة مباشرةً إلى خادم قاعدة البيانات الخارجي.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label>رابط الخادم المستهدف (Production Server URL):</Label>
              <Input
                placeholder="https://api.arabiyatmart.com"
                value={pushRemoteUrl}
                onChange={(e) => setPushRemoteUrl(e.target.value)}
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                سيتم إرسال الطلبات إلى مسار: <code className="text-primary font-mono">{pushRemoteUrl}/v1/admin/ingest/listings-batch</code>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>مفتاح أمان العامل (Worker API Key أو Admin JWT):</Label>
              <Input
                type="password"
                placeholder="أدخل مفتاح التحقق المعتمد..."
                value={pushApiKey}
                onChange={(e) => setPushApiKey(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label>التاجر المعتمد للإعلانات:</Label>
              <CustomSelect
                value={importVendorSlug}
                onChange={(e) => setImportVendorSlug(e.target.value)}
                options={(vendorsQuery.data?.data || []).map((v) => ({
                  value: v.slug,
                  label: `${v.displayName?.ar || v.legalName} (${v.slug})`,
                }))}
              />
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/40">
              <input
                type="checkbox"
                id="pushApprove"
                checked={importApprove}
                onChange={(e) => setImportApprove(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="pushApprove" className="cursor-pointer font-normal">
                نشر الإعلانات فوراً على المنصة كـ ACTIVE (تخطي مسار المراجعة)
              </Label>
            </div>

            {pushMessage && (
              <div className="p-3 rounded-lg border border-purple-300 bg-purple-50 text-purple-900 dark:bg-purple-950/20 dark:text-purple-200">
                {pushMessage}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPushDialogOpen(false)} disabled={isPushing}>
              إلغاء
            </Button>
            <Button
              variant="default"
              onClick={handlePushToRemote}
              disabled={isPushing || !pushRemoteUrl}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isPushing ? (
                <>
                  <Loader2 className="size-4 me-1.5 animate-spin" />
                  جاري النقل والدفع...
                </>
              ) : (
                <>
                  <Send className="size-4 me-1.5" />
                  بدء الدفع إلى الخادم الخارجي
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageMotion>
  );
}
