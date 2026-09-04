"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Ban, Building2, CheckCircle2, ImageUp, Pencil, ShieldCheck, Trash2, UsersRound, XCircle } from "lucide-react";
import { ActionDialog } from "@/components/admin/action-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomSelect } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminFetch, type ApiError } from "@/lib/api";
import { adminPaths } from "@/lib/api/paths";
import { queryKeys } from "@/lib/api/query-keys";
import { mediaUrl } from "@/lib/media";
import { uploadAdminFile } from "@/lib/uploads";
import { Dealer, dealerName } from "./types";
import { date, ErrorState, Loading } from "./users-list";

type Verification = { publicId: string; documentType: string; status: string; rejectionReason?: string | null; createdAt: string };
type Country = { id: number; code: string; name: { ar?: string; en?: string }; isActive: boolean };
type City = { id: number; countryId: number; name: { ar?: string; en?: string }; isActive: boolean };
type ReviewTarget = { verificationId: string; status: "APPROVED" | "REJECTED" };
type DealerAction = "suspend" | "reinstate" | "approve" | "reject";
type MediaValue = { publicId?: string | null; preview: string | null };

type DealerForm = {
  slug: string; legalName: string; nameAr: string; nameEn: string; descriptionAr: string; descriptionEn: string;
  email: string; phone: string; storeType: string; defaultCurrency: string; businessAddressLine: string;
  businessCountryId: string; businessCityId: string; businessPostalCode: string; businessPhone: string;
  commercialRegisterNumber: string; taxId: string; logo: MediaValue; banner: MediaValue;
};

const emptyForm: DealerForm = {
  slug: "", legalName: "", nameAr: "", nameEn: "", descriptionAr: "", descriptionEn: "", email: "", phone: "",
  storeType: "INDIVIDUAL", defaultCurrency: "EGP", businessAddressLine: "", businessCountryId: "", businessCityId: "",
  businessPostalCode: "", businessPhone: "", commercialRegisterNumber: "", taxId: "", logo: { preview: null }, banner: { preview: null },
};

export function DealerDetail({ publicId, canWrite, canKyc, canBilling, canUpload, canReadLocations }: {
  publicId: string; canWrite: boolean; canKyc: boolean; canBilling: boolean; canUpload: boolean; canReadLocations: boolean;
}) {
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [dealerAction, setDealerAction] = useState<DealerAction | null>(null);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [form, setForm] = useState<DealerForm>(emptyForm);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"logo" | "banner" | null>(null);

  const query = useQuery({ queryKey: queryKeys.dealer(publicId), queryFn: () => adminFetch<Dealer>(adminPaths.dealer(publicId)) });
  const dealer = query.data;
  const verificationQuery = useQuery({ queryKey: ["dealer-verifications", publicId], queryFn: () => adminFetch<Verification[]>(adminPaths.dealerVerifications(publicId)), enabled: canKyc });
  const billingQuery = useQuery({ queryKey: ["dealer-billing", publicId], queryFn: () => adminFetch<BillingData>(adminPaths.dealerBilling(publicId)), enabled: canBilling });
  const countriesQuery = useQuery({ queryKey: ["admin-countries"], queryFn: () => adminFetch<Country[]>(adminPaths.countries), enabled: canReadLocations && editing });
  const citiesQuery = useQuery({ queryKey: ["admin-cities"], queryFn: () => adminFetch<City[]>(adminPaths.cities), enabled: canReadLocations && editing });

  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.dealer(publicId) }),
      client.invalidateQueries({ queryKey: ["admin-dealers"] }),
      client.invalidateQueries({ queryKey: ["dealer-verifications", publicId] }),
    ]);
  };

  const update = useMutation({
    mutationFn: () => adminFetch(adminPaths.dealer(publicId), {
      method: "PATCH",
      body: JSON.stringify({
        expectedUpdatedAt: dealer?.updatedAt,
        slug: form.slug, legalName: form.legalName,
        displayName: { ar: form.nameAr, en: form.nameEn },
        description: form.descriptionAr || form.descriptionEn ? { ar: form.descriptionAr, en: form.descriptionEn } : null,
        email: form.email, phone: form.phone || null, storeType: form.storeType, defaultCurrency: form.defaultCurrency.toUpperCase(),
        businessAddressLine: form.businessAddressLine || null,
        businessCountryId: form.businessCountryId ? Number(form.businessCountryId) : null,
        businessCityId: form.businessCityId ? Number(form.businessCityId) : null,
        businessPostalCode: form.businessPostalCode || null, businessPhone: form.businessPhone || null,
        commercialRegisterNumber: form.commercialRegisterNumber || null, taxId: form.taxId || null,
        ...(form.logo.publicId !== undefined ? { logoImageFileId: form.logo.publicId } : {}),
        ...(form.banner.publicId !== undefined ? { bannerImageFileId: form.banner.publicId } : {}),
      }),
    }),
    onSuccess: async () => { setEditing(false); await refresh(); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ action, reason }: { action: DealerAction; reason: string }) => {
      if (action === "suspend" || action === "reinstate") {
        return adminFetch(action === "suspend" ? adminPaths.dealerSuspend(publicId) : adminPaths.dealerReinstate(publicId), {
          method: "POST",
          body: JSON.stringify(action === "suspend" ? { reason, notifyVendor: true, force: true } : { notes: reason }),
        });
      }
      return adminFetch(adminPaths.dealerStatus(publicId), {
        method: "PATCH", body: JSON.stringify({ status: action === "approve" ? "APPROVED" : "REJECTED", notes: reason || undefined }),
      });
    },
    onSuccess: async () => { setDealerAction(null); await refresh(); },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ target, reason }: { target: ReviewTarget; reason: string }) => adminFetch(adminPaths.verificationReview(target.verificationId), {
      method: "PATCH", body: JSON.stringify({ status: target.status, ...(reason ? { rejectionReason: reason } : {}) }),
    }),
    onSuccess: async () => { setReviewTarget(null); await refresh(); },
  });

  if (query.isLoading) return <Loading />;
  if (query.error || !dealer) return <ErrorState error={query.error as ApiError} />;

  function beginEdit() {
    setForm({
      slug: dealer!.slug, legalName: dealer!.legalName, nameAr: dealer!.displayName.ar ?? "", nameEn: dealer!.displayName.en ?? "",
      descriptionAr: dealer!.description?.ar ?? "", descriptionEn: dealer!.description?.en ?? "", email: dealer!.email,
      phone: dealer!.phone ?? "", storeType: dealer!.storeType, defaultCurrency: dealer!.defaultCurrency,
      businessAddressLine: dealer!.businessAddressLine ?? "", businessCountryId: dealer!.businessCountryId?.toString() ?? "",
      businessCityId: dealer!.businessCityId?.toString() ?? "", businessPostalCode: dealer!.businessPostalCode ?? "",
      businessPhone: dealer!.businessPhone ?? "", commercialRegisterNumber: dealer!.commercialRegisterNumber ?? "", taxId: dealer!.taxId ?? "",
      logo: { preview: mediaUrl(dealer!.logoUrl) }, banner: { preview: mediaUrl(dealer!.bannerUrl) },
    });
    setUploadError(null);
    setEditing(true);
  }

  async function handleUpload(kind: "logo" | "banner", file?: File) {
    if (!file) return;
    setUploadError(null); setUploading(kind);
    try {
      const uploaded = await uploadAdminFile(file, kind === "logo" ? "VENDOR_LOGO" : "VENDOR_BANNER");
      setForm((current) => ({ ...current, [kind]: { publicId: uploaded.publicId, preview: mediaUrl(uploaded.url) ?? URL.createObjectURL(file) } }));
    } catch (error) {
      setUploadError((error as ApiError).message);
    } finally { setUploading(null); }
  }

  const visibleCities = citiesQuery.data?.filter((city) => !form.businessCountryId || city.countryId === Number(form.businessCountryId)) ?? [];
  const actionCopy = dealerAction ? {
    suspend: ["إيقاف المعرض", "سيتم إيقاف المعرض فورًا، وإيقاف كل الإعلانات النشطة وإبطال جلسات فريقه. لن تُعاد الإعلانات للنشر تلقائيًا.", "إيقاف المعرض والإعلانات", true, true],
    reinstate: ["إعادة تشغيل المعرض", "سيعود المعرض إلى التشغيل بعد تسجيل الملاحظة.", "إعادة التشغيل", true, false],
    approve: ["اعتماد المعرض", "سيصبح المعرض معتمدًا ويمكنه العمل في السوق.", "اعتماد", false, false],
    reject: ["رفض المعرض", "سجّل سببًا واضحًا لرفض طلب المعرض.", "رفض", true, true],
  }[dealerAction] as [string, string, string, boolean, boolean] : null;

  return <div className="space-y-6 pb-10">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div><Link href="/dealers" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground"><ArrowRight className="size-4" /> المعارض</Link><div className="mt-3 flex items-center gap-3"><span className="grid size-14 place-items-center overflow-hidden rounded-2xl border bg-muted">{mediaUrl(dealer.logoUrl) ? <img src={mediaUrl(dealer.logoUrl) ?? undefined} alt="" className="size-full object-cover" /> : <Building2 />}</span><div><h1 className="text-2xl font-black">{dealerName(dealer)}</h1><p className="text-xs text-muted-foreground" dir="ltr">{dealer.publicId}</p></div><Badge variant={dealer.status === "APPROVED" ? "default" : dealer.status === "SUSPENDED" || dealer.status === "REJECTED" ? "destructive" : "secondary"}>{dealer.status}</Badge></div></div>
      {canWrite && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => editing ? setEditing(false) : beginEdit()}><Pencil /> تعديل كامل</Button>{dealer.status === "PENDING" && <><Button onClick={() => setDealerAction("approve")}><CheckCircle2 /> اعتماد</Button><Button variant="destructive" onClick={() => setDealerAction("reject")}><XCircle /> رفض</Button></>}{dealer.status === "SUSPENDED" ? <Button onClick={() => setDealerAction("reinstate")}><CheckCircle2 /> إعادة</Button> : dealer.status === "APPROVED" && <Button variant="destructive" onClick={() => setDealerAction("suspend")}><Ban /> إيقاف</Button>}</div>}
    </div>

    {mediaUrl(dealer.bannerUrl) && !editing && <div className="relative aspect-[4/1] min-h-36 overflow-hidden rounded-2xl border bg-muted"><img src={mediaUrl(dealer.bannerUrl) ?? undefined} alt="غلاف المعرض" className="size-full object-cover" /></div>}

    <div className="grid gap-6 xl:grid-cols-[1fr_24rem]"><div className="space-y-6">
      <Card><CardHeader><CardTitle>ملف المعرض</CardTitle></CardHeader><CardContent>{editing ? <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2"><MediaEditor id="dealer-logo" label="شعار المعرض" value={form.logo} uploading={uploading === "logo"} disabled={!canUpload} onFile={(file) => handleUpload("logo", file)} onClear={() => setForm({ ...form, logo: { publicId: null, preview: null } })} /><MediaEditor id="dealer-banner" label="صورة الغلاف" value={form.banner} uploading={uploading === "banner"} disabled={!canUpload} onFile={(file) => handleUpload("banner", file)} onClear={() => setForm({ ...form, banner: { publicId: null, preview: null } })} wide /></div>
        <section className="space-y-4"><h3 className="text-sm font-black">الهوية والبيانات العامة</h3><div className="grid gap-4 sm:grid-cols-2"><TextField label="الاسم العربي" value={form.nameAr} set={(value) => setForm({ ...form, nameAr: value })} /><TextField label="الاسم الإنجليزي" value={form.nameEn} set={(value) => setForm({ ...form, nameEn: value })} ltr /><TextField label="الاسم القانوني" value={form.legalName} set={(value) => setForm({ ...form, legalName: value })} /><TextField label="الرابط المختصر" value={form.slug} set={(value) => setForm({ ...form, slug: value.toLowerCase() })} ltr /><TextField label="البريد" value={form.email} set={(value) => setForm({ ...form, email: value })} ltr /><TextField label="الهاتف" value={form.phone} set={(value) => setForm({ ...form, phone: value })} ltr /><NativeSelect label="نوع المعرض" value={form.storeType} set={(value) => setForm({ ...form, storeType: value })} options={[["INDIVIDUAL", "فردي"], ["COMPANY", "شركة"], ["SUPPLIER", "مورد"]]} /><TextField label="العملة" value={form.defaultCurrency} set={(value) => setForm({ ...form, defaultCurrency: value.toUpperCase() })} ltr maxLength={3} /></div><div className="grid gap-4 sm:grid-cols-2"><AreaField label="الوصف العربي" value={form.descriptionAr} set={(value) => setForm({ ...form, descriptionAr: value })} /><AreaField label="الوصف الإنجليزي" value={form.descriptionEn} set={(value) => setForm({ ...form, descriptionEn: value })} ltr /></div></section>
        <section className="space-y-4"><h3 className="text-sm font-black">العنوان والبيانات التجارية</h3><div className="grid gap-4 sm:grid-cols-2"><TextField label="عنوان النشاط" value={form.businessAddressLine} set={(value) => setForm({ ...form, businessAddressLine: value })} /><NativeSelect label="الدولة" value={form.businessCountryId} set={(value) => setForm({ ...form, businessCountryId: value, businessCityId: "" })} options={(countriesQuery.data ?? []).map((country) => [String(country.id), country.name.ar || country.name.en || country.code])} empty="بدون دولة" /><NativeSelect label="المدينة" value={form.businessCityId} set={(value) => setForm({ ...form, businessCityId: value })} options={visibleCities.map((city) => [String(city.id), city.name.ar || city.name.en || String(city.id)])} empty="بدون مدينة" /><TextField label="الرمز البريدي" value={form.businessPostalCode} set={(value) => setForm({ ...form, businessPostalCode: value })} /><TextField label="هاتف النشاط" value={form.businessPhone} set={(value) => setForm({ ...form, businessPhone: value })} ltr /><TextField label="رقم السجل التجاري" value={form.commercialRegisterNumber} set={(value) => setForm({ ...form, commercialRegisterNumber: value })} ltr /><TextField label="الرقم الضريبي" value={form.taxId} set={(value) => setForm({ ...form, taxId: value })} ltr /></div></section>
        {(uploadError || update.error) && <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{uploadError ?? (update.error as ApiError).message}</p>}
        <div className="sticky bottom-0 z-20 -mx-6 flex justify-end gap-2 border-t bg-card/95 px-6 py-4 backdrop-blur"><Button variant="outline" onClick={() => setEditing(false)}>إلغاء</Button><Button onClick={() => update.mutate()} disabled={update.isPending || Boolean(uploading) || !form.nameAr || !form.legalName || !form.email}>{update.isPending ? "جارٍ الحفظ…" : "حفظ كل التغييرات"}</Button></div>
      </div> : <div className="grid gap-3 sm:grid-cols-2"><Info label="الاسم القانوني" value={dealer.legalName} /><Info label="الرابط" value={dealer.slug} /><Info label="البريد" value={dealer.email} /><Info label="الهاتف" value={dealer.phone ?? "—"} /><Info label="النوع" value={dealer.storeType} /><Info label="العملة" value={dealer.defaultCurrency} /><Info label="العنوان" value={dealer.businessAddressLine ?? "—"} /><Info label="المدينة" value={dealer.businessCity?.name.ar || dealer.businessCity?.name.en || "—"} /><Info label="هاتف النشاط" value={dealer.businessPhone ?? "—"} /><Info label="السجل التجاري" value={dealer.commercialRegisterNumber ?? "—"} /><Info label="الرقم الضريبي" value={dealer.taxId ?? "—"} /><Info label="تاريخ الاعتماد" value={date(dealer.approvedAt)} /></div>}</CardContent></Card>

      {canKyc && <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5" /> مستندات التحقق</CardTitle></CardHeader><CardContent>{verificationQuery.isLoading ? <p className="text-sm text-muted-foreground">جارٍ التحميل…</p> : verificationQuery.data?.length ? <div className="space-y-2">{verificationQuery.data.map((item) => <div key={item.publicId} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"><div><strong>{item.documentType}</strong><p className="mt-1 text-xs text-muted-foreground">{date(item.createdAt)}</p>{item.rejectionReason && <p className="mt-1 text-xs text-destructive">{item.rejectionReason}</p>}</div><div className="flex items-center gap-2"><Badge variant={item.status === "APPROVED" ? "default" : item.status === "REJECTED" ? "destructive" : "secondary"}>{item.status}</Badge>{item.status === "PENDING" && <><Button size="sm" onClick={() => setReviewTarget({ verificationId: item.publicId, status: "APPROVED" })}>اعتماد</Button><Button size="sm" variant="destructive" onClick={() => setReviewTarget({ verificationId: item.publicId, status: "REJECTED" })}>رفض</Button></>}</div></div>)}</div> : <p className="text-sm text-muted-foreground">لا توجد مستندات.</p>}</CardContent></Card>}
    </div><div className="space-y-6"><Card><CardHeader><CardTitle>مؤشرات المعرض</CardTitle></CardHeader><CardContent className="space-y-3"><Metric icon={Building2} label="الإعلانات" value={dealer._count.listings} /><Metric icon={UsersRound} label="أعضاء الفريق" value={dealer._count.members} /><Metric icon={ShieldCheck} label="التقييمات" value={dealer.reviewCount} /></CardContent></Card>{canBilling && <BillingCard loading={billingQuery.isLoading} data={billingQuery.data} />}</div></div>

    {actionCopy && <ActionDialog open={Boolean(dealerAction)} onOpenChange={(open) => { if (!open) setDealerAction(null); }} title={actionCopy[0]} description={actionCopy[1]} confirmLabel={actionCopy[2]} requireReason={actionCopy[3]} destructive={actionCopy[4]} pending={statusMutation.isPending} error={(statusMutation.error as ApiError | null)?.message} onConfirm={(reason) => { if (dealerAction) statusMutation.mutate({ action: dealerAction, reason }); }} />}
    {reviewTarget && <ActionDialog open title={reviewTarget.status === "APPROVED" ? "اعتماد المستند" : "رفض المستند"} description={reviewTarget.status === "APPROVED" ? "سيُسجّل المستند كمستند تحقق معتمد." : "اكتب سبب الرفض ليتمكن صاحب المعرض من التصحيح."} confirmLabel={reviewTarget.status === "APPROVED" ? "اعتماد" : "رفض"} requireReason={reviewTarget.status === "REJECTED"} destructive={reviewTarget.status === "REJECTED"} pending={reviewMutation.isPending} error={(reviewMutation.error as ApiError | null)?.message} onOpenChange={(open) => { if (!open) setReviewTarget(null); }} onConfirm={(reason) => reviewMutation.mutate({ target: reviewTarget, reason })} />}
  </div>;
}

function MediaEditor({ id, label, value, uploading, disabled, onFile, onClear, wide = false }: { id: string; label: string; value: MediaValue; uploading: boolean; disabled: boolean; onFile: (file?: File) => void; onClear: () => void; wide?: boolean }) {
  return <div className="space-y-2"><Label>{label}</Label><div className={`relative overflow-hidden rounded-xl border bg-muted ${wide ? "aspect-[3/1]" : "aspect-square max-h-48"}`}>{value.preview ? <img src={value.preview} alt="" className="size-full object-cover" /> : <div className="grid size-full min-h-32 place-items-center text-muted-foreground"><ImageUp /></div>}</div><div className="flex gap-2"><Label htmlFor={id} className="h-9 cursor-pointer rounded-lg border px-3 text-xs font-bold">{uploading ? "جارٍ الرفع…" : "رفع صورة"}</Label><input id={id} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || uploading} onChange={(event) => onFile(event.target.files?.[0])} /><Button type="button" size="sm" variant="destructive" disabled={!value.preview} onClick={onClear}><Trash2 /> حذف</Button></div>{disabled && <p className="text-xs text-muted-foreground">صلاحية رفع الوسائط مطلوبة.</p>}</div>;
}
function TextField({ label, value, set, ltr, maxLength }: { label: string; value: string; set: (value: string) => void; ltr?: boolean; maxLength?: number }) { const id = useId(); return <Field label={label} htmlFor={id}><Input id={id} dir={ltr ? "ltr" : undefined} value={value} maxLength={maxLength} onChange={(event) => set(event.target.value)} /></Field>; }
function AreaField({ label, value, set, ltr }: { label: string; value: string; set: (value: string) => void; ltr?: boolean }) { const id = useId(); return <Field label={label} htmlFor={id}><textarea id={id} dir={ltr ? "ltr" : undefined} value={value} onChange={(event) => set(event.target.value)} className="min-h-28 w-full rounded-xl border bg-background p-3 text-sm" /></Field>; }
function NativeSelect({ label, value, set, options, empty }: { label: string; value: string; set: (value: string) => void; options: string[][]; empty?: string }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <CustomSelect
        id={id}
        value={value}
        onChange={(event) => set(event.target.value)}
        emptyOption={empty}
        options={options.map(([optVal, optLabel]) => ({ value: optVal, label: optLabel }))}
      />
    </Field>
  );
}
function Field({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) { return <div className="space-y-2"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words font-semibold">{value}</p></div>; }
function Metric({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: number }) { return <div className="flex items-center gap-3 rounded-xl border p-3"><Icon className="size-4" /><span>{label}</span><strong className="ms-auto">{value.toLocaleString("ar-EG")}</strong></div>; }

type BillingData = { billingAccount?: Record<string, unknown> | null; recentInvoices?: Array<Record<string, unknown>>; recentPayments?: Array<Record<string, unknown>> };
function BillingCard({ loading, data }: { loading: boolean; data?: BillingData }) {
  const account = data?.billingAccount;
  return <Card><CardHeader><CardTitle>الاشتراك والفوترة</CardTitle></CardHeader><CardContent className="space-y-3">{loading ? <p className="text-sm text-muted-foreground">جارٍ التحميل…</p> : <><Info label="حالة الحساب" value={String(account?.status ?? "لا يوجد حساب فوترة")} /><Info label="الفواتير الحديثة" value={String(data?.recentInvoices?.length ?? 0)} /><Info label="المدفوعات الحديثة" value={String(data?.recentPayments?.length ?? 0)} /></>}</CardContent></Card>;
}
