"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CarFront, ChevronLeft, CirclePlus, Layers3, Pencil, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminFetch, type ApiError } from "@/lib/api";
import { adminPaths } from "@/lib/api/paths";
import { Header } from "@/features/people/users-list";
import { mediaUrl } from "@/lib/media";
import { uploadAdminFile } from "@/lib/uploads";

type Localized = { ar?: string; en?: string };
type Make = { publicId: string; slug: string; name: Localized; countryOfOrigin: string | null; isActive: boolean; sortOrder: number; activeListingCount?: number; logoUrl?: string | null };
type Model = { publicId: string; slug: string; name: Localized; bodyType: string | null; vehicleType?: string; isActive: boolean; sortOrder: number };
type Generation = { publicId: string; name: string; startYear: number; endYear: number | null };
type Trim = { publicId: string; name: Localized; modelYear: number; officialPriceCents: number | null; marketPriceCents: number | null; currency: string; engineCc: number | null; powerHp: number | null; isActive: boolean };
type Entity = { kind: "make"; value?: Make } | { kind: "model"; value?: Model } | { kind: "generation"; value?: Generation } | { kind: "trim"; value?: Trim };
const name = (value: Localized) => value.ar || value.en || "—";

export function TaxonomyControl({ canWrite }: { canWrite: boolean }) {
  const [make, setMake] = useState<Make | null>(null); const [model, setModel] = useState<Model | null>(null); const [generation, setGeneration] = useState<Generation | null>(null); const [trim, setTrim] = useState<Trim | null>(null); const [editor, setEditor] = useState<Entity | null>(null);
  const makes = useQuery({ queryKey: ["taxonomy-makes"], queryFn: () => adminFetch<{ data: Make[] }>(adminPaths.makes) });
  const models = useQuery({ queryKey: ["taxonomy-models", make?.publicId], queryFn: () => adminFetch<{ data: Model[] }>(adminPaths.models(make!.publicId)), enabled: Boolean(make) });
  const generations = useQuery({ queryKey: ["taxonomy-generations", model?.publicId], queryFn: () => adminFetch<{ data: Generation[] }>(adminPaths.generations(model!.publicId)), enabled: Boolean(model) });
  const trims = useQuery({ queryKey: ["taxonomy-trims", generation?.publicId], queryFn: () => adminFetch<{ data: Trim[] }>(adminPaths.trims(generation!.publicId)), enabled: Boolean(generation) });
  const refresh = () => Promise.all([makes.refetch(), models.refetch(), generations.refetch(), trims.refetch()]);
  return <div className="space-y-6 pb-10"><Header title="بيانات السوق والسيارات" description="تحكم في العلامات، الموديلات، الأجيال، الفئات، والمراجع السعرية المستخدمة في كل إعلان." onRefresh={() => { void refresh(); }} refreshing={[makes, models, generations, trims].some((query) => query.isFetching)} />
    <div className="grid gap-4 xl:grid-cols-4">
      <TaxonomyColumn title="العلامات" icon={CarFront} items={makes.data?.data ?? []} selected={make?.publicId} render={(item: Make) => <div className="flex items-center gap-2.5 min-w-0">{item.logoUrl ? <img src={mediaUrl(item.logoUrl) ?? item.logoUrl} alt="" className="size-7 shrink-0 rounded-md object-contain border bg-background p-0.5" /> : <div className="size-7 shrink-0 rounded-md bg-muted grid place-items-center text-xs font-bold">{name(item.name).slice(0, 1)}</div>}<div className="min-w-0 flex-1"><strong className="block truncate">{name(item.name)}</strong><span className="text-xs text-muted-foreground block truncate">{item.slug} · {(item.activeListingCount ?? 0).toLocaleString("ar-EG")}</span></div></div>} onSelect={(item: Make) => { setMake(item); setModel(null); setGeneration(null); setTrim(null); }} onCreate={canWrite ? () => setEditor({ kind: "make" }) : undefined} onEdit={canWrite ? (item: Make) => setEditor({ kind: "make", value: item }) : undefined} />
      <TaxonomyColumn title="الموديلات" icon={Tags} empty={make ? "لا توجد موديلات." : "اختر علامة أولًا."} items={models.data?.data ?? []} selected={model?.publicId} render={(item: Model) => <><strong>{name(item.name)}</strong><span className="text-xs text-muted-foreground">{item.bodyType ?? item.vehicleType ?? "—"}</span></>} onSelect={(item: Model) => { setModel(item); setGeneration(null); setTrim(null); }} onCreate={canWrite && make ? () => setEditor({ kind: "model" }) : undefined} onEdit={canWrite ? (item: Model) => setEditor({ kind: "model", value: item }) : undefined} />
      <TaxonomyColumn title="الأجيال" icon={Layers3} empty={model ? "لا توجد أجيال." : "اختر موديلًا أولًا."} items={generations.data?.data ?? []} selected={generation?.publicId} render={(item: Generation) => <><strong>{item.name}</strong><span className="text-xs text-muted-foreground">{item.startYear} — {item.endYear ?? "الآن"}</span></>} onSelect={(item: Generation) => { setGeneration(item); setTrim(null); }} onCreate={canWrite && model ? () => setEditor({ kind: "generation" }) : undefined} onEdit={canWrite ? (item: Generation) => setEditor({ kind: "generation", value: item }) : undefined} />
      <TaxonomyColumn title="الفئات والأسعار" icon={ChevronLeft} empty={generation ? "لا توجد فئات." : "اختر جيلًا أولًا."} items={trims.data?.data ?? []} selected={trim?.publicId} render={(item: Trim) => <><strong>{name(item.name)} · {item.modelYear}</strong><span className="text-xs text-muted-foreground">{item.officialPriceCents ? `${(item.officialPriceCents / 100).toLocaleString("ar-EG")} ${item.currency}` : "بلا سعر رسمي"}</span></>} onSelect={setTrim} onCreate={canWrite && generation ? () => setEditor({ kind: "trim" }) : undefined} onEdit={canWrite ? (item: Trim) => setEditor({ kind: "trim", value: item }) : undefined} />
    </div>
    <TaxonomyEditor entity={editor} onOpenChange={(open) => { if (!open) setEditor(null); }} parent={{ make, model, generation }} onSaved={async () => { setEditor(null); await refresh(); }} />
  </div>;
}

function TaxonomyColumn<T extends { publicId: string; isActive?: boolean }>({ title, icon: Icon, items, selected, render, onSelect, onCreate, onEdit, empty = "لا توجد بيانات." }: { title: string; icon: typeof CarFront; items: T[]; selected?: string; render: (item: T) => React.ReactNode; onSelect: (item: T) => void; onCreate?: () => void; onEdit?: (item: T) => void; empty?: string }) {
  return <Card className="min-h-[32rem]"><CardHeader className="border-b"><div className="flex items-center gap-2"><Icon className="size-4" /><CardTitle className="text-base">{title}</CardTitle>{onCreate && <Button size="icon-sm" variant="outline" className="ms-auto" onClick={onCreate} aria-label={`إضافة ${title}`}><CirclePlus /></Button>}</div></CardHeader><CardContent className="space-y-2 p-3">{items.map((item) => <div key={item.publicId} className={`group flex items-center gap-2 rounded-xl border p-1 ${selected === item.publicId ? "border-foreground bg-muted" : "border-border/60"}`}><button onClick={() => onSelect(item)} className="flex min-w-0 flex-1 flex-col items-start rounded-lg p-2 text-start">{render(item)}</button>{item.isActive === false && <Badge variant="outline">موقوف</Badge>}{onEdit && <Button size="icon-sm" variant="ghost" className="opacity-60 group-hover:opacity-100" onClick={() => onEdit(item)}><Pencil /></Button>}</div>)}{!items.length && <p className="py-16 text-center text-sm text-muted-foreground">{empty}</p>}</CardContent></Card>;
}

function TaxonomyEditor({ entity, onOpenChange, parent, onSaved }: { entity: Entity | null; onOpenChange: (open: boolean) => void; parent: { make: Make | null; model: Model | null; generation: Generation | null }; onSaved: () => Promise<void> }) {
  return <Dialog open={Boolean(entity)} onOpenChange={onOpenChange}>{entity && <EditorForm key={`${entity.kind}-${entity.value?.publicId ?? "new"}`} entity={entity} parent={parent} onSaved={onSaved} onCancel={() => onOpenChange(false)} />}</Dialog>;
}

function EditorForm({ entity, parent, onSaved, onCancel }: { entity: Entity; parent: { make: Make | null; model: Model | null; generation: Generation | null }; onSaved: () => Promise<void>; onCancel: () => void }) {
  const client = useQueryClient();
  const current = entity.value;
  const raw = (current ?? {}) as unknown as Record<string, unknown>;
  const localized = raw.name && typeof raw.name === "object" ? raw.name as Localized : {};
  const money = (value: unknown) => typeof value === "number" && value > 0 ? String(value / 100) : "";
  const [logoFilePublicId, setLogoFilePublicId] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>((raw.logoUrl as string) ?? null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [form, setForm] = useState({
    nameAr: localized.ar ?? "", nameEn: localized.en ?? "", name: typeof raw.name === "string" ? raw.name : "",
    slug: String(raw.slug ?? ""), country: String(raw.countryOfOrigin ?? ""), bodyType: String(raw.bodyType ?? ""),
    startYear: String(raw.startYear ?? ""), endYear: String(raw.endYear ?? ""), modelYear: String(raw.modelYear ?? ""),
    officialPrice: money(raw.officialPriceCents), marketPrice: money(raw.marketPriceCents), currency: String(raw.currency ?? "EGP"),
    engineCc: String(raw.engineCc ?? ""), powerHp: String(raw.powerHp ?? ""), isActive: raw.isActive === undefined ? true : Boolean(raw.isActive),
  });
  const mutation = useMutation({ mutationFn: () => {
    const derivedSlug = form.slug.trim() || form.nameEn.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    let path = ""; let body: Record<string, unknown> = {};
    if (entity.kind === "make") { path = current ? adminPaths.make(current.publicId) : adminPaths.makes; body = { name: { ar: form.nameAr, en: form.nameEn }, slug: derivedSlug, countryOfOrigin: form.country || undefined, isActive: form.isActive, ...(logoFilePublicId ? { logoFilePublicId } : {}) }; }
    if (entity.kind === "model") { path = current ? adminPaths.model(current.publicId) : adminPaths.models(parent.make!.publicId); body = { name: { ar: form.nameAr, en: form.nameEn }, slug: derivedSlug, bodyType: form.bodyType || undefined, isActive: form.isActive }; }
    if (entity.kind === "generation") { path = current ? adminPaths.generation(current.publicId) : adminPaths.generations(parent.model!.publicId); body = { name: form.name, startYear: Number(form.startYear), endYear: form.endYear ? Number(form.endYear) : undefined }; }
    if (entity.kind === "trim") { path = current ? adminPaths.trim(current.publicId) : adminPaths.trims(parent.generation!.publicId); body = { name: { ar: form.nameAr, en: form.nameEn }, modelYear: Number(form.modelYear), engineCc: form.engineCc ? Number(form.engineCc) : undefined, powerHp: form.powerHp ? Number(form.powerHp) : undefined, officialPriceCents: form.officialPrice ? Math.round(Number(form.officialPrice) * 100) : undefined, marketPriceCents: form.marketPrice ? Math.round(Number(form.marketPrice) * 100) : undefined, currency: form.currency, isActive: form.isActive }; }
    return adminFetch(path, { method: current ? "PATCH" : "POST", body: JSON.stringify(body) });
  }, onSuccess: async () => { await client.invalidateQueries({ queryKey: ["taxonomy"] }); await onSaved(); } });
  const labels = { make: "علامة", model: "موديل", generation: "جيل", trim: "فئة" };
  return <DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{current ? "تعديل" : "إضافة"} {labels[entity.kind]}</DialogTitle><DialogDescription>كل تغيير يُسجل في سجل التدقيق ويظهر في نماذج الإعلانات.</DialogDescription></DialogHeader><div className="grid max-h-[60vh] gap-4 overflow-y-auto p-1 sm:grid-cols-2">
    {entity.kind === "make" && <div className="sm:col-span-2 flex items-center gap-4 rounded-xl border p-3 bg-muted/20">
      <div className="size-14 rounded-lg border bg-background grid place-items-center overflow-hidden shrink-0">
        {logoPreview ? <img src={mediaUrl(logoPreview) ?? logoPreview} alt="" className="size-full object-contain p-1" /> : <CarFront className="size-6 text-muted-foreground" />}
      </div>
      <div className="space-y-1">
        <Label htmlFor="make-logo-file" className="cursor-pointer font-bold text-xs border rounded-md px-3 py-1.5 inline-block hover:bg-muted">
          {uploadingLogo ? "جارٍ الرفع…" : "رفع شعار الماركة"}
        </Label>
        <input id="make-logo-file" type="file" className="sr-only" accept="image/png,image/svg+xml,image/webp,image/jpeg" disabled={uploadingLogo} onChange={async (e) => {
          const file = e.target.files?.[0]; if (!file) return; setUploadingLogo(true);
          try { const uploaded = await uploadAdminFile(file, "VEHICLE_MAKE_LOGO"); setLogoFilePublicId(uploaded.publicId); setLogoPreview(mediaUrl(uploaded.url) ?? URL.createObjectURL(file)); }
          catch { /* ignore */ } finally { setUploadingLogo(false); }
        }} />
        <p className="text-[0.68rem] text-muted-foreground">صيغة SVG أو PNG شفافة بدقة عالية</p>
      </div>
    </div>}
    {entity.kind !== "generation" && <><Field label="الاسم العربي"><Input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} /></Field><Field label="الاسم الإنجليزي"><Input dir="ltr" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} /></Field></>}
    {(entity.kind === "make" || entity.kind === "model") && <Field label="الرابط المختصر"><Input dir="ltr" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></Field>}{entity.kind === "make" && <Field label="بلد المنشأ"><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Field>}{entity.kind === "model" && <Field label="نوع الهيكل"><Input dir="ltr" value={form.bodyType} onChange={(e) => setForm({ ...form, bodyType: e.target.value })} /></Field>}
    {entity.kind === "generation" && <><Field label="اسم الجيل"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field label="سنة البداية"><Input type="number" value={form.startYear} onChange={(e) => setForm({ ...form, startYear: e.target.value })} /></Field><Field label="سنة النهاية"><Input type="number" value={form.endYear} onChange={(e) => setForm({ ...form, endYear: e.target.value })} /></Field></>}
    {entity.kind === "trim" && <><Field label="سنة الموديل"><Input type="number" value={form.modelYear} onChange={(e) => setForm({ ...form, modelYear: e.target.value })} /></Field><Field label="السعر الرسمي"><Input type="number" value={form.officialPrice} onChange={(e) => setForm({ ...form, officialPrice: e.target.value })} /></Field><Field label="سعر السوق"><Input type="number" value={form.marketPrice} onChange={(e) => setForm({ ...form, marketPrice: e.target.value })} /></Field><Field label="سعة المحرك"><Input type="number" value={form.engineCc} onChange={(e) => setForm({ ...form, engineCc: e.target.value })} /></Field><Field label="القوة الحصانية"><Input type="number" value={form.powerHp} onChange={(e) => setForm({ ...form, powerHp: e.target.value })} /></Field></>}
    {entity.kind !== "generation" && <label className="flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> نشط في السوق</label>}
  </div>{mutation.error && <p className="text-sm text-destructive">{(mutation.error as ApiError).message}</p>}<DialogFooter><Button variant="outline" onClick={onCancel}>إلغاء</Button><Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? "جارٍ الحفظ…" : "حفظ"}</Button></DialogFooter></DialogContent>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
