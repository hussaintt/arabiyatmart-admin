"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

type RemoveMode = "soft" | "permanent";
type RemoveScope = "all" | "filtered";

export function RemoveAllListingsDialog({
  open,
  onOpenChange,
  totalCount,
  filteredCount,
  hasActiveFilters,
  pending = false,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalCount: number;
  filteredCount?: number;
  hasActiveFilters: boolean;
  pending?: boolean;
  error?: string | null;
  onConfirm: (payload: { scope: RemoveScope; mode: RemoveMode; reason: string }) => void | Promise<void>;
}) {
  const [scope, setScope] = useState<RemoveScope>(hasActiveFilters ? "filtered" : "all");
  const [mode, setMode] = useState<RemoveMode>("soft");
  const [reason, setReason] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");

  useEffect(() => {
    if (open) {
      setScope(hasActiveFilters ? "filtered" : "all");
      setMode("soft");
      setReason("");
      setConfirmPhrase("");
    }
  }, [open, hasActiveFilters]);

  const targetCount = scope === "filtered" ? (filteredCount ?? totalCount) : totalCount;
  const isReasonValid = reason.trim().length >= 3;
  const isConfirmValid = mode === "soft" || confirmPhrase.trim() === "حذف الكل" || confirmPhrase.trim().toUpperCase() === "DELETE";
  const canSubmit = isReasonValid && isConfirmValid && !pending && targetCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="size-5 shrink-0" />
            <DialogTitle>حذف كل الإعلانات</DialogTitle>
          </div>
          <DialogDescription>
            إزالة جماعية للإعلانات مع إمكانية التحديد بين الحذف المنطقي القابل للاستعادة أو التطهير النهائي.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Scope selection if filters are active */}
          {hasActiveFilters && (
            <div className="space-y-2">
              <Label className="font-bold text-xs text-muted-foreground uppercase">نطاق الحذف</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope("filtered")}
                  className={`rounded-xl border p-3 text-start transition ${
                    scope === "filtered"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border/60 hover:bg-muted/40"
                  }`}
                >
                  <p className="font-bold text-sm">الإعلانات المفلترة</p>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {(filteredCount ?? 0).toLocaleString("ar-EG")} إعلان مطابق للتصفية
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setScope("all")}
                  className={`rounded-xl border p-3 text-start transition ${
                    scope === "all"
                      ? "border-destructive bg-destructive/5 ring-2 ring-destructive/20"
                      : "border-border/60 hover:bg-muted/40"
                  }`}
                >
                  <p className="font-bold text-sm text-destructive">كافة إعلانات المنصة</p>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {totalCount.toLocaleString("ar-EG")} إعلان بالكامل
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Mode selection */}
          <div className="space-y-2">
            <Label className="font-bold text-xs text-muted-foreground uppercase">نوع الحذف</Label>
            <div className="space-y-2">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                  mode === "soft"
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border/60 hover:bg-muted/30"
                }`}
              >
                <input
                  type="radio"
                  name="remove-mode"
                  checked={mode === "soft"}
                  onChange={() => setMode("soft")}
                  className="mt-1 size-4 accent-primary"
                />
                <div>
                  <p className="font-bold text-sm">حذف منطقي (Soft Delete) · موصى به</p>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    يتم تحويل الإعلانات إلى حالة &quot;محذوف&quot; وإخفاؤها من السوق مع الاحتفاظ بسجلها كاملاً. يمكن للمسؤولين استعادتها في أي وقت من تصفية &quot;المحذوفة فقط&quot;.
                  </p>
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                  mode === "permanent"
                    ? "border-destructive bg-destructive/5 ring-2 ring-destructive/20"
                    : "border-border/60 hover:bg-muted/30"
                }`}
              >
                <input
                  type="radio"
                  name="remove-mode"
                  checked={mode === "permanent"}
                  onChange={() => setMode("permanent")}
                  className="mt-1 size-4 accent-destructive"
                />
                <div>
                  <p className="font-bold text-sm text-destructive">حذف نهائي وتطهير كامل (Permanent Purge)</p>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    حذف دائم لا رجعة فيه للسجلات وكافة البيانات والوسائط المرتبطة من قاعدة البيانات. يُستخدم لتنظيف إعلانات الاختبار أو إعادة استيراد نظيف.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Reason field */}
          <div className="space-y-1.5">
            <Label htmlFor="remove-reason" className="text-xs font-bold">
              سبب الحذف <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="remove-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="اكتب سبب الحذف لتوثيقه في سجل التدقيق الإداري (3 أحرف على الأقل)"
              className="min-h-20 w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>

          {/* Confirmation phrase for permanent mode */}
          {mode === "permanent" && (
            <div className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-4 shrink-0" />
                <p className="font-bold text-xs">تأكيد أمان الحذف النهائي</p>
              </div>
              <p className="text-xs text-destructive/90">
                لتفادي الحذف العرضي، يرجى كتابة <strong className="underline">حذف الكل</strong> أو <strong>DELETE</strong> في الحقل التالي:
              </p>
              <Input
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder='اكتب "حذف الكل" للتأكيد'
                className="border-destructive/40 bg-background text-sm"
              />
            </div>
          )}

          {error && (
            <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            إلغاء
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm({ scope, mode, reason: reason.trim() })}
            disabled={!canSubmit}
          >
            <Trash2 className="size-4" />
            {pending
              ? "جارٍ الحذف…"
              : `تأكيد حذف ${targetCount.toLocaleString("ar-EG")} إعلان`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
