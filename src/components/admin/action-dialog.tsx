"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  requireReason = false,
  destructive = false,
  pending = false,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  requireReason?: boolean;
  destructive?: boolean;
  pending?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const valid = !requireReason || reason.trim().length >= 3;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) setReason(""); onOpenChange(nextOpen); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {requireReason && (
          <div className="space-y-2">
            <Label htmlFor="action-reason">السبب</Label>
            <textarea
              id="action-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="اكتب سببًا واضحًا سيظهر في سجل التدقيق"
              className="min-h-28 w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
            />
          </div>
        )}
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>إلغاء</Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={() => onConfirm(reason.trim())} disabled={!valid || pending}>
            {pending ? "جارٍ التنفيذ…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
