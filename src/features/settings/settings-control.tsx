"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  MessageSquare,
  PhoneCall,
  Plus,
  Power,
  RefreshCw,
  Save,
  Send,
  ServerCog,
  ShieldAlert,
  Trash2,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomSelect } from "@/components/ui/custom-select";
import { adminFetch, type ApiError } from "@/lib/api";
import { adminPaths } from "@/lib/api/paths";

const groups = ["BUSINESS", "LISTING", "VENDOR", "PAYMENT", "APP", "NOTIFICATION"] as const;
const types = ["STRING", "NUMBER", "BOOLEAN", "JSON"] as const;
type SettingGroup = typeof groups[number];
type SettingType = typeof types[number];
type Setting = { key: string; group: SettingGroup; value: string; type: SettingType; isPublic: boolean; updatedAt: string };
type Draft = Pick<Setting, "key" | "group" | "value" | "type" | "isPublic">;

const emptyDraft: Draft = { key: "", group: "APP", value: "", type: "STRING", isPublic: false };

export function SettingsControl({ canWrite }: { canWrite: boolean }) {
  const client = useQueryClient();
  const [group, setGroup] = useState<"ALL" | SettingGroup>("ALL");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [newSetting, setNewSetting] = useState<Draft>(emptyDraft);

  // Maintenance mode local state
  const [maintenanceForm, setMaintenanceForm] = useState({
    enabled: false,
    bannerMessage: "المنصة قيد التحديث الدوري المجدول، يرجى العودة لاحقاً.",
  });
  const [maintenanceInitialized, setMaintenanceInitialized] = useState(false);
  const [maintenanceFeedback, setMaintenanceFeedback] = useState<string | null>(null);

  // SMS test local state
  const [smsForm, setSmsForm] = useState({ phone: "+201000000000", message: "اختبار رسائل YallaMotors" });
  const [smsFeedback, setSmsFeedback] = useState<{ sent: boolean; driver: string } | null>(null);

  // Media purge local state
  const [purgeFeedback, setPurgeFeedback] = useState<{ purgedCount: number; spaceSavedBytes: number } | null>(null);

  const query = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => adminFetch<Setting[]>(adminPaths.settings),
  });

  // Extract maintenance mode from settings once loaded
  if (query.data && !maintenanceInitialized) {
    const maintenanceSetting = query.data.find((s) => s.key === "system_maintenance_mode");
    if (maintenanceSetting) {
      try {
        const parsed = JSON.parse(maintenanceSetting.value);
        setMaintenanceForm({
          enabled: Boolean(parsed.enabled),
          bannerMessage: parsed.bannerMessage || "المنصة قيد التحديث الدوري المجدول، يرجى العودة لاحقاً.",
        });
      } catch {
        // ignore JSON parse error
      }
    }
    setMaintenanceInitialized(true);
  }

  const visible = useMemo(
    () => (query.data ?? []).filter((setting) => group === "ALL" || setting.group === group),
    [query.data, group]
  );

  const save = useMutation({
    mutationFn: (setting: Draft) =>
      adminFetch<Setting[]>(adminPaths.settings, {
        method: "PATCH",
        body: JSON.stringify({ settings: [setting] }),
      }),
    onSuccess: async (_, setting) => {
      setDrafts((current) => {
        const next = { ...current };
        delete next[setting.key];
        return next;
      });
      if (setting.key === newSetting.key) setNewSetting(emptyDraft);
      await client.invalidateQueries({ queryKey: ["admin-settings"] });
    },
  });

  const maintenanceMutation = useMutation({
    mutationFn: (body: { enabled: boolean; bannerMessage?: string }) =>
      adminFetch<{ enabled: boolean; bannerMessage: string; updatedAt: string }>(
        adminPaths.maintenance,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        }
      ),
    onSuccess: async (data) => {
      setMaintenanceFeedback(
        data.enabled ? "تم تفعيل وضع الصيانة العام على المنصة." : "تم إلغاء وضع الصيانة واستئناف تشغيل المنصة."
      );
      await client.invalidateQueries({ queryKey: ["admin-settings"] });
    },
  });

  const smsTestMutation = useMutation({
    mutationFn: (body: { phone: string; message?: string }) =>
      adminFetch<{ sent: boolean; driver: string }>(adminPaths.smsTest, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      setSmsFeedback(data);
    },
  });

  const purgeMediaMutation = useMutation({
    mutationFn: () =>
      adminFetch<{ purgedCount: number; spaceSavedBytes: number; success: boolean }>(
        adminPaths.mediaPurge,
        { method: "DELETE" }
      ),
    onSuccess: (data) => {
      setPurgeFeedback(data);
    },
  });

  function draftFor(setting: Setting) {
    return drafts[setting.key] ?? setting;
  }
  function updateDraft(setting: Setting, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [setting.key]: { ...draftFor(setting), ...patch } }));
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
            <ServerCog className="size-4" /> النظام
          </div>
          <h1 className="mt-2 text-3xl font-black">إعدادات وعمليات النظام</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
            تحكم مباشر في إعدادات الأعمال، وضع الصيانة الطارئ، فحص الرسائل النصية، وتنظيف مساحة التخزين.
          </p>
        </div>
        <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw className={query.isFetching ? "size-4 animate-spin" : "size-4"} />
          <span>تحديث</span>
        </Button>
      </div>

      {/* Operations Tools Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Emergency Maintenance Mode */}
        <Card className={maintenanceForm.enabled ? "border-destructive bg-destructive/5" : ""}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Power className={`size-4 ${maintenanceForm.enabled ? "text-destructive" : "text-muted-foreground"}`} />
                <span>وضع الصيانة العام</span>
              </CardTitle>
              <Badge variant={maintenanceForm.enabled ? "destructive" : "outline"}>
                {maintenanceForm.enabled ? "مفعّل (طوارئ)" : "معطل (طبيعي)"}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              إيقاف وصول المستخدمين للواجهات وتوجيههم لصفحة صيانة طارئة.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">رسالة البانر للمستخدمين</Label>
              <Input
                value={maintenanceForm.bannerMessage}
                disabled={!canWrite}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, bannerMessage: e.target.value })}
                className="text-xs"
              />
            </div>
            {maintenanceFeedback && (
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {maintenanceFeedback}
              </p>
            )}
            {canWrite && (
              <Button
                size="sm"
                variant={maintenanceForm.enabled ? "outline" : "destructive"}
                className="w-full"
                disabled={maintenanceMutation.isPending}
                onClick={() => {
                  const nextState = !maintenanceForm.enabled;
                  setMaintenanceForm({ ...maintenanceForm, enabled: nextState });
                  maintenanceMutation.mutate({
                    enabled: nextState,
                    bannerMessage: maintenanceForm.bannerMessage,
                  });
                }}
              >
                {maintenanceMutation.isPending
                  ? "جارٍ الحفظ…"
                  : maintenanceForm.enabled
                  ? "إلغاء وضع الصيانة واستئناف التشغيل"
                  : "تفعيل وضع الصيانة العام فوراً"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* SMS Gateway Test */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="size-4 text-primary" />
              <span>فحص بوابة الرسائل النصية</span>
            </CardTitle>
            <CardDescription className="text-xs">
              إرسال رسالة SMS حقيقية للتحقق من تكامل موفر الخدمة النشط.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">رقم الهاتف (صيغة E.164 دولية)</Label>
              <Input
                dir="ltr"
                value={smsForm.phone}
                onChange={(e) => setSmsForm({ ...smsForm, phone: e.target.value })}
                placeholder="+201000000000"
                className="text-xs"
              />
            </div>
            {smsFeedback && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                تم الإرسال بنجاح عبر بوابة: {smsFeedback.driver}
              </div>
            )}
            {smsTestMutation.error && (
              <p className="text-xs text-destructive">
                {(smsTestMutation.error as ApiError).message}
              </p>
            )}
            {canWrite && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={smsTestMutation.isPending || !smsForm.phone}
                onClick={() => smsTestMutation.mutate(smsForm)}
              >
                <Send className="size-3.5" />
                <span>{smsTestMutation.isPending ? "جارٍ الإرسال…" : "إرسال رسالة اختبار"}</span>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Media Storage Purge */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="size-4 text-primary" />
              <span>تنظيف الملفات اليتيمة</span>
            </CardTitle>
            <CardDescription className="text-xs">
              مسح الصور والمرفقات غير المرتبطة بأي إعلان أو حساب لتوفير التخزين.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              يفحص قاعدة البيانات وخادم التخزين السحابي ويحذف الملفات المنفصلة نهائياً.
            </p>
            {purgeFeedback && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                تم مسح {purgeFeedback.purgedCount} ملف وحفظ{" "}
                {(purgeFeedback.spaceSavedBytes / (1024 * 1024)).toFixed(2)} ميجابايت.
              </div>
            )}
            {purgeMediaMutation.error && (
              <p className="text-xs text-destructive">
                {(purgeMediaMutation.error as ApiError).message}
              </p>
            )}
            {canWrite && (
              <Button
                size="sm"
                variant="outline"
                className="w-full text-destructive hover:bg-destructive/10"
                disabled={purgeMediaMutation.isPending}
                onClick={() => purgeMediaMutation.mutate()}
              >
                <Trash2 className="size-3.5" />
                <span>{purgeMediaMutation.isPending ? "جارٍ الفحص والتنظيف…" : "بدء تنظيف الملفات اليتيمة"}</span>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Production Safety Warning */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-bold">التغييرات تطبق على بيئة الإنتاج الحقيقية</p>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              كل حفظ مسجل في سجل التدقيق باسم المشرف. تحقق من قيم JSON والنسب والحدود قبل الاعتماد.
            </p>
          </div>
        </div>
      </div>

      {/* Settings Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={group === "ALL" ? "default" : "outline"} onClick={() => setGroup("ALL")}>
          الكل
        </Button>
        {groups.map((item) => (
          <Button
            key={item}
            size="sm"
            variant={group === item ? "default" : "outline"}
            onClick={() => setGroup(item)}
          >
            {item}
          </Button>
        ))}
      </div>

      {/* Settings List */}
      {query.isLoading ? (
        <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">
          جارٍ تحميل الإعدادات…
        </div>
      ) : query.error ? (
        <div className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">
          {(query.error as ApiError).message}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((setting) => {
            const draft = draftFor(setting);
            const changed = Boolean(drafts[setting.key]);
            return (
              <Card key={setting.key}>
                <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(15rem,1fr)_10rem_9rem_minmax(18rem,1.4fr)_auto] lg:items-end">
                  <Field label="المفتاح">
                    <Input value={setting.key} readOnly dir="ltr" className="font-mono text-xs" />
                  </Field>
                  <Field label="المجموعة">
                    <NativeSelect
                      value={draft.group}
                      options={groups}
                      onChange={(value) => updateDraft(setting, { group: value as SettingGroup })}
                      disabled={!canWrite}
                    />
                  </Field>
                  <Field label="النوع">
                    <NativeSelect
                      value={draft.type}
                      options={types}
                      onChange={(value) => updateDraft(setting, { type: value as SettingType })}
                      disabled={!canWrite}
                    />
                  </Field>
                  <Field label="القيمة">
                    {draft.type === "JSON" ? (
                      <textarea
                        value={draft.value}
                        onChange={(event) => updateDraft(setting, { value: event.target.value })}
                        disabled={!canWrite}
                        dir="ltr"
                        className="min-h-10 w-full rounded-xl border bg-background p-2 font-mono text-xs"
                      />
                    ) : draft.type === "BOOLEAN" ? (
                      <NativeSelect
                        value={draft.value}
                        options={["true", "false"]}
                        onChange={(value) => updateDraft(setting, { value })}
                        disabled={!canWrite}
                      />
                    ) : (
                      <Input
                        value={draft.value}
                        onChange={(event) => updateDraft(setting, { value: event.target.value })}
                        disabled={!canWrite}
                        dir="ltr"
                      />
                    )}
                  </Field>
                  <div className="flex items-center gap-2">
                    <label className="flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold">
                      <input
                        type="checkbox"
                        checked={draft.isPublic}
                        onChange={(event) => updateDraft(setting, { isPublic: event.target.checked })}
                        disabled={!canWrite}
                      />
                      <span>عام</span>
                    </label>
                    <Button
                      size="icon"
                      disabled={!changed || save.isPending || !canWrite}
                      onClick={() => save.mutate(draft)}
                      aria-label={`حفظ ${setting.key}`}
                    >
                      <Save className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!visible.length && (
            <div className="rounded-2xl border p-10 text-center text-sm text-muted-foreground">
              لا توجد إعدادات في هذه المجموعة.
            </div>
          )}
        </div>
      )}

      {/* Add New Setting Card */}
      {canWrite && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="size-5 text-primary" />
              <span>إضافة إعداد جديد</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <Field label="المفتاح">
              <Input
                dir="ltr"
                value={newSetting.key}
                onChange={(event) => setNewSetting({ ...newSetting, key: event.target.value })}
                placeholder="marketplace.example_key"
              />
            </Field>
            <Field label="القيمة">
              <Input
                dir="ltr"
                value={newSetting.value}
                onChange={(event) => setNewSetting({ ...newSetting, value: event.target.value })}
              />
            </Field>
            <Field label="المجموعة">
              <NativeSelect
                value={newSetting.group}
                options={groups}
                onChange={(value) => setNewSetting({ ...newSetting, group: value as SettingGroup })}
              />
            </Field>
            <Field label="النوع">
              <NativeSelect
                value={newSetting.type}
                options={types}
                onChange={(value) => setNewSetting({ ...newSetting, type: value as SettingType })}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2">
              <input
                type="checkbox"
                checked={newSetting.isPublic}
                onChange={(event) => setNewSetting({ ...newSetting, isPublic: event.target.checked })}
              />
              <span>إظهار هذا الإعداد للعملاء عبر الواجهة العامة</span>
            </label>
            <div className="flex justify-end sm:col-span-2">
              <Button
                disabled={save.isPending || newSetting.key.length < 2}
                onClick={() => save.mutate(newSetting)}
              >
                <Plus className="size-4" />
                <span>إضافة وحفظ</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {save.error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {(save.error as ApiError).message}
        </p>
      )}

      {!canWrite && <Badge variant="outline">قراءة فقط — صلاحية settings:write مطلوبة</Badge>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function NativeSelect({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <CustomSelect
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      options={options.map((option) => ({ value: option, label: option }))}
    />
  );
}
