"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  ExternalLink,
  Image as ImageIcon,
  ImagePlus,
  Layers,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminFetch, type ApiError } from "@/lib/api";
import { adminPaths } from "@/lib/api/paths";
import { mediaUrl } from "@/lib/media";
import { uploadAdminFile } from "@/lib/uploads";
import { date, ErrorState, Header, Loading } from "@/features/people/users-list";

// --- Types ---

export type BannerPosition = "HOME_HERO" | "HOME_STRIP" | "CATEGORY_HEADER" | "CATEGORIES_FEATURED";

export type Banner = {
  publicId: string;
  imageFileId?: string;
  imageFile?: { publicId: string; key: string; url?: string } | null;
  title: { ar: string; en: string } | string;
  subtitle?: { ar: string; en: string } | string | null;
  badgeLabel?: { ar: string; en: string } | string | null;
  linkTarget?: string | null;
  position: BannerPosition;
  sortOrder: number;
  isActive: boolean;
  displayFrom?: string | null;
  displayUntil?: string | null;
  createdAt: string;
};

const POSITION_LABELS: Record<BannerPosition, string> = {
  HOME_HERO: "الرئيسية - البانر الكبير (Hero)",
  HOME_STRIP: "الرئيسية - شريط إعلاني (Strip)",
  CATEGORY_HEADER: "رأس صفحات التصنيفات (Header)",
  CATEGORIES_FEATURED: "عروض مميزة في التصنيفات (Featured)",
};

function parseText(value: { ar?: string; en?: string } | string | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed.ar || parsed.en || value;
    } catch {
      return value;
    }
  }
  return value.ar || value.en || "";
}

export function BannersControl({
  canWrite,
}: {
  canWrite: boolean;
}) {
  const client = useQueryClient();
  const [selectedPosition, setSelectedPosition] = useState<string>("ALL");
  const [editingBanner, setEditingBanner] = useState<Banner | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null);

  const queryUrl = selectedPosition !== "ALL"
    ? `${adminPaths.banners}?position=${selectedPosition}`
    : adminPaths.banners;

  const query = useQuery({
    queryKey: ["admin-banners", selectedPosition],
    queryFn: () => adminFetch<Banner[]>(queryUrl),
  });

  const deleteMutation = useMutation({
    mutationFn: (publicId: string) =>
      adminFetch(adminPaths.banner(publicId), { method: "DELETE" }),
    onSuccess: async () => {
      setDeleteTarget(null);
      await client.invalidateQueries({ queryKey: ["admin-banners"] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ publicId, isActive }: { publicId: string; isActive: boolean }) =>
      adminFetch(adminPaths.banner(publicId), {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["admin-banners"] });
    },
  });

  const banners = query.data ?? [];
  const activeCount = banners.filter((b) => b.isActive).length;

  return (
    <div className="space-y-6 pb-12">
      <Header
        title="البنرات الإعلانية والتسويق"
        description="التحكم الكامل في الحملات الترويجية والبنرات الإعلانية في الصفحة الرئيسية وصفحات التصنيفات وتحديد فترات العرض."
        onRefresh={() => query.refetch()}
        refreshing={query.isFetching}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard title="إجمالي البنرات" value={banners.length} icon={Megaphone} />
        <MetricCard title="البنرات النشطة حالياً" value={activeCount} icon={Layers} variant="success" />
        <MetricCard
          title="بنرات غير مفعلة"
          value={banners.length - activeCount}
          icon={ImageIcon}
          variant="warning"
        />
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>قائمة البنرات الإعلانية</CardTitle>
              <CardDescription>فرز حسب الموقع وإعادة ترتيب الظهور</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={selectedPosition} onValueChange={setSelectedPosition}>
                <TabsList className="h-10">
                  <TabsTrigger value="ALL">الكل</TabsTrigger>
                  <TabsTrigger value="HOME_HERO">الرئيسية (Hero)</TabsTrigger>
                  <TabsTrigger value="HOME_STRIP">شريط (Strip)</TabsTrigger>
                  <TabsTrigger value="CATEGORY_HEADER">التصنيفات</TabsTrigger>
                  <TabsTrigger value="CATEGORIES_FEATURED">عروض مميزة</TabsTrigger>
                </TabsList>
              </Tabs>
              {canWrite && (
                <Button onClick={() => setEditingBanner("new")}>
                  <Plus className="me-1 size-4" /> إضافة بانر جديد
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {query.isLoading ? (
            <Loading />
          ) : query.error ? (
            <ErrorState error={query.error as ApiError} />
          ) : banners.length === 0 ? (
            <div className="grid min-h-56 place-items-center text-center p-6">
              <div>
                <Megaphone className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-2 font-bold">لا توجد بنرات إعلانية في هذا القسم</p>
                {canWrite && (
                  <Button variant="outline" className="mt-3" onClick={() => setEditingBanner("new")}>
                    إنشاء بانر الآن
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">المعاينة</TableHead>
                    <TableHead>العنوان</TableHead>
                    <TableHead>الموقع</TableHead>
                    <TableHead>الرابط المستهدف</TableHead>
                    <TableHead>الترتيب</TableHead>
                    <TableHead>فترة العرض</TableHead>
                    <TableHead>الحالة</TableHead>
                    {canWrite && <TableHead className="text-end">الإجراءات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {banners.map((banner) => {
                    const imgUrl = banner.imageFile?.key
                      ? mediaUrl(banner.imageFile.key)
                      : banner.imageFile?.url;
                    const arTitle = parseText(banner.title);
                    const arSubtitle = parseText(banner.subtitle);
                    const badgeText = parseText(banner.badgeLabel);

                    return (
                      <TableRow key={banner.publicId}>
                        <TableCell>
                          <div className="relative h-14 w-24 overflow-hidden rounded-lg border bg-muted">
                            {imgUrl ? (
                              <img src={imgUrl} alt="" className="size-full object-cover" />
                            ) : (
                              <div className="grid size-full place-items-center text-muted-foreground">
                                <ImageIcon className="size-4" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold">{arTitle || "بلا عنوان"}</span>
                              {badgeText && (
                                <Badge variant="outline" className="text-[0.65rem] border-primary text-primary">
                                  {badgeText}
                                </Badge>
                              )}
                            </div>
                            {arSubtitle && (
                              <p className="text-xs text-muted-foreground line-clamp-1">{arSubtitle}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {POSITION_LABELS[banner.position] || banner.position}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono" dir="ltr">
                          {banner.linkTarget ? (
                            <span className="flex items-center gap-1 text-primary">
                              <ExternalLink className="size-3" /> {banner.linkTarget}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="font-bold">{banner.sortOrder}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {banner.displayFrom || banner.displayUntil ? (
                            <div className="space-y-0.5">
                              <p>من: {date(banner.displayFrom)}</p>
                              <p>إلى: {date(banner.displayUntil)}</p>
                            </div>
                          ) : (
                            "دائم"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={banner.isActive ? "default" : "secondary"}>
                            {banner.isActive ? "نشط" : "متوقف"}
                          </Badge>
                        </TableCell>
                        {canWrite && (
                          <TableCell className="text-end">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  toggleActiveMutation.mutate({
                                    publicId: banner.publicId,
                                    isActive: !banner.isActive,
                                  })
                                }
                                disabled={toggleActiveMutation.isPending}
                              >
                                {banner.isActive ? "إيقاف" : "تفعيل"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingBanner(banner)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setDeleteTarget(banner)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
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

      {editingBanner && (
        <BannerEditorModal
          banner={editingBanner === "new" ? null : editingBanner}
          onClose={() => setEditingBanner(null)}
          onSuccess={async () => {
            setEditingBanner(null);
            await client.invalidateQueries({ queryKey: ["admin-banners"] });
          }}
        />
      )}

      {deleteTarget && (
        <Dialog open onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>حذف البانر الإعلاني</DialogTitle>
              <DialogDescription>
                هل أنت متأكد من رغبتك في حذف هذا البانر بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border bg-muted/40 p-3 text-xs">
              <p><strong>العنوان:</strong> {parseText(deleteTarget.title)}</p>
              <p><strong>الموقع:</strong> {POSITION_LABELS[deleteTarget.position]}</p>
            </div>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                إلغاء
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget.publicId)}
              >
                {deleteMutation.isPending ? "جارٍ الحذف…" : "تأكيد الحذف"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function BannerEditorModal({
  banner,
  onClose,
  onSuccess,
}: {
  banner: Banner | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = Boolean(banner);

  const initialTitle = typeof banner?.title === "object" ? banner.title : { ar: String(banner?.title ?? ""), en: "" };
  const initialSubtitle = typeof banner?.subtitle === "object" ? banner.subtitle : { ar: String(banner?.subtitle ?? ""), en: "" };
  const initialBadge = typeof banner?.badgeLabel === "object" ? banner.badgeLabel : { ar: String(banner?.badgeLabel ?? ""), en: "" };

  const [titleAr, setTitleAr] = useState(initialTitle.ar || "");
  const [titleEn, setTitleEn] = useState(initialTitle.en || "");
  const [subAr, setSubAr] = useState(initialSubtitle?.ar || "");
  const [subEn, setSubEn] = useState(initialSubtitle?.en || "");
  const [badgeAr, setBadgeAr] = useState(initialBadge?.ar || "");
  const [badgeEn, setBadgeEn] = useState(initialBadge?.en || "");
  const [linkTarget, setLinkTarget] = useState(banner?.linkTarget ?? "");
  const [position, setPosition] = useState<BannerPosition>(banner?.position ?? "HOME_HERO");
  const [sortOrder, setSortOrder] = useState(String(banner?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(banner?.isActive ?? true);
  const [displayFrom, setDisplayFrom] = useState(
    banner?.displayFrom ? banner.displayFrom.split("T")[0] : ""
  );
  const [displayUntil, setDisplayUntil] = useState(
    banner?.displayUntil ? banner.displayUntil.split("T")[0] : ""
  );

  const [imageFileId, setImageFileId] = useState<string | null>(
    banner?.imageFile?.publicId ?? banner?.imageFileId ?? null
  );
  const [imagePreview, setImagePreview] = useState<string | null>(
    banner?.imageFile?.key
      ? mediaUrl(banner.imageFile.key)
      : banner?.imageFile?.url ?? null
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleImageUpload(file?: File) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const uploaded = await uploadAdminFile(file, "BANNER_IMAGE");
      setImageFileId(uploaded.publicId);
      setImagePreview(mediaUrl(uploaded.url) ?? URL.createObjectURL(file));
    } catch (err: any) {
      setUploadError(err?.message || "تعذر رفع صورة البانر");
    } finally {
      setUploading(false);
    }
  }

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        title: { ar: titleAr.trim(), en: titleEn.trim() || titleAr.trim() },
        subtitle: subAr.trim() ? { ar: subAr.trim(), en: subEn.trim() || subAr.trim() } : null,
        badgeLabel: badgeAr.trim() ? { ar: badgeAr.trim(), en: badgeEn.trim() || badgeAr.trim() } : null,
        linkTarget: linkTarget.trim() || undefined,
        position,
        sortOrder: Number(sortOrder) || 0,
        isActive,
        displayFrom: displayFrom ? new Date(displayFrom).toISOString() : undefined,
        displayUntil: displayUntil ? new Date(displayUntil).toISOString() : undefined,
        ...(imageFileId ? { imageFileId } : {}),
      };

      if (isEdit && banner) {
        return adminFetch(adminPaths.banner(banner.publicId), {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        if (!imageFileId) throw new Error("يجب رفع صورة للبانر");
        return adminFetch(adminPaths.banners, {
          method: "POST",
          body: JSON.stringify({ ...body, imageFileId }),
        });
      }
    },
    onSuccess,
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل البانر الإعلاني" : "إنشاء بانر إعلاني جديد"}</DialogTitle>
          <DialogDescription>
            قم برفع الصورة وتحديد النصوص وروابط التوجيه ومواعيد العرض
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Image Upload Area */}
          <div className="space-y-2">
            <Label>صورة البانر</Label>
            <div className="relative flex aspect-[21/9] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-muted/30">
              {imagePreview ? (
                <img src={imagePreview} alt="" className="size-full object-cover" />
              ) : (
                <div className="text-center text-muted-foreground p-4">
                  <ImagePlus className="mx-auto size-8" />
                  <p className="mt-1 text-xs font-semibold">اضغط لرفع صورة بنقاء عالي</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Label
                htmlFor="banner-file"
                className="cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-muted"
              >
                {uploading ? "جارٍ الرفع…" : "اختيار صورة"}
              </Label>
              <input
                id="banner-file"
                type="file"
                className="sr-only"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(e) => handleImageUpload(e.target.files?.[0])}
              />
              {imageFileId && (
                <span className="text-xs text-emerald-600 font-bold">تم رفع الصورة بنجاح ✓</span>
              )}
            </div>
            {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>العنوان الرئيسي (عربي)</Label>
              <Input
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
                placeholder="مثال: خصومات كبرى على الهايبرد"
              />
            </div>
            <div className="space-y-1">
              <Label>العنوان الرئيسي (إنجليزي)</Label>
              <Input
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                placeholder="Major Hybrid Discounts"
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>الوصف الفرعي (عربي)</Label>
              <Input
                value={subAr}
                onChange={(e) => setSubAr(e.target.value)}
                placeholder="تصفح أكثر من 500 سيارة معتمدة"
              />
            </div>
            <div className="space-y-1">
              <Label>الوصف الفرعي (إنجليزي)</Label>
              <Input
                value={subEn}
                onChange={(e) => setSubEn(e.target.value)}
                placeholder="Browse 500+ certified cars"
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>شارة ترويجية (عربي)</Label>
              <Input
                value={badgeAr}
                onChange={(e) => setBadgeAr(e.target.value)}
                placeholder="عرض حصري / لفترة محدودة"
              />
            </div>
            <div className="space-y-1">
              <Label>شارة ترويجية (إنجليزي)</Label>
              <Input
                value={badgeEn}
                onChange={(e) => setBadgeEn(e.target.value)}
                placeholder="Exclusive / Limited Time"
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>موقع البانر</Label>
              <CustomSelect
                value={position}
                onChange={(e) => setPosition(e.target.value as BannerPosition)}
                options={[
                  { value: "HOME_HERO", label: "الرئيسية - البانر الرئيسي (Hero)" },
                  { value: "HOME_STRIP", label: "الرئيسية - شريط إعلاني (Strip)" },
                  { value: "CATEGORY_HEADER", label: "رأس صفحات التصنيفات (Header)" },
                  { value: "CATEGORIES_FEATURED", label: "عروض مميزة في التصنيفات (Featured)" },
                ]}
              />
            </div>
            <div className="space-y-1">
              <Label>ترتيب الظهور (Sort Order)</Label>
              <Input
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>الرابط المستهدف (Link Target)</Label>
            <Input
              value={linkTarget}
              onChange={(e) => setLinkTarget(e.target.value)}
              placeholder="مثال: /listings?condition=NEW أو https://example.com"
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>تاريخ بدء العرض</Label>
              <Input
                type="date"
                value={displayFrom}
                onChange={(e) => setDisplayFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>تاريخ انتهاء العرض</Label>
              <Input
                type="date"
                value={displayUntil}
                onChange={(e) => setDisplayUntil(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <input
              type="checkbox"
              id="banner-is-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-4 rounded border-input"
            />
            <Label htmlFor="banner-is-active" className="cursor-pointer font-bold">
              البانر نشط وجاهز للعرض في التطبيق والموقع فوراً
            </Label>
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
            disabled={mutation.isPending || uploading || !titleAr.trim() || (!isEdit && !imageFileId)}
          >
            {mutation.isPending ? "جارٍ الحفظ…" : "حفظ البانر"}
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
  icon: typeof Megaphone;
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
