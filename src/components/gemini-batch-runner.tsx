'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  FolderCheck,
  History,
  Images,
  Loader2,
  RefreshCw,
  Replace,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import { adminFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { AnimateInView, AnimatedItem, PageMotion } from '@/components/ui/animate-in-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { GeminiListingImageControl } from '@/components/gemini-listing-image-control';

type BatchStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
type ItemStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

type BatchSummary = {
  publicId: string;
  status: BatchStatus;
  addWatermark: boolean;
  watermarkText: string | null;
  model: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  createdAt: string;
  updatedAt: string;
};

type BatchItem = {
  publicId: string;
  originalFilename: string;
  status: ItemStatus;
  attempts: number;
  errorCode: string | null;
  sourceUrl: string;
  resultUrl: string | null;
  replaceListingImage: boolean;
  replacedAt: string | null;
  replacementErrorCode: string | null;
  listingImage: {
    publicId: string;
    isCover: boolean;
    listing: { publicId: string; slug: string; title: string; status: string };
  } | null;
  createdAt: string;
  updatedAt: string;
};

type BatchDetail = BatchSummary & { prompt: string; items: BatchItem[] };

const MAX_FILES = 20;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const finishedStatuses: BatchStatus[] = ['COMPLETED', 'PARTIAL', 'FAILED'];

const statusLabels: Record<BatchStatus | ItemStatus, string> = {
  PENDING: 'في الانتظار',
  PROCESSING: 'قيد المعالجة',
  COMPLETED: 'مكتملة',
  PARTIAL: 'مكتملة جزئيًا',
  FAILED: 'فشلت',
  READY: 'جاهزة',
};

const errorLabels: Record<string, string> = {
  AI_STUDIO_DISABLED: 'خدمة Gemini غير مفعّلة على الخادم.',
  AI_STUDIO_NO_IMAGE: 'لم يُرجع Gemini صورة صالحة.',
  AI_STUDIO_UPSTREAM_ERROR: 'تعذّر الاتصال بـ Gemini بعد إعادة المحاولة.',
  QUEUE_ENQUEUE_FAILED: 'تعذّرت إضافة الصورة إلى طابور المعالجة.',
  LISTING_IMAGE_CHANGED: 'نجح Gemini، لكن صورة الإعلان تغيّرت أثناء المعالجة. راجع النتيجة ثم اعتمدها يدويًا إذا كانت مناسبة.',
  LISTING_IMAGE_REMOVED: 'نجح Gemini، لكن الصورة لم تعد مرتبطة بالإعلان.',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatBytes(value: number) {
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 1 }).format(value / 1024 / 1024) + ' MB';
}

function mediaUrl(path: string | null) {
  return path ? `/api/backend${path}` : null;
}

function statusVariant(status: BatchStatus | ItemStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'READY' || status === 'COMPLETED') return 'default';
  if (status === 'FAILED') return 'destructive';
  if (status === 'PENDING' || status === 'PROCESSING') return 'secondary';
  return 'outline';
}

function StatusBadge({ status }: { status: BatchStatus | ItemStatus }) {
  return (
    <Badge variant={statusVariant(status)}>
      {status === 'PROCESSING' ? <Loader2 className="animate-spin" /> : status === 'READY' || status === 'COMPLETED' ? <CheckCircle2 /> : status === 'FAILED' ? <AlertTriangle /> : <Clock3 />}
      {statusLabels[status]}
    </Badge>
  );
}

function FilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => {
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="aspect-[4/3] bg-muted">
        {url && (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img src={url} alt={file.name} className="size-full object-cover" />
        )}
      </div>
      <button type="button" onClick={onRemove} aria-label={`حذف ${file.name}`} className="absolute end-2 top-2 grid size-8 place-items-center rounded-lg bg-background/90 text-foreground shadow-md backdrop-blur transition hover:bg-destructive hover:text-destructive-foreground">
        <X className="size-4" />
      </button>
      <div className="p-3">
        <p className="truncate text-xs font-bold" dir="ltr">{file.name}</p>
        <p className="mt-1 text-[0.68rem] text-muted-foreground">{formatBytes(file.size)}</p>
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Images; tone?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl bg-muted text-muted-foreground', tone)}><Icon className="size-5" /></span>
        <div><p className="text-2xl font-black tabular-nums">{new Intl.NumberFormat('ar-EG').format(value)}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>
      </CardContent>
    </Card>
  );
}

export function GeminiBatchRunner() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [addWatermark, setAddWatermark] = useState(true);
  const [watermarkText, setWatermarkText] = useState('YallaMotors');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeError, setNoticeError] = useState(false);

  const historyQuery = useQuery({
    queryKey: ['gemini-batches'],
    queryFn: () => adminFetch<{ data: BatchSummary[] }>('/v1/admin/gemini-batches?limit=20'),
    refetchInterval: 10_000,
  });
  const effectiveBatchId = selectedBatchId ?? historyQuery.data?.data[0]?.publicId ?? null;
  const detailQuery = useQuery({
    queryKey: ['gemini-batch', effectiveBatchId],
    queryFn: () => adminFetch<BatchDetail>(`/v1/admin/gemini-batches/${effectiveBatchId}`),
    enabled: Boolean(effectiveBatchId),
    refetchInterval: (query) => {
      const data = query.state.data as BatchDetail | undefined;
      return data && !finishedStatuses.includes(data.status) ? 3_000 : false;
    },
  });

  const addFiles = useCallback((incoming: File[]) => {
    setNotice(null);
    setFiles((current) => {
      const known = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
      const accepted = incoming.filter((file) => {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (!file.type.startsWith('image/') || file.size > MAX_FILE_BYTES || known.has(key)) return false;
        known.add(key);
        return true;
      });
      const next = [...current, ...accepted].slice(0, MAX_FILES);
      if (accepted.length !== incoming.length || current.length + accepted.length > MAX_FILES) {
        setNoticeError(true);
        setNotice(`تم قبول الصور الصالحة فقط: بحد أقصى ${MAX_FILES} صورة و15 MB لكل صورة.`);
      }
      return next;
    });
  }, []);

  const totalSize = useMemo(() => files.reduce((total, file) => total + file.size, 0), [files]);

  async function runBatch() {
    setNotice(null);
    if (!files.length) {
      setNoticeError(true);
      setNotice('أضف صورة سيارة واحدة على الأقل.');
      return;
    }
    if (addWatermark && !watermarkText.trim()) {
      setNoticeError(true);
      setNotice('اكتب نص العلامة المائية الجديدة أو عطّل خيار إضافتها.');
      return;
    }

    const body = new FormData();
    body.append('addWatermark', String(addWatermark));
    body.append('watermarkText', addWatermark ? watermarkText.trim() : '');
    files.forEach((file) => body.append('images', file, file.name));

    setIsSubmitting(true);
    try {
      const batch = await adminFetch<BatchDetail>('/v1/admin/gemini-batches', { method: 'POST', body });
      queryClient.setQueryData(['gemini-batch', batch.publicId], batch);
      setSelectedBatchId(batch.publicId);
      setFiles([]);
      setNoticeError(false);
      setNotice(`بدأت معالجة ${batch.totalItems} صورة. يمكنك مغادرة الصفحة والعودة لاحقًا.`);
      await queryClient.invalidateQueries({ queryKey: ['gemini-batches'] });
    } catch (error) {
      setNoticeError(true);
      setNotice((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function retryItem(item: BatchItem) {
    if (!effectiveBatchId) return;
    try {
      const batch = await adminFetch<BatchDetail>(
        `/v1/admin/gemini-batches/${effectiveBatchId}/items/${item.publicId}/retry`,
        { method: 'POST' },
      );
      queryClient.setQueryData(['gemini-batch', effectiveBatchId], batch);
      await queryClient.invalidateQueries({ queryKey: ['gemini-batches'] });
    } catch (error) {
      setNoticeError(true);
      setNotice((error as Error).message);
    }
  }

  async function applyItem(item: BatchItem) {
    if (!effectiveBatchId) return;
    const force = item.replacementErrorCode === 'LISTING_IMAGE_CHANGED';
    if (force && !window.confirm('تغيّرت صورة الإعلان بعد بدء الدفعة. هل تريد استبدال الصورة الحالية بهذه النتيجة رغم ذلك؟')) return;
    try {
      const updated = await adminFetch<BatchDetail>(
        `/v1/admin/gemini-batches/${effectiveBatchId}/items/${item.publicId}/apply`,
        { method: 'POST', body: JSON.stringify({ force }) },
      );
      queryClient.setQueryData(['gemini-batch', effectiveBatchId], updated);
      await queryClient.invalidateQueries({ queryKey: ['gemini-listing-images'] });
    } catch (error) {
      setNoticeError(true);
      setNotice((error as Error).message);
    }
  }

  async function restoreItem(item: BatchItem) {
    if (!effectiveBatchId || !window.confirm('استعادة الصورة الأصلية لهذا الإعلان؟ ستظل النسخة النظيفة محفوظة في سجل الدفعة.')) return;
    try {
      const updated = await adminFetch<BatchDetail>(
        `/v1/admin/gemini-batches/${effectiveBatchId}/items/${item.publicId}/restore-original`,
        { method: 'POST' },
      );
      queryClient.setQueryData(['gemini-batch', effectiveBatchId], updated);
      await queryClient.invalidateQueries({ queryKey: ['gemini-listing-images'] });
    } catch (error) {
      setNoticeError(true);
      setNotice((error as Error).message);
    }
  }

  const batch = detailQuery.data;
  const progress = batch?.totalItems ? Math.round(((batch.completedItems + batch.failedItems) / batch.totalItems) * 100) : 0;

  return (
    <PageMotion>
      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg"><Sparkles className="size-5" /></span>
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="outline">Nano Banana 2</Badge><Badge variant="outline">gemini-3.1-flash-image</Badge></div>
            <h1 className="text-2xl font-black tracking-tight md:text-3xl">Gemini Batch Runner</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">استبدل العلامات المائية القديمة على مجموعة صور سيارات، واحفظ النسخ الناتجة بأمان داخل مجلد <span dir="ltr" className="font-mono font-semibold">clean_image</span>.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => { historyQuery.refetch(); detailQuery.refetch(); }} disabled={historyQuery.isFetching || detailQuery.isFetching}>
          <RefreshCw className={cn((historyQuery.isFetching || detailQuery.isFetching) && 'animate-spin')} /> تحديث
        </Button>
      </div>

      <AnimateInView>
        <GeminiListingImageControl
          onBatchCreated={(batchId) => setSelectedBatchId(batchId)}
          onOpenBatch={(batchId) => setSelectedBatchId(batchId)}
        />
      </AnimateInView>

      <div className="mb-4 mt-9 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <div className="text-center"><p className="text-sm font-black">رفع صور خارج الإعلانات</p><p className="mt-1 text-[0.68rem] text-muted-foreground">للصور غير المرتبطة حاليًا بإعلان داخل المنصة</p></div>
        <span className="h-px flex-1 bg-border" />
      </div>

      <AnimateInView stagger className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <AnimatedItem>
          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="flex items-center gap-2"><UploadCloud className="size-5" /> صور الدفعة</CardTitle>
              <CardDescription>JPG أو PNG أو WebP أو HEIC، حتى {MAX_FILES} صورة و15 MB لكل صورة.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="hidden" onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => { event.preventDefault(); setIsDragging(false); }}
                onDrop={(event) => { event.preventDefault(); setIsDragging(false); addFiles(Array.from(event.dataTransfer.files)); }}
                className={cn('flex min-h-44 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition', isDragging ? 'border-primary bg-primary/8' : 'border-border bg-muted/25 hover:border-primary/50 hover:bg-muted/50')}
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-background text-primary shadow-sm"><Images className="size-5" /></span>
                <span className="mt-4 text-sm font-bold">اسحب الصور هنا أو اضغط للاختيار</span>
                <span className="mt-1 text-xs text-muted-foreground">لن يتم تعديل الملفات الأصلية أو استبدالها.</span>
              </button>

              {files.length > 0 && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold">{files.length} صورة · {formatBytes(totalSize)}</p>
                    <Button variant="ghost" size="sm" onClick={() => setFiles([])}><X /> مسح الكل</Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {files.map((file) => (
                      <FilePreview key={`${file.name}:${file.size}:${file.lastModified}`} file={file} onRemove={() => setFiles((current) => current.filter((candidate) => candidate !== file))} />
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </AnimatedItem>

        <AnimatedItem>
          <Card className="h-full">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="flex items-center gap-2"><Sparkles className="size-5" /> إعداد طلب Gemini</CardTitle>
              <CardDescription>إزالة العلامات القديمة إلزامية؛ إضافة العلامة الجديدة اختيارية.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/70 bg-muted/30 p-4 transition hover:bg-muted/60">
                <input type="checkbox" checked={addWatermark} onChange={(event) => setAddWatermark(event.target.checked)} className="mt-1 size-4 accent-primary" />
                <span><span className="block text-sm font-bold">إضافة علامة مائية جديدة داخل طلب Gemini</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">عند تعطيله سيُطلب من Gemini إزالة العلامات القديمة فقط وإرجاع صورة نظيفة بلا نص إضافي.</span></span>
              </label>

              {addWatermark && (
                <div className="space-y-2">
                  <Label htmlFor="watermark-text">نص العلامة المائية</Label>
                  <Input id="watermark-text" value={watermarkText} maxLength={80} onChange={(event) => setWatermarkText(event.target.value)} placeholder="YallaMotors" dir="ltr" />
                  <p className="text-[0.68rem] text-muted-foreground">ستُطلب مرة واحدة، أسفل يمين الصورة، بحجم صغير وشفافية مناسبة.</p>
                </div>
              )}

              <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
                <div className="flex items-center gap-2 text-xs font-bold"><ShieldCheck className="size-4" /> قواعد الحماية</div>
                <ul className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
                  <li>• الحفاظ على السيارة والزاوية والخلفية والألوان كما هي.</li>
                  <li>• إزالة طبقات العلامة القديمة وإعادة بناء البكسلات المحجوبة فقط.</li>
                  <li>• حفظ الناتج في مسار جديد دون الكتابة فوق المصدر.</li>
                  <li>• مفتاح Gemini يبقى على الخادم ولا يصل إلى المتصفح.</li>
                </ul>
              </div>

              <Button size="lg" className="w-full" onClick={runBatch} disabled={isSubmitting || files.length === 0 || (addWatermark && !watermarkText.trim())}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {isSubmitting ? 'جارٍ رفع الدفعة…' : `تشغيل Gemini على ${files.length || 0} صورة`}
              </Button>
              {notice && <p className={cn('rounded-xl border p-3 text-sm leading-6', noticeError ? 'border-destructive/30 bg-destructive/8 text-destructive' : 'border-emerald-500/30 bg-emerald-500/8 text-emerald-800')}>{notice}</p>}
            </CardContent>
          </Card>
        </AnimatedItem>
      </AnimateInView>

      <AnimateInView className="mt-5">
        <div className="grid gap-5 xl:grid-cols-[.72fr_1.28fr]">
          <Card>
            <CardHeader className="border-b border-border/60"><CardTitle className="flex items-center gap-2"><History className="size-5" /> الدفعات السابقة</CardTitle><CardDescription>اضغط على أي دفعة لعرض تقدمها وصورها.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {historyQuery.isLoading && Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-xl" />)}
              {historyQuery.error && <p className="rounded-xl bg-destructive/8 p-4 text-sm text-destructive">{(historyQuery.error as Error).message}</p>}
              {historyQuery.data?.data.map((item) => (
                <button key={item.publicId} type="button" onClick={() => setSelectedBatchId(item.publicId)} className={cn('w-full rounded-xl border p-3 text-start transition', effectiveBatchId === item.publicId ? 'border-primary bg-primary/7' : 'border-border/70 hover:bg-muted/60')}>
                  <div className="flex items-center justify-between gap-3"><StatusBadge status={item.status} /><span className="text-[0.65rem] text-muted-foreground">{formatDate(item.createdAt)}</span></div>
                  <div className="mt-3 flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold" dir="ltr">{item.publicId}</span><span className="text-xs text-muted-foreground">{item.completedItems}/{item.totalItems}</span></div>
                </button>
              ))}
              {historyQuery.data && !historyQuery.data.data.length && <div className="py-12 text-center"><History className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 text-sm font-bold">لا توجد دفعات بعد</p></div>}
            </CardContent>
          </Card>

          <div className="space-y-5">
            {!effectiveBatchId && <Card><CardContent className="flex min-h-64 flex-col items-center justify-center text-center"><FolderCheck className="size-9 text-muted-foreground" /><p className="mt-3 font-bold">ابدأ أول دفعة لعرض النتائج</p></CardContent></Card>}
            {effectiveBatchId && detailQuery.isLoading && <Card><CardContent className="space-y-3"><Skeleton className="h-10 rounded-xl" /><Skeleton className="h-32 rounded-xl" /></CardContent></Card>}
            {detailQuery.error && <Card><CardContent><p className="rounded-xl bg-destructive/8 p-4 text-sm text-destructive">{(detailQuery.error as Error).message}</p></CardContent></Card>}
            {batch && (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Metric label="إجمالي الصور" value={batch.totalItems} icon={Images} />
                  <Metric label="صور جاهزة" value={batch.completedItems} icon={CheckCircle2} tone="bg-emerald-500/10 text-emerald-700" />
                  <Metric label="تحتاج إعادة محاولة" value={batch.failedItems} icon={AlertTriangle} tone="bg-destructive/10 text-destructive" />
                </div>
                <Card>
                  <CardHeader className="border-b border-border/60">
                    <div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>تقدم الدفعة</CardTitle><CardDescription className="mt-1" dir="ltr">{batch.publicId}</CardDescription></div><StatusBadge status={batch.status} /></div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${progress}%` }} /></div>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>{progress}% مكتمل</span><span>{batch.addWatermark ? `العلامة الجديدة: ${batch.watermarkText}` : 'بدون علامة مائية جديدة'}</span><span dir="ltr">{batch.model}</span></div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 lg:grid-cols-2">
                  {batch.items.map((item) => {
                    const source = mediaUrl(item.sourceUrl);
                    const result = mediaUrl(item.resultUrl);
                    return (
                      <Card key={item.publicId} className="overflow-hidden">
                        <div className="grid grid-cols-2 gap-px bg-border">
                          <div className="relative aspect-[4/3] bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element -- authenticated admin proxy image */}
                            <img src={source ?? ''} alt={`الصورة الأصلية ${item.originalFilename}`} className="size-full object-cover" />
                            <span className="absolute start-2 top-2 rounded-md bg-background/90 px-2 py-1 text-[0.65rem] font-bold shadow">قبل</span>
                          </div>
                          <div className="relative aspect-[4/3] bg-muted">
                            {result ? (
                              // eslint-disable-next-line @next/next/no-img-element -- authenticated admin proxy image
                              <img src={result} alt={`الصورة النظيفة ${item.originalFilename}`} className="size-full object-cover" />
                            ) : <div className="grid size-full place-items-center text-muted-foreground">{item.status === 'PROCESSING' ? <Loader2 className="size-6 animate-spin" /> : item.status === 'FAILED' ? <AlertTriangle className="size-6 text-destructive" /> : <Clock3 className="size-6" />}</div>}
                            <span className="absolute start-2 top-2 rounded-md bg-background/90 px-2 py-1 text-[0.65rem] font-bold shadow">بعد</span>
                          </div>
                        </div>
                        <CardContent className="space-y-3 pt-4">
                          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold" dir="ltr">{item.originalFilename}</p><p className="mt-1 text-[0.65rem] text-muted-foreground">محاولات Gemini: {item.attempts}</p>{item.listingImage && <p className="mt-2 truncate text-xs font-bold text-primary">{item.listingImage.listing.title}{item.listingImage.isCover ? ' · صورة الغلاف' : ''}</p>}</div><StatusBadge status={item.status} /></div>
                          {item.errorCode && <p className="rounded-xl bg-destructive/8 p-3 text-xs leading-5 text-destructive">{errorLabels[item.errorCode] ?? item.errorCode}</p>}
                          {item.replacedAt && <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-3 text-xs font-bold text-emerald-800"><CheckCircle2 className="me-1 inline size-4" /> تم تحديث صورة الإعلان بالنسخة النظيفة.</p>}
                          {item.replacementErrorCode && <p className="rounded-xl border border-destructive/25 bg-destructive/8 p-3 text-xs leading-5 text-destructive">{errorLabels[item.replacementErrorCode] ?? item.replacementErrorCode}</p>}
                          <div className="flex flex-wrap gap-2">
                            {result && <Button render={<a href={result} download={`${item.originalFilename.replace(/\.[^.]+$/, '')}-clean.webp`} />} size="sm" className="flex-1"><Download /> تنزيل النظيفة</Button>}
                            {result && item.listingImage && !item.replacedAt && <Button variant="outline" size="sm" className="flex-1" onClick={() => applyItem(item)}><Replace /> اعتماد في الإعلان</Button>}
                            {item.replacedAt && item.listingImage && <Button variant="outline" size="sm" className="flex-1" onClick={() => restoreItem(item)}><RotateCcw /> استعادة الأصل</Button>}
                            {item.status === 'FAILED' && <Button variant="outline" size="sm" className="flex-1" onClick={() => retryItem(item)}><RotateCcw /> إعادة المحاولة</Button>}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </AnimateInView>
      <div className="h-8" />
    </PageMotion>
  );
}
