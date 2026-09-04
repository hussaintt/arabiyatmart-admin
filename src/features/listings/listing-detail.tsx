"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowRight, ArrowUp, Car, CheckCircle2, ExternalLink, FileClock, Flag, History, ImageOff, ImagePlus, Pencil, RefreshCw, RotateCcw, ShieldCheck, Star, Trash2, Zap } from "lucide-react";
import { ActionDialog } from "@/components/admin/action-dialog";
import { AdminBoostModal } from "@/features/promotions/promotions-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomSelect } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminFetch, type ApiError } from "@/lib/api";
import { adminPaths } from "@/lib/api/paths";
import { queryKeys } from "@/lib/api/query-keys";
import type { AdminCapability } from "@/lib/auth/permissions";
import { mediaUrl } from "@/lib/media";
import { uploadAdminFile } from "@/lib/uploads";
import { AdminListingDetail, formatPrice, ListingAudit, listingStatusLabels, localized, type Localized } from "./types";

type Action = "approve" | "reject" | "pause" | "unpause" | "archive" | "remove" | "delete" | "restore";
type Choice = { publicId: string; name: Localized; slug?: string };
type Generation = { publicId: string; name: string; startYear?: number; endYear?: number | null };
type Trim = { publicId: string; name: Localized; modelYear: number };
type City = { id: number; countryId: number; name: Localized; isActive: boolean };
type Area = { id: number; cityId: number; name: Localized; isActive: boolean };
type EditImage = { filePublicId: string; url: string; isCover: boolean };

const actionCopy: Record<Action, { title: string; description: string; confirm: string; reason?: boolean; destructive?: boolean }> = {
  approve: { title: "اعتماد الإعلان", description: "سيصبح الإعلان ظاهرًا في السوق وتنطلق مدة النشر.", confirm: "اعتماد ونشر" },
  reject: { title: "رفض الإعلان", description: "أدخل سببًا واضحًا ليستطيع البائع تصحيح الإعلان.", confirm: "رفض", reason: true, destructive: true },
  pause: { title: "إيقاف الإعلان", description: "سيتوقف ظهوره في السوق مع الاحتفاظ بالسجل.", confirm: "إيقاف" },
  unpause: { title: "إعادة تنشيط الإعلان", description: "سيعود الإعلان للسوق إذا سمحت حصة البائع بذلك.", confirm: "تنشيط" },
  archive: { title: "أرشفة الإعلان", description: "سيُغلق الإعلان ويظل متاحًا في السجل التشغيلي.", confirm: "أرشفة" },
  remove: { title: "إزالة الإعلان", description: "إجراء إشرافي يبقي السجل لكنه يزيل الإعلان من التداول.", confirm: "إزالة", reason: true, destructive: true },
  delete: { title: "حذف منطقي", description: "سيُخفى السجل من التشغيل المعتاد ويمكن استعادته لاحقًا.", confirm: "حذف منطقي", reason: true, destructive: true },
  restore: { title: "استعادة الإعلان", description: "سيعود الإعلان إلى طابور المراجعة، وليس مباشرة إلى السوق.", confirm: "استعادة للمراجعة", reason: true },
};

type EditState = {
  makePublicId: string; modelPublicId: string; generationPublicId: string; trimPublicId: string;
  year: string; mileageKm: string; condition: string; conditionGrade: string; price: string; currency: string;
  fuelType: string; transmission: string; bodyType: string; colorExterior: string; colorInterior: string;
  engineCc: string; powerHp: string; seats: string; drivetrain: string; vin: string; registrationStatus: string;
  cityId: string; areaId: string; lat: string; lng: string; contactPhone: string; whatsappPhone: string;
  descriptionAr: string; descriptionEn: string; features: string; images: EditImage[];
  isNegotiable: boolean; installmentAvailable: boolean; exchangeAccepted: boolean; hasWarranty: boolean; hasServiceHistory: boolean; allowChat: boolean;
};

function formatDate(value?: string | null) { return value ? new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—"; }
function optionalNumber(value: string) { return value.trim() ? Number(value) : null; }

export function ListingDetail({ publicId, capabilities }: { publicId: string; capabilities: AdminCapability[] | string[] }) {
  const queryClient = useQueryClient();
  const [edit, setEdit] = useState<EditState | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [boostOpen, setBoostOpen] = useState(false);
  const canWrite = capabilities.includes("listings:write");
  const canModerate = capabilities.includes("listings:moderate");
  const canUpload = capabilities.includes("media:write");
  const canPromote = capabilities.includes("marketing:write");
  const editing = Boolean(edit);

  const query = useQuery({ queryKey: queryKeys.listing(publicId), queryFn: () => adminFetch<{ data: AdminListingDetail }>(adminPaths.listing(publicId)) });
  const auditQuery = useQuery({ queryKey: queryKeys.listingAudit(publicId), queryFn: () => adminFetch<{ data: ListingAudit[] }>(adminPaths.listingAudit(publicId)), enabled: capabilities.includes("audit:read") });
  const listing = query.data?.data;
  const makesQuery = useQuery({ queryKey: ["admin-makes", "listing-editor"], queryFn: () => adminFetch<{ data: Choice[] }>(adminPaths.makes), enabled: editing });
  const modelsQuery = useQuery({ queryKey: ["admin-models", edit?.makePublicId], queryFn: () => adminFetch<{ data: Choice[] }>(adminPaths.models(edit!.makePublicId)), enabled: Boolean(edit?.makePublicId) });
  const generationsQuery = useQuery({ queryKey: ["admin-generations", edit?.modelPublicId], queryFn: () => adminFetch<{ data: Generation[] }>(adminPaths.generations(edit!.modelPublicId)), enabled: Boolean(edit?.modelPublicId) });
  const trimsQuery = useQuery({ queryKey: ["admin-trims", edit?.generationPublicId], queryFn: () => adminFetch<{ data: Trim[] }>(adminPaths.trims(edit!.generationPublicId)), enabled: Boolean(edit?.generationPublicId) });
  const citiesQuery = useQuery({ queryKey: ["admin-cities"], queryFn: () => adminFetch<City[]>(adminPaths.cities), enabled: editing });
  const areasQuery = useQuery({ queryKey: ["admin-areas"], queryFn: () => adminFetch<Area[]>(adminPaths.areas), enabled: editing });

  async function refreshRecord() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.listing(publicId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.listingAudit(publicId) }),
      queryClient.invalidateQueries({ queryKey: ["admin-listings"] }),
    ]);
  }

  const editMutation = useMutation({
    mutationFn: () => {
      if (!edit) throw new Error("Editor is closed");
      const cover = edit.images.find((image) => image.isCover)?.filePublicId ?? edit.images[0]?.filePublicId;
      return adminFetch<{ data: AdminListingDetail }>(adminPaths.listing(publicId), {
        method: "PATCH",
        body: JSON.stringify({
          expectedUpdatedAt: listing?.updatedAt,
          makePublicId: edit.makePublicId, modelPublicId: edit.modelPublicId,
          generationPublicId: edit.generationPublicId, trimPublicId: edit.trimPublicId,
          year: Number(edit.year), mileageKm: Number(edit.mileageKm), condition: edit.condition,
          conditionGrade: edit.conditionGrade || null, priceCents: Math.round(Number(edit.price) * 100), currency: edit.currency.toUpperCase(),
          fuelType: edit.fuelType, transmission: edit.transmission, bodyType: edit.bodyType,
          colorExterior: edit.colorExterior || null, colorInterior: edit.colorInterior || null,
          engineCc: optionalNumber(edit.engineCc), powerHp: optionalNumber(edit.powerHp), seats: optionalNumber(edit.seats),
          drivetrain: edit.drivetrain || null, vin: edit.vin || null, registrationStatus: edit.registrationStatus || null,
          cityId: Number(edit.cityId), areaId: edit.areaId ? Number(edit.areaId) : null,
          lat: optionalNumber(edit.lat), lng: optionalNumber(edit.lng), contactPhone: edit.contactPhone || null, whatsappPhone: edit.whatsappPhone || null,
          description: edit.descriptionAr || edit.descriptionEn ? { ar: edit.descriptionAr, en: edit.descriptionEn } : null,
          features: edit.features.split(/[,\n]/).map((item) => item.trim()).filter(Boolean),
          imageFilePublicIds: edit.images.map((image) => image.filePublicId), coverImagePublicId: cover,
          isNegotiable: edit.isNegotiable, installmentAvailable: edit.installmentAvailable, exchangeAccepted: edit.exchangeAccepted,
          hasWarranty: edit.hasWarranty, hasServiceHistory: edit.hasServiceHistory, allowChat: edit.allowChat,
        }),
      });
    },
    onSuccess: async () => { setEdit(null); await refreshRecord(); },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ selectedAction, reason }: { selectedAction: Action; reason: string }) => {
      if (selectedAction === "delete") return adminFetch(adminPaths.listing(publicId), { method: "DELETE", body: JSON.stringify({ reason, expectedUpdatedAt: listing?.updatedAt }) });
      if (selectedAction === "restore") return adminFetch(adminPaths.listingRestore(publicId), { method: "POST", body: JSON.stringify({ reason, expectedUpdatedAt: listing?.updatedAt }) });
      return adminFetch(adminPaths.listingTransition(publicId), { method: "POST", body: JSON.stringify({ action: selectedAction, ...(reason ? { rejectionReason: reason } : {}) }) });
    },
    onSuccess: async () => { setAction(null); setActionError(null); await refreshRecord(); },
    onError: (error: ApiError) => setActionError(error.message),
  });

  if (query.isLoading) return <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">جارٍ تحميل سجل الإعلان…</div>;
  if (query.error || !listing) return <div className="grid min-h-[60vh] place-items-center text-center"><div><p className="font-bold text-destructive">تعذّر فتح الإعلان</p><p className="mt-2 text-sm text-muted-foreground">{(query.error as ApiError)?.message}</p><Button nativeButton={false} render={<Link href="/listings" />} variant="outline" className="mt-4">العودة للإعلانات</Button></div></div>;

  const dialog = action ? actionCopy[action] : null;
  const transitions: Action[] = listing.deletedAt ? [] : listing.status === "PENDING_REVIEW" ? ["approve", "reject"] : listing.status === "ACTIVE" ? ["pause", "archive", "remove"] : listing.status === "PAUSED" ? ["unpause", "archive", "remove"] : ["remove"];
  const visibleAreas = areasQuery.data?.filter((area) => area.cityId === Number(edit?.cityId)) ?? [];

  function beginEditing() {
    setUploadError(null);
    setEdit({
      makePublicId: listing!.make.publicId, modelPublicId: listing!.model.publicId, generationPublicId: listing!.generation?.publicId ?? "", trimPublicId: listing!.trim?.publicId ?? "",
      year: String(listing!.year), mileageKm: String(listing!.mileageKm), condition: listing!.condition, conditionGrade: listing!.conditionGrade ?? "",
      price: String(listing!.priceCents / 100), currency: listing!.currency, fuelType: listing!.fuelType, transmission: listing!.transmission, bodyType: listing!.bodyType,
      colorExterior: listing!.colorExterior ?? "", colorInterior: listing!.colorInterior ?? "", engineCc: listing!.engineCc?.toString() ?? "",
      powerHp: listing!.powerHp?.toString() ?? "", seats: listing!.seats?.toString() ?? "", drivetrain: listing!.drivetrain ?? "", vin: listing!.vin ?? "",
      registrationStatus: listing!.registrationStatus ?? "", cityId: String(listing!.city.id), areaId: listing!.area?.id.toString() ?? "",
      lat: listing!.lat?.toString() ?? "", lng: listing!.lng?.toString() ?? "", contactPhone: listing!.contactPhone ?? "", whatsappPhone: listing!.whatsappPhone ?? "",
      descriptionAr: listing!.description?.ar ?? "", descriptionEn: listing!.description?.en ?? "", features: listing!.features?.join(", ") ?? "",
      images: listing!.images.map((image) => ({ filePublicId: image.filePublicId, url: mediaUrl(image.url) ?? image.url, isCover: image.isCover })),
      isNegotiable: listing!.isNegotiable, installmentAvailable: listing!.installmentAvailable, exchangeAccepted: listing!.exchangeAccepted,
      hasWarranty: listing!.hasWarranty, hasServiceHistory: listing!.hasServiceHistory, allowChat: listing!.allowChat,
    });
  }

  async function addImages(files: FileList | null) {
    if (!files || !edit) return;
    const selected = Array.from(files).slice(0, Math.max(0, 20 - edit.images.length));
    if (!selected.length) return;
    setUploading(true); setUploadError(null);
    try {
      const uploaded = await Promise.all(selected.map((file) => uploadAdminFile(file, "LISTING_IMAGE")));
      setEdit((current) => current ? ({ ...current, images: [...current.images, ...uploaded.map((file, index) => ({ filePublicId: file.publicId, url: mediaUrl(file.url) ?? URL.createObjectURL(selected[index]), isCover: current.images.length === 0 && index === 0 }))] }) : current);
    } catch (error) { setUploadError((error as ApiError).message); }
    finally { setUploading(false); }
  }

  function removeImage(index: number) {
    setEdit((current) => {
      if (!current) return current;
      const removedCover = current.images[index]?.isCover;
      const images = current.images.filter((_, itemIndex) => itemIndex !== index);
      if (removedCover && images[0]) images[0] = { ...images[0], isCover: true };
      return { ...current, images };
    });
  }

  function moveImage(index: number, delta: number) {
    setEdit((current) => {
      if (!current) return current;
      const target = index + delta;
      if (target < 0 || target >= current.images.length) return current;
      const images = [...current.images]; [images[index], images[target]] = [images[target], images[index]];
      return { ...current, images };
    });
  }

  return <div className="space-y-6 pb-10">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><Link href="/listings" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground"><ArrowRight className="size-4" /> الإعلانات</Link><div className="mt-3 flex flex-wrap items-center gap-2"><h1 className="text-2xl font-black tracking-tight md:text-3xl">{listing.title}</h1><Badge>{listingStatusLabels[listing.status] ?? listing.status}</Badge>{listing.deletedAt && <Badge variant="destructive">محذوف منطقيًا</Badge>}{listing.isDuplicate && <Badge variant="destructive">مكرر محتمل</Badge>}</div><p className="mt-2 text-xs text-muted-foreground" dir="ltr">{listing.publicId} · {listing.slug}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => query.refetch()}><RefreshCw /> تحديث</Button>{canPromote && !listing.deletedAt && <Button variant="outline" onClick={() => setBoostOpen(true)}><Zap className="size-4 text-primary" /> ترقية (Boost)</Button>}{canWrite && !listing.deletedAt && <Button variant="outline" onClick={() => editing ? setEdit(null) : beginEditing()}><Pencil /> {editing ? "إغلاق التعديل" : "تعديل كامل"}</Button>}{canModerate && transitions.map((item) => <Button key={item} variant={["reject", "remove"].includes(item) ? "destructive" : "outline"} onClick={() => setAction(item)}>{actionCopy[item].confirm}</Button>)}{canWrite && (listing.deletedAt ? <Button onClick={() => setAction("restore")}><RotateCcw /> استعادة</Button> : <Button variant="destructive" onClick={() => setAction("delete")}><Trash2 /> حذف منطقي</Button>)}</div></div>

    {listing.isDuplicate && <Notice destructive title="تنبيه تطابق محتمل" text="تم رصد هذا الإعلان كإعلان مكرر بواسطة نظام فحص التشابه، يرجى التحقق من أرقام الشاسيه ورقم الهاتف وصور السيارة قبل اعتماد الإعلان." />}
    {listing.deletionReason && <Notice destructive title="سبب الحذف" text={listing.deletionReason} />}{listing.rejectionReason && <Notice title="سبب الرفض" text={listing.rejectionReason} />}

    {edit && <ListingEditor edit={edit} setEdit={setEdit} makes={makesQuery.data?.data ?? []} models={modelsQuery.data?.data ?? []} generations={generationsQuery.data?.data ?? []} trims={trimsQuery.data?.data ?? []} cities={citiesQuery.data ?? []} areas={visibleAreas} canUpload={canUpload} uploading={uploading} uploadError={uploadError} mutationError={(editMutation.error as ApiError | null)?.message} saving={editMutation.isPending} onUpload={addImages} onRemove={removeImage} onMove={moveImage} onSave={() => editMutation.mutate()} onCancel={() => setEdit(null)} />}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,.6fr)]"><div className="space-y-6">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Car className="size-5" /> بيانات السيارة والسوق</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[["الماركة", localized(listing.make.name)], ["الموديل", localized(listing.model.name)], ["السنة", String(listing.year)], ["السعر", formatPrice(listing.priceCents, listing.currency)], ["المسافة", `${listing.mileageKm.toLocaleString("ar-EG")} كم`], ["الحالة", listing.condition], ["درجة الحالة", listing.conditionGrade ?? "—"], ["الوقود", listing.fuelType], ["ناقل الحركة", listing.transmission], ["نوع الهيكل", listing.bodyType], ["المحرك", listing.engineCc ? `${listing.engineCc} cc` : "—"], ["القوة", listing.powerHp ? `${listing.powerHp} hp` : "—"], ["الدفع", listing.drivetrain ?? "—"], ["VIN", listing.vin ?? "—"], ["المدينة", localized(listing.city.name)], ["المصدر", listing.source]].map(([label, value]) => <DataBox key={label} label={label} value={value} />)}</CardContent></Card>
      <Card><CardHeader><CardTitle>الصور والوسائط</CardTitle></CardHeader><CardContent>{listing.images.length ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{listing.images.map((image) => <div key={image.publicId} className="relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted"><img src={mediaUrl(image.url) ?? undefined} alt="" className="size-full object-cover" />{image.isCover && <Badge className="absolute end-2 top-2">غلاف</Badge>}</div>)}</div> : <div className="grid min-h-36 place-items-center text-muted-foreground"><div className="text-center"><ImageOff className="mx-auto size-7" /><p className="mt-2 text-sm">لا توجد صور</p></div></div>}</CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><History className="size-5" /> سجل السعر</CardTitle></CardHeader><CardContent>{listing.priceChanges.length ? <div className="space-y-2">{listing.priceChanges.map((change, index) => <div key={`${change.createdAt}-${index}`} className="flex items-center justify-between rounded-xl border p-3 text-sm"><span>{formatPrice(change.oldPriceCents, listing.currency)} ← <strong>{formatPrice(change.newPriceCents, listing.currency)}</strong></span><span className="text-xs text-muted-foreground">{formatDate(change.createdAt)}</span></div>)}</div> : <p className="text-sm text-muted-foreground">لا توجد تغييرات سعر مسجلة.</p>}</CardContent></Card>
    </div><div className="space-y-6">
      <Card><CardHeader><CardTitle>البائع والتواصل</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{listing.vendor ? <><Info label="المعرض" value={localized(listing.vendor.displayName)} /><Info label="البريد" value={listing.vendor.email} /><Info label="الهاتف" value={listing.vendor.phone ?? "—"} /></> : <><Info label="الاسم" value={[listing.user?.firstName, listing.user?.lastName].filter(Boolean).join(" ") || "بائع فردي"} /><Info label="البريد" value={listing.user?.email ?? "—"} /><Info label="الهاتف" value={listing.contactPhone ?? listing.user?.phone ?? "—"} /></>}</CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Flag className="size-5" /> البلاغات ({listing.reports.length.toLocaleString("ar-EG")})</CardTitle></CardHeader><CardContent>{listing.reports.length ? <div className="space-y-2">{listing.reports.map((report) => <div key={report.publicId} className="rounded-xl border p-3 text-sm"><div className="flex justify-between gap-2"><strong>{report.category}</strong><Badge variant="outline">{report.status}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{report.details || "بلا تفاصيل"}</p></div>)}</div> : <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-4" /> لا توجد بلاغات.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5" /> المصدر والأصل</CardTitle></CardHeader><CardContent>{listing.provenance.length ? <div className="space-y-3">{listing.provenance.map((source) => <div key={source.publicId} className="rounded-xl border p-3 text-sm"><p className="font-bold">{source.provider} · {source.externalId}</p><p className="mt-1 text-xs text-muted-foreground">مرجع التفويض: {source.authorizationReference}</p><a href={source.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold underline underline-offset-4">فتح المصدر <ExternalLink className="size-3" /></a></div>)}</div> : <p className="text-sm text-muted-foreground">إعلان أصلي من المنصة، ولا توجد سلسلة استيراد خارجية.</p>}</CardContent></Card>
      {capabilities.includes("audit:read") && <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileClock className="size-5" /> سجل التدقيق</CardTitle></CardHeader><CardContent>{auditQuery.isLoading ? <p className="text-sm text-muted-foreground">جارٍ التحميل…</p> : auditQuery.data?.data.length ? <div className="max-h-[32rem] space-y-2 overflow-y-auto">{auditQuery.data.data.map((entry) => <div key={entry.publicId} className="rounded-xl border p-3 text-sm"><p className="font-bold" dir="ltr">{entry.action}</p><p className="mt-1 text-xs text-muted-foreground">{entry.actor?.email ?? entry.actorRole ?? "system"} · {formatDate(entry.createdAt)}</p></div>)}</div> : <p className="text-sm text-muted-foreground">لا توجد أحداث مسجلة.</p>}</CardContent></Card>}
    </div></div>
    {dialog && <ActionDialog open={Boolean(action)} onOpenChange={(open) => { if (!open) { setAction(null); setActionError(null); } }} title={dialog.title} description={dialog.description} confirmLabel={dialog.confirm} requireReason={dialog.reason} destructive={dialog.destructive} pending={actionMutation.isPending} error={actionError} onConfirm={(reason) => { if (action) actionMutation.mutate({ selectedAction: action, reason }); }} />}
    {boostOpen && <AdminBoostModal initialListingPublicId={listing.publicId} onClose={() => setBoostOpen(false)} onSuccess={async () => { setBoostOpen(false); await refreshRecord(); }} />}
  </div>;
}

function ListingEditor(props: { edit: EditState; setEdit: (value: EditState) => void; makes: Choice[]; models: Choice[]; generations: Generation[]; trims: Trim[]; cities: City[]; areas: Area[]; canUpload: boolean; uploading: boolean; uploadError: string | null; mutationError?: string; saving: boolean; onUpload: (files: FileList | null) => void; onRemove: (index: number) => void; onMove: (index: number, delta: number) => void; onSave: () => void; onCancel: () => void }) {
  const { edit, setEdit } = props;
  const set = (key: keyof EditState, value: string | boolean) => setEdit({ ...edit, [key]: value });
  const options = {
    condition: [["NEW", "جديدة"], ["USED", "مستعملة"]], conditionGrade: [["", "بدون درجة"], ["EXCELLENT", "ممتازة"], ["VERY_GOOD", "جيدة جدًا"], ["GOOD", "جيدة"], ["FAIR", "مقبولة"], ["NEEDS_WORK", "تحتاج إصلاح"]],
    fuelType: ["PETROL", "DIESEL", "HYBRID", "ELECTRIC", "GAS"].map((value) => [value, value]), transmission: ["MANUAL", "AUTOMATIC", "CVT", "DCT"].map((value) => [value, value]),
    bodyType: ["SEDAN", "HATCHBACK", "SUV", "CROSSOVER", "COUPE", "PICKUP", "VAN", "MINIVAN", "CONVERTIBLE", "WAGON"].map((value) => [value, value]), drivetrain: [["", "—"], ["FWD", "FWD"], ["RWD", "RWD"], ["AWD", "AWD"]], registrationStatus: [["", "—"], ["LICENSED", "مرخصة"], ["UNLICENSED", "غير مرخصة"], ["TEMPORARY", "مؤقتة"], ["EXPORT", "تصدير"]],
  };
  return <Card className="border-primary/30"><CardHeader><CardTitle>التعديل الكامل للإعلان</CardTitle><p className="text-xs text-muted-foreground">تغيير السيارة أو الصور في إعلان نشط يعيده تلقائيًا إلى المراجعة لحماية السوق.</p></CardHeader><CardContent className="space-y-6">
    <EditorSection title="التصنيف والسيارة"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><SelectField label="الماركة" value={edit.makePublicId} options={props.makes.map((item) => [item.publicId, localized(item.name)])} onChange={(value) => setEdit({ ...edit, makePublicId: value, modelPublicId: "", generationPublicId: "", trimPublicId: "" })} /><SelectField label="الموديل" value={edit.modelPublicId} options={props.models.map((item) => [item.publicId, localized(item.name)])} onChange={(value) => setEdit({ ...edit, modelPublicId: value, generationPublicId: "", trimPublicId: "" })} /><SelectField label="الجيل" value={edit.generationPublicId} empty="بدون جيل" options={props.generations.map((item) => [item.publicId, item.name])} onChange={(value) => setEdit({ ...edit, generationPublicId: value, trimPublicId: "" })} /><SelectField label="الفئة" value={edit.trimPublicId} empty="بدون فئة" options={props.trims.map((item) => [item.publicId, localized(item.name)])} onChange={(value) => set("trimPublicId", value)} /><TextField label="السنة" value={edit.year} onChange={(value) => set("year", value)} type="number" /><TextField label="الكيلومترات" value={edit.mileageKm} onChange={(value) => set("mileageKm", value)} type="number" /><SelectField label="الحالة" value={edit.condition} options={options.condition} onChange={(value) => set("condition", value)} /><SelectField label="درجة الحالة" value={edit.conditionGrade} options={options.conditionGrade} onChange={(value) => set("conditionGrade", value)} /></div></EditorSection>
    <EditorSection title="السعر والمواصفات"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><TextField label="السعر" value={edit.price} onChange={(value) => set("price", value)} type="number" /><TextField label="العملة" value={edit.currency} onChange={(value) => set("currency", value.toUpperCase())} /><SelectField label="الوقود" value={edit.fuelType} options={options.fuelType} onChange={(value) => set("fuelType", value)} /><SelectField label="ناقل الحركة" value={edit.transmission} options={options.transmission} onChange={(value) => set("transmission", value)} /><SelectField label="نوع الهيكل" value={edit.bodyType} options={options.bodyType} onChange={(value) => set("bodyType", value)} /><TextField label="سعة المحرك cc" value={edit.engineCc} onChange={(value) => set("engineCc", value)} type="number" /><TextField label="القوة hp" value={edit.powerHp} onChange={(value) => set("powerHp", value)} type="number" /><TextField label="المقاعد" value={edit.seats} onChange={(value) => set("seats", value)} type="number" /><SelectField label="نظام الدفع" value={edit.drivetrain} options={options.drivetrain} onChange={(value) => set("drivetrain", value)} /><TextField label="اللون الخارجي" value={edit.colorExterior} onChange={(value) => set("colorExterior", value)} /><TextField label="اللون الداخلي" value={edit.colorInterior} onChange={(value) => set("colorInterior", value)} /><TextField label="VIN" value={edit.vin} onChange={(value) => set("vin", value.toUpperCase())} /></div></EditorSection>
    <EditorSection title="الموقع والتواصل"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><SelectField label="المدينة" value={edit.cityId} options={props.cities.map((item) => [String(item.id), localized(item.name)])} onChange={(value) => setEdit({ ...edit, cityId: value, areaId: "" })} /><SelectField label="المنطقة" value={edit.areaId} empty="بدون منطقة" options={props.areas.map((item) => [String(item.id), localized(item.name)])} onChange={(value) => set("areaId", value)} /><TextField label="Latitude" value={edit.lat} onChange={(value) => set("lat", value)} type="number" /><TextField label="Longitude" value={edit.lng} onChange={(value) => set("lng", value)} type="number" /><TextField label="هاتف التواصل" value={edit.contactPhone} onChange={(value) => set("contactPhone", value)} /><TextField label="واتساب" value={edit.whatsappPhone} onChange={(value) => set("whatsappPhone", value)} /><SelectField label="حالة الترخيص" value={edit.registrationStatus} options={options.registrationStatus} onChange={(value) => set("registrationStatus", value)} /></div></EditorSection>
    <EditorSection title="الوصف والمزايا"><div className="grid gap-4 sm:grid-cols-2"><AreaField label="الوصف العربي" value={edit.descriptionAr} onChange={(value) => set("descriptionAr", value)} /><AreaField label="الوصف الإنجليزي" value={edit.descriptionEn} onChange={(value) => set("descriptionEn", value)} ltr /></div><AreaField label="المزايا — افصل بفاصلة أو سطر" value={edit.features} onChange={(value) => set("features", value)} /></EditorSection>
    <EditorSection title="خيارات السوق"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[["isNegotiable", "قابل للتفاوض"], ["installmentAvailable", "تقسيط متاح"], ["exchangeAccepted", "يقبل البدل"], ["hasWarranty", "يوجد ضمان"], ["hasServiceHistory", "سجل صيانة"], ["allowChat", "المحادثة متاحة"]].map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold"><input type="checkbox" checked={Boolean(edit[key as keyof EditState])} onChange={(event) => set(key as keyof EditState, event.target.checked)} className="size-4 accent-foreground" />{label}</label>)}</div></EditorSection>
    <EditorSection title={`الصور (${edit.images.length}/20)`}><div className="mb-3 flex items-center gap-3"><Label htmlFor="listing-images" className="h-10 cursor-pointer rounded-xl border px-4 font-bold"><ImagePlus /> {props.uploading ? "جارٍ الرفع…" : "إضافة صور"}</Label><input id="listing-images" type="file" className="sr-only" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif" disabled={!props.canUpload || props.uploading || edit.images.length >= 20} onChange={(event) => props.onUpload(event.target.files)} />{!props.canUpload && <span className="text-xs text-muted-foreground">صلاحية الوسائط مطلوبة.</span>}</div><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{edit.images.map((image, index) => <div key={`${image.filePublicId}-${index}`} className="space-y-2 rounded-xl border p-2"><div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted"><img src={image.url} alt="" className="size-full object-cover" />{image.isCover && <Badge className="absolute end-2 top-2">غلاف</Badge>}</div><div className="flex justify-center gap-1"><Button type="button" size="icon-xs" variant="outline" disabled={index === 0} onClick={() => props.onMove(index, -1)}><ArrowUp /></Button><Button type="button" size="icon-xs" variant="outline" disabled={index === edit.images.length - 1} onClick={() => props.onMove(index, 1)}><ArrowDown /></Button><Button type="button" size="icon-xs" variant={image.isCover ? "default" : "outline"} onClick={() => setEdit({ ...edit, images: edit.images.map((item, itemIndex) => ({ ...item, isCover: itemIndex === index })) })}><Star /></Button><Button type="button" size="icon-xs" variant="destructive" onClick={() => props.onRemove(index)}><Trash2 /></Button></div></div>)}</div></EditorSection>
    {(props.uploadError || props.mutationError) && <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{props.uploadError ?? props.mutationError}</p>}
    <div className="sticky bottom-0 z-20 -mx-6 flex justify-end gap-2 border-t bg-card/95 px-6 py-4 backdrop-blur"><Button variant="outline" onClick={props.onCancel}>إلغاء</Button><Button onClick={props.onSave} disabled={props.saving || props.uploading || !edit.makePublicId || !edit.modelPublicId || !edit.cityId || !Number(edit.price)}>{props.saving ? "جارٍ الحفظ…" : "حفظ كل التغييرات"}</Button></div>
  </CardContent></Card>;
}

function EditorSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="space-y-4 border-b pb-6 last:border-0 last:pb-0"><h3 className="text-sm font-black">{title}</h3>{children}</section>; }
function TextField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { const id = useId(); return <Field label={label} htmlFor={id}><Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></Field>; }
function AreaField({ label, value, onChange, ltr }: { label: string; value: string; onChange: (value: string) => void; ltr?: boolean }) { const id = useId(); return <Field label={label} htmlFor={id}><textarea id={id} dir={ltr ? "ltr" : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-28 w-full rounded-xl border bg-background p-3 text-sm" /></Field>; }
function SelectField({ label, value, options, onChange, empty }: { label: string; value: string; options: string[][]; onChange: (value: string) => void; empty?: string }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <CustomSelect
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        emptyOption={empty}
        options={options.map(([optVal, optLabel]) => ({ value: optVal, label: optLabel }))}
      />
    </Field>
  );
}
function Field({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) { return <div className="space-y-2"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>; }
function DataBox({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-muted/20 p-3"><p className="text-[0.68rem] font-bold text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-3 last:border-0 last:pb-0"><span className="text-muted-foreground">{label}</span><strong className="text-end" dir={label === "البريد" ? "ltr" : undefined}>{value}</strong></div>; }
function Notice({ title, text, destructive }: { title: string; text: string; destructive?: boolean }) { return <div className={`rounded-xl border p-4 text-sm ${destructive ? "border-destructive/30 bg-destructive/5" : "border-amber-500/30 bg-amber-500/5"}`}><strong>{title}:</strong> {text}</div>; }
