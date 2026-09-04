'use client';

import { useMemo, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  ImageOff,
  Images,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react';
import { adminFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CustomSelect } from '@/components/ui/custom-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

type ListingImageState = 'CLEAN' | 'UNCLEAN' | 'PROCESSING' | 'FAILED' | 'CONFLICT';
type InventoryFilter = 'ALL' | 'UNCLEAN' | 'CLEAN' | 'PROCESSING' | 'FAILED';

type ListingImage = {
  publicId: string;
  filename: string;
  imageUrl: string;
  isCover: boolean;
  sortOrder: number;
  state: ListingImageState;
  isClean: boolean;
  canProcess: boolean;
  latestBatchPublicId: string | null;
  latestItemPublicId: string | null;
  lastErrorCode: string | null;
  updatedAt: string;
};

type InventoryListing = {
  publicId: string;
  slug: string;
  title: string;
  status: string;
  sellerName: string | null;
  totalImages: number;
  cleanImages: number;
  uncleanImages: number;
  allClean: boolean;
  images: ListingImage[];
};

type InventoryResponse = {
  summary: {
    totalListings: number;
    fullyCleanListings: number;
    uncleanListings: number;
    totalImages: number;
    cleanImages: number;
    uncleanImages: number;
    processingImages: number;
    failedImages: number;
  };
  data: InventoryListing[];
  meta: { nextCursor: string | null; hasMore: boolean };
};

type CreatedBatch = { publicId: string; totalItems: number };

const filterLabels: Record<InventoryFilter, string> = {
  UNCLEAN: 'تحتاج تنظيف',
  PROCESSING: 'قيد المعالجة',
  FAILED: 'تحتاج تدخل',
  CLEAN: 'نظيفة بالكامل',
  ALL: 'كل الإعلانات',
};

const stateLabels: Record<ListingImageState, string> = {
  CLEAN: 'نظيفة',
  UNCLEAN: 'غير نظيفة',
  PROCESSING: 'تُعالج الآن',
  FAILED: 'فشلت',
  CONFLICT: 'تغيّر المصدر',
};

const listingStatusLabels: Record<string, string> = {
  ACTIVE: 'نشط',
  PENDING_REVIEW: 'قيد المراجعة',
  DRAFT: 'مسودة',
  PAUSED: 'متوقف',
  REJECTED: 'مرفوض',
  EXPIRED: 'منتهي',
  SOLD: 'مباع',
  ARCHIVED: 'مؤرشف',
  REMOVED: 'محذوف',
};

function mediaUrl(path: string) {
  return `/api/backend${path}`;
}

function StateBadge({ state }: { state: ListingImageState }) {
  return (
    <Badge
      variant={state === 'FAILED' || state === 'CONFLICT' ? 'destructive' : state === 'CLEAN' ? 'default' : 'secondary'}
      className={cn(state === 'CLEAN' && 'bg-emerald-600 text-white')}
    >
      {state === 'PROCESSING' ? <Loader2 className="animate-spin" /> : state === 'CLEAN' ? <CheckCircle2 /> : state === 'UNCLEAN' ? <CircleDashed /> : <AlertTriangle />}
      {stateLabels[state]}
    </Badge>
  );
}

function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Images; tone: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-3 py-4">
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', tone)}><Icon className="size-4" /></span>
        <div>
          <p className="text-xl font-black tabular-nums">{new Intl.NumberFormat('ar-EG').format(value)}</p>
          <p className="text-[0.7rem] text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function GeminiListingImageControl({ onBatchCreated, onOpenBatch }: { onBatchCreated: (batchId: string) => void; onOpenBatch: (batchId: string) => void }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<InventoryFilter>('UNCLEAN');
  const [listingStatus, setListingStatus] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addWatermark, setAddWatermark] = useState(true);
  const [watermarkText, setWatermarkText] = useState('عربيات مارت');
  const [replaceCurrentImages, setReplaceCurrentImages] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  const inventoryQuery = useInfiniteQuery({
    queryKey: ['gemini-listing-images', filter, listingStatus, search],
    initialPageParam: '',
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ state: filter, limit: '12' });
      if (listingStatus) params.set('listingStatus', listingStatus);
      if (search) params.set('q', search);
      if (pageParam) params.set('cursor', pageParam);
      return adminFetch<InventoryResponse>(`/v1/admin/gemini-listing-images?${params}`);
    },
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    refetchInterval: 8_000,
  });

  const listings = useMemo(
    () => inventoryQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [inventoryQuery.data],
  );
  const summary = inventoryQuery.data?.pages[0]?.summary;
  const eligibleIds = useMemo(
    () => listings.flatMap((listing) => listing.images.filter((image) => image.canProcess).map((image) => image.publicId)),
    [listings],
  );
  const selectedCount = selected.size;

  function toggleImage(publicId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(publicId)) next.delete(publicId);
      else if (next.size < 50) next.add(publicId);
      return next;
    });
  }

  function selectListing(listing: InventoryListing) {
    const ids = listing.images.filter((image) => image.canProcess).map((image) => image.publicId);
    setSelected((current) => {
      const next = new Set(current);
      const shouldSelect = ids.some((id) => !next.has(id));
      for (const id of ids) {
        if (shouldSelect && next.size < 50) next.add(id);
        else if (!shouldSelect) next.delete(id);
      }
      return next;
    });
  }

  async function runSelected() {
    setNotice(null);
    if (!selectedCount) {
      setNotice({ text: 'اختر صورة واحدة على الأقل.', error: true });
      return;
    }
    if (addWatermark && !watermarkText.trim()) {
      setNotice({ text: 'أدخل نص العلامة الجديدة أو عطّل إضافتها.', error: true });
      return;
    }
    setIsSubmitting(true);
    try {
      const batch = await adminFetch<CreatedBatch>('/v1/admin/gemini-batches/from-listings', {
        method: 'POST',
        body: JSON.stringify({
          listingImagePublicIds: [...selected],
          addWatermark,
          watermarkText: addWatermark ? watermarkText.trim() : null,
          replaceCurrentImages,
        }),
      });
      setSelected(new Set());
      setNotice({
        text: replaceCurrentImages
          ? `بدأ تنظيف ${batch.totalItems} صورة. سيتم تحديث صور الإعلانات تلقائيًا بعد نجاح كل صورة.`
          : `بدأ تنظيف ${batch.totalItems} صورة للمعاينة فقط دون تحديث الإعلانات.`,
        error: false,
      });
      onBatchCreated(batch.publicId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['gemini-listing-images'] }),
        queryClient.invalidateQueries({ queryKey: ['gemini-batches'] }),
      ]);
    } catch (error) {
      setNotice({ text: (error as Error).message, error: true });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-5">
      <Card className="border-primary/20 bg-gradient-to-bl from-primary/[0.06] via-card to-card">
        <CardHeader className="border-b border-border/60">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><WandSparkles className="size-5 text-primary" /> مركز التحكم بصور الإعلانات</CardTitle>
              <CardDescription className="mt-2">اعرف فورًا أي الإعلانات ما زالت تستخدم صورًا غير منظفة، ثم نظفها وحدّث الصور الحالية بأمان.</CardDescription>
            </div>
            <Button variant="outline" onClick={() => inventoryQuery.refetch()} disabled={inventoryQuery.isFetching}>
              <RefreshCw className={cn(inventoryQuery.isFetching && 'animate-spin')} /> فحص الصور الآن
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {summary ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="إعلانات تحتاج تنظيف" value={summary.uncleanListings} icon={ImageOff} tone="bg-amber-500/12 text-amber-700" />
              <SummaryCard label="صور غير نظيفة" value={summary.uncleanImages} icon={Images} tone="bg-destructive/10 text-destructive" />
              <SummaryCard label="تُعالج الآن" value={summary.processingImages} icon={Loader2} tone="bg-sky-500/12 text-sky-700" />
              <SummaryCard label="إعلانات نظيفة بالكامل" value={summary.fullyCleanListings} icon={ShieldCheck} tone="bg-emerald-500/12 text-emerald-700" />
            </div>
          ) : <div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-xl" />)}</div>}

          <div className="flex flex-wrap gap-2">
            {(Object.keys(filterLabels) as InventoryFilter[]).map((value) => (
              <Button key={value} size="sm" variant={filter === value ? 'default' : 'outline'} onClick={() => { setFilter(value); setSelected(new Set()); }}>
                {filterLabels[value]}
              </Button>
            ))}
          </div>

          <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]" onSubmit={(event) => { event.preventDefault(); setSearch(searchDraft.trim()); setSelected(new Set()); }}>
            <div className="relative">
              <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} className="pe-10" placeholder="ابحث برقم الإعلان أو الرابط أو الماركة…" />
            </div>
            <CustomSelect
              value={listingStatus}
              onChange={(event) => { setListingStatus(event.target.value); setSelected(new Set()); }}
              emptyOption="كل حالات الإعلان"
              options={Object.entries(listingStatusLabels).map(([value, label]) => ({ value, label }))}
            />
            <Button type="submit" variant="secondary"><Search /> بحث</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_330px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
            <div>
              <p className="text-sm font-bold">تم اختيار {selectedCount} من 50 صورة كحد أقصى</p>
              <p className="mt-1 text-[0.68rem] text-muted-foreground">يمكن اختيار إعلان كامل أو صور محددة منه.</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={!eligibleIds.length} onClick={() => setSelected(new Set(eligibleIds.slice(0, 50)))}><Check /> اختيار الظاهر</Button>
              <Button size="sm" variant="ghost" disabled={!selectedCount} onClick={() => setSelected(new Set())}><X /> إلغاء الاختيار</Button>
            </div>
          </div>

          {inventoryQuery.isLoading && Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-72 rounded-2xl" />)}
          {inventoryQuery.error && <p className="rounded-xl border border-destructive/30 bg-destructive/8 p-4 text-sm text-destructive">{(inventoryQuery.error as Error).message}</p>}
          {!inventoryQuery.isLoading && !listings.length && (
            <Card><CardContent className="flex min-h-56 flex-col items-center justify-center text-center"><CheckCircle2 className="size-9 text-emerald-600" /><p className="mt-3 font-bold">لا توجد إعلانات مطابقة</p><p className="mt-1 text-xs text-muted-foreground">جرّب تغيير الفلتر أو حالة الإعلان.</p></CardContent></Card>
          )}

          {listings.map((listing) => {
            const processable = listing.images.filter((image) => image.canProcess);
            const listingSelected = processable.length > 0 && processable.every((image) => selected.has(image.publicId));
            return (
              <Card key={listing.publicId} className="overflow-hidden">
                <CardHeader className="border-b border-border/60 bg-muted/20 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><CardTitle className="truncate text-base">{listing.title}</CardTitle>{listing.allClean ? <Badge className="bg-emerald-600 text-white"><CheckCircle2 /> مكتمل</Badge> : <Badge variant="secondary">{listing.uncleanImages} تحتاج تنظيف</Badge>}{listing.images.some((image) => image.isCover && !image.isClean) && <Badge variant="destructive">صورة الغلاف غير نظيفة</Badge>}</div>
                      <CardDescription className="mt-2"><span dir="ltr">{listing.publicId}</span> · {listingStatusLabels[listing.status] ?? listing.status}{listing.sellerName ? ` · ${listing.sellerName}` : ''}</CardDescription>
                    </div>
                    <Button size="sm" variant={listingSelected ? 'default' : 'outline'} disabled={!processable.length} onClick={() => selectListing(listing)}>
                      {listingSelected ? <Check /> : <Images />} {listingSelected ? 'تم اختيار الإعلان' : `اختيار ${processable.length} صورة`}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-3">
                  {listing.images.map((image) => (
                    <button
                      type="button"
                      key={image.publicId}
                      disabled={!image.canProcess}
                      onClick={() => toggleImage(image.publicId)}
                      className={cn('group overflow-hidden rounded-xl border text-start transition', selected.has(image.publicId) ? 'border-primary ring-2 ring-primary/20' : 'border-border/70', image.canProcess ? 'hover:border-primary/60' : 'cursor-default opacity-85')}
                    >
                      <div className="relative aspect-[4/3] bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element -- authenticated backend image */}
                        <img src={mediaUrl(image.imageUrl)} alt={image.filename} className="size-full object-cover" />
                        <span className={cn('absolute end-2 top-2 grid size-7 place-items-center rounded-lg border bg-background/90 shadow', selected.has(image.publicId) && 'border-primary bg-primary text-primary-foreground')}>
                          {selected.has(image.publicId) ? <Check className="size-4" /> : image.canProcess ? null : image.state === 'PROCESSING' ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                        </span>
                        {image.isCover && <span className="absolute start-2 top-2 rounded-md bg-background/90 px-2 py-1 text-[0.65rem] font-bold shadow">الغلاف</span>}
                      </div>
                      <div className="space-y-2 p-3">
                        <div className="flex items-center justify-between gap-2"><StateBadge state={image.state} /><span className="truncate text-[0.65rem] text-muted-foreground" dir="ltr">#{image.sortOrder + 1}</span></div>
                        <p className="truncate text-xs font-semibold" dir="ltr">{image.filename}</p>
                        {image.lastErrorCode && <p className="truncate text-[0.65rem] text-destructive" dir="ltr">{image.lastErrorCode}</p>}
                        {image.latestBatchPublicId && <span role="button" tabIndex={0} className="block text-[0.65rem] font-bold text-primary hover:underline" onClick={(event) => { event.stopPropagation(); onOpenBatch(image.latestBatchPublicId!); }}>عرض آخر دفعة</span>}
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            );
          })}

          {inventoryQuery.hasNextPage && <Button variant="outline" className="w-full" onClick={() => inventoryQuery.fetchNextPage()} disabled={inventoryQuery.isFetchingNextPage}>{inventoryQuery.isFetchingNextPage ? <Loader2 className="animate-spin" /> : <ChevronDown />} تحميل إعلانات أخرى</Button>}
        </div>

        <Card className="h-fit xl:sticky xl:top-5">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="flex items-center gap-2"><Sparkles className="size-5" /> إعداد التنظيف</CardTitle>
            <CardDescription>يُستخدم نفس الطلب لكل الصور المحددة.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-muted/25 p-3">
              <input type="checkbox" checked={replaceCurrentImages} onChange={(event) => setReplaceCurrentImages(event.target.checked)} className="mt-1 size-4 accent-primary" />
              <span><span className="block text-sm font-bold">تحديث صور الإعلانات تلقائيًا</span><span className="mt-1 block text-[0.68rem] leading-5 text-muted-foreground">يتم الاستبدال بعد نجاح كل صورة مع الاحتفاظ بالأصل للاستعادة.</span></span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-muted/25 p-3">
              <input type="checkbox" checked={addWatermark} onChange={(event) => setAddWatermark(event.target.checked)} className="mt-1 size-4 accent-primary" />
              <span><span className="block text-sm font-bold">إضافة العلامة الجديدة</span><span className="mt-1 block text-[0.68rem] leading-5 text-muted-foreground">عطّلها لإزالة العلامات القديمة فقط.</span></span>
            </label>
            {addWatermark && <div className="space-y-2"><Label htmlFor="listing-watermark">نص العلامة</Label><Input id="listing-watermark" value={watermarkText} onChange={(event) => setWatermarkText(event.target.value)} maxLength={80} /></div>}
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3 text-[0.7rem] leading-5 text-emerald-900"><ShieldCheck className="mb-2 size-4" />لن يُستبدل أي ملف إذا تغيّر أثناء عمل Gemini. ستبقى النتيجة متاحة لاعتمادها يدويًا.</div>
            <Button size="lg" className="w-full" onClick={runSelected} disabled={isSubmitting || !selectedCount || (addWatermark && !watermarkText.trim())}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : <WandSparkles />}
              {isSubmitting ? 'جارٍ إنشاء الدفعة…' : `تنظيف ${selectedCount} صورة`}
            </Button>
            {notice && <p className={cn('rounded-xl border p-3 text-xs leading-6', notice.error ? 'border-destructive/30 bg-destructive/8 text-destructive' : 'border-emerald-500/30 bg-emerald-500/8 text-emerald-800')}>{notice.text}</p>}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
