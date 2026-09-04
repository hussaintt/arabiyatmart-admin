"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  FileCheck2,
  FileText,
  Plus,
  Receipt,
  ReceiptText,
  RefreshCw,
  Search,
  SlidersHorizontal,
  XCircle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminFetch, type ApiError } from "@/lib/api";
import { adminPaths } from "@/lib/api/paths";
import { mediaUrl } from "@/lib/media";
import { date, ErrorState, Header, Loading } from "@/features/people/users-list";

// --- Types ---

type VendorRef = { publicId: string; displayName: string };

type Invoice = {
  id: number;
  publicId: string;
  vendorId: number;
  vendor: VendorRef;
  amountCents: number;
  currency: string;
  status: "DRAFT" | "OPEN" | "PAID" | "UNCOLLECTIBLE" | "VOID";
  dueAt: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  createdAt: string;
};

type Payment = {
  id: number;
  publicId: string;
  vendorId: number;
  vendor: VendorRef;
  amountCents: number;
  currency: string;
  method: string;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  reviewedAt: string | null;
  reviewedBy: { publicId: string; email: string } | null;
  proofFile: { key: string; publicId: string } | null;
  createdAt: string;
};

type SubscriptionPlan = {
  id: number;
  code: string;
  name: string | { ar?: string; en?: string };
  description: string | { ar?: string; en?: string } | null;
  priceCents: number;
  billingInterval: "MONTHLY" | "YEARLY";
  isActive: boolean;
  features: Record<string, unknown> | null;
  createdAt: string;
};

type CursorResponse<T> = {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

function formatMoney(cents: number, currency = "EGP") {
  const val = (cents / 100).toLocaleString("ar-EG", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${val} ${currency === "EGP" ? "ج.م" : currency}`;
}

function parseTranslatable(value: string | { ar?: string; en?: string } | null | undefined): string {
  if (!value) return "—";
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed.ar || parsed.en || value;
    } catch {
      return value;
    }
  }
  return value.ar || value.en || "—";
}

export function BillingControl({
  canWrite,
  canAdjust,
}: {
  canWrite: boolean;
  canAdjust: boolean;
}) {
  const [activeTab, setActiveTab] = useState("invoices");

  return (
    <div className="space-y-6 pb-12">
      <Header
        title="الفوترة والاشتراكات"
        description="إدارة فواتير المعارض، تسوية المدفوعات النقدية، مراجعة إيصالات التحويل البنكي، والتحكم في باقات الاشتراكات."
        onRefresh={() => {}}
        refreshing={false}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid h-12 w-full max-w-xl grid-cols-3 rounded-xl bg-muted/70 p-1">
          <TabsTrigger value="invoices" className="rounded-lg font-bold">
            <Receipt className="me-2 size-4" /> الفواتير
          </TabsTrigger>
          <TabsTrigger value="payments" className="rounded-lg font-bold">
            <FileCheck2 className="me-2 size-4" /> إيصالات التحويل
          </TabsTrigger>
          <TabsTrigger value="plans" className="rounded-lg font-bold">
            <CreditCard className="me-2 size-4" /> باقات الاشتراك
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-6">
          <InvoicesTab canAdjust={canAdjust} />
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <PaymentsTab canWrite={canWrite} />
        </TabsContent>

        <TabsContent value="plans" className="space-y-6">
          <SubscriptionPlansTab canWrite={canWrite} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: INVOICES
// ─────────────────────────────────────────────────────────────────────────────

function InvoicesTab({ canAdjust }: { canAdjust: boolean }) {
  const client = useQueryClient();
  const [status, setStatus] = useState("ALL");
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<string | null>>([]);
  const [settleTarget, setSettleTarget] = useState<Invoice | null>(null);

  const params = new URLSearchParams({
    limit: "25",
    ...(status !== "ALL" ? { status } : {}),
    ...(cursor ? { cursor } : {}),
  }).toString();

  const query = useQuery({
    queryKey: ["admin-billing-invoices", params],
    queryFn: () => adminFetch<CursorResponse<Invoice>>(`${adminPaths.billingInvoices}?${params}`),
  });

  const next = () => {
    if (!query.data?.nextCursor) return;
    setHistory((prev) => [...prev, cursor]);
    setCursor(query.data.nextCursor);
  };

  const previous = () => {
    setHistory((prev) => {
      const copy = [...prev];
      setCursor(copy.pop() ?? null);
      return copy;
    });
  };

  const invoices = query.data?.data ?? [];
  const openCount = invoices.filter((inv) => inv.status === "OPEN").length;
  const paidCount = invoices.filter((inv) => inv.status === "PAID").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard title="الفواتير المعروضة" value={invoices.length} icon={ReceiptText} />
        <MetricCard title="فواتير مستحقة الدفع" value={openCount} icon={Receipt} variant="warning" />
        <MetricCard title="فواتير مسددة" value={paidCount} icon={CheckCircle2} variant="success" />
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>فواتير المعارض</CardTitle>
              <CardDescription>عرض فواتير عمولات ومصروفات المعارض وتسويتها خارج التطبيق</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-44">
                <CustomSelect
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setCursor(null);
                    setHistory([]);
                  }}
                  options={[
                    { value: "ALL", label: "كل الحالات" },
                    { value: "OPEN", label: "مفتوحة (مستحقة)" },
                    { value: "PAID", label: "مسددة" },
                    { value: "DRAFT", label: "مسودة" },
                    { value: "UNCOLLECTIBLE", label: "غير قابلة للتحصيل" },
                    { value: "VOID", label: "ملغاة" },
                  ]}
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => query.refetch()} disabled={query.isFetching}>
                <RefreshCw className={query.isFetching ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {query.isLoading ? (
            <Loading />
          ) : query.error ? (
            <ErrorState error={query.error as ApiError} />
          ) : invoices.length === 0 ? (
            <div className="grid min-h-56 place-items-center text-center">
              <div>
                <ReceiptText className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-2 font-bold">لا توجد فواتير مطابقة</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الفاتورة</TableHead>
                    <TableHead>المعرض</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>تاريخ الاستحقاق</TableHead>
                    <TableHead>تاريخ السداد</TableHead>
                    <TableHead>طريقة الدفع</TableHead>
                    {canAdjust && <TableHead className="text-end">الإجراءات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.publicId}>
                      <TableCell className="font-mono text-xs font-bold" dir="ltr">
                        {invoice.publicId}
                      </TableCell>
                      <TableCell>
                        <span className="font-bold">{invoice.vendor?.displayName || "معرض غير معروف"}</span>
                        <p className="text-[0.7rem] text-muted-foreground font-mono" dir="ltr">
                          {invoice.vendor?.publicId}
                        </p>
                      </TableCell>
                      <TableCell className="font-bold">
                        {formatMoney(invoice.amountCents, invoice.currency)}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={invoice.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{date(invoice.dueAt)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{date(invoice.paidAt)}</TableCell>
                      <TableCell className="text-xs">{invoice.paymentMethod || "—"}</TableCell>
                      {canAdjust && (
                        <TableCell className="text-end">
                          {invoice.status === "OPEN" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSettleTarget(invoice)}
                              className="font-semibold"
                            >
                              <CheckCircle2 className="size-3.5 me-1 text-emerald-600" /> تسوية يدوية
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {query.data && (history.length > 0 || query.data.hasMore) && (
          <div className="flex justify-end gap-2 border-t p-4">
            <Button variant="outline" size="sm" onClick={previous} disabled={!history.length}>
              <ChevronRight /> السابق
            </Button>
            <Button variant="outline" size="sm" onClick={next} disabled={!query.data.hasMore}>
              التالي <ChevronLeft />
            </Button>
          </div>
        )}
      </Card>

      {settleTarget && (
        <SettleOfflineModal
          invoice={settleTarget}
          onClose={() => setSettleTarget(null)}
          onSuccess={async () => {
            setSettleTarget(null);
            await client.invalidateQueries({ queryKey: ["admin-billing-invoices"] });
          }}
        />
      )}
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "PAID":
      return <Badge className="bg-emerald-600 hover:bg-emerald-700">مسددة</Badge>;
    case "OPEN":
      return <Badge variant="destructive">مستحقة (مفتوحة)</Badge>;
    case "DRAFT":
      return <Badge variant="secondary">مسودة</Badge>;
    case "UNCOLLECTIBLE":
      return <Badge variant="outline" className="border-destructive text-destructive">غير قابلة للتحصيل</Badge>;
    case "VOID":
      return <Badge variant="outline">ملغاة</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function SettleOfflineModal({
  invoice,
  onClose,
  onSuccess,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [method, setMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [amount, setAmount] = useState(String(invoice.amountCents / 100));
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      adminFetch(adminPaths.invoiceSettleOffline(invoice.publicId), {
        method: "POST",
        body: JSON.stringify({
          method,
          amountCents: Math.round(Number(amount) * 100),
          reference: reference.trim() || undefined,
          note: note.trim() || undefined,
        }),
      }),
    onSuccess,
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>تسوية الفاتورة يدوياً (Offline Settle)</DialogTitle>
          <DialogDescription>
            تسجيل تحصيل المبلغ خارج المنصة (نقدي أو إيداع مباشر)، مما يرفع القيود تلقائياً عن حساب المعرض.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-xl border bg-muted/40 p-3 text-xs space-y-1">
            <p><strong>المعرض:</strong> {invoice.vendor?.displayName}</p>
            <p><strong>رقم الفاتورة:</strong> <span dir="ltr" className="font-mono">{invoice.publicId}</span></p>
            <p><strong>المبلغ الأصلي:</strong> {formatMoney(invoice.amountCents, invoice.currency)}</p>
          </div>

          <div className="space-y-1.5">
            <Label>طريقة التحصيل</Label>
            <CustomSelect
              value={method}
              onChange={(e) => setMethod(e.target.value as "CASH" | "BANK_TRANSFER")}
              options={[
                { value: "CASH", label: "نقداً (Cash / تحصيل مندوب)" },
                { value: "BANK_TRANSFER", label: "تحويل بنكي مباشر (Bank Transfer)" },
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <Label>المبلغ المحصل (ج.م)</Label>
            <Input
              type="number"
              min={1}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="المبلغ المحصل بالجنيه المصري"
            />
          </div>

          <div className="space-y-1.5">
            <Label>رقم المرجع / الإيصال (اختياري)</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="مثال: REF-92841 أو رقم إيصال الاستلام"
            />
          </div>

          <div className="space-y-1.5">
            <Label>ملاحظات إضافية (اختياري)</Label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="أي تفاصيل أو وثائق تثبت الاستلام..."
              className="min-h-20 w-full rounded-xl border border-input bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
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
            disabled={mutation.isPending || !Number(amount) || Number(amount) <= 0}
          >
            {mutation.isPending ? "جارٍ التسوية…" : "تأكيد التسوية"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: BANK PROOF PAYMENTS
// ─────────────────────────────────────────────────────────────────────────────

function PaymentsTab({ canWrite }: { canWrite: boolean }) {
  const client = useQueryClient();
  const [status, setStatus] = useState("PENDING_REVIEW");
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<string | null>>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{
    payment: Payment;
    action: "APPROVED" | "REJECTED";
  } | null>(null);

  const params = new URLSearchParams({
    limit: "25",
    ...(status !== "ALL" ? { status } : {}),
    ...(cursor ? { cursor } : {}),
  }).toString();

  const query = useQuery({
    queryKey: ["admin-billing-payments", params],
    queryFn: () => adminFetch<CursorResponse<Payment>>(`${adminPaths.billingPayments}?${params}`),
  });

  const next = () => {
    if (!query.data?.nextCursor) return;
    setHistory((prev) => [...prev, cursor]);
    setCursor(query.data.nextCursor);
  };

  const previous = () => {
    setHistory((prev) => {
      const copy = [...prev];
      setCursor(copy.pop() ?? null);
      return copy;
    });
  };

  const payments = query.data?.data ?? [];
  const pendingCount = payments.filter((p) => p.status === "PENDING_REVIEW").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard title="إجمالي المعاملات المعروضة" value={payments.length} icon={ReceiptText} />
        <MetricCard title="بانتظار المراجعة" value={pendingCount} icon={FileCheck2} variant="warning" />
        <MetricCard
          title="معتمدة"
          value={payments.filter((p) => p.status === "APPROVED").length}
          icon={CheckCircle2}
          variant="success"
        />
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>إيصالات التحويل البنكي</CardTitle>
              <CardDescription>فحص صور إيصالات الدفع البنكي المقدمة من التجار واعتمادها أو رفضها مع بيان السبب</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-44">
                <CustomSelect
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setCursor(null);
                    setHistory([]);
                  }}
                  options={[
                    { value: "ALL", label: "كل الحالات" },
                    { value: "PENDING_REVIEW", label: "قيد المراجعة" },
                    { value: "APPROVED", label: "معتمدة" },
                    { value: "REJECTED", label: "مرفوضة" },
                  ]}
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => query.refetch()} disabled={query.isFetching}>
                <RefreshCw className={query.isFetching ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {query.isLoading ? (
            <Loading />
          ) : query.error ? (
            <ErrorState error={query.error as ApiError} />
          ) : payments.length === 0 ? (
            <div className="grid min-h-56 place-items-center text-center">
              <div>
                <FileCheck2 className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-2 font-bold">لا توجد إيصالات مطابقة</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الدفعة</TableHead>
                    <TableHead>المعرض</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>الطريقة</TableHead>
                    <TableHead>صورة الإيصال</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>تاريخ التقديم</TableHead>
                    <TableHead>الفاحص</TableHead>
                    {canWrite && <TableHead className="text-end">القرار</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => {
                    const receiptUrl = payment.proofFile?.key ? mediaUrl(payment.proofFile.key) : null;
                    return (
                      <TableRow key={payment.publicId}>
                        <TableCell className="font-mono text-xs font-bold" dir="ltr">
                          {payment.publicId}
                        </TableCell>
                        <TableCell>
                          <span className="font-bold">{payment.vendor?.displayName || "معرض غير معروف"}</span>
                        </TableCell>
                        <TableCell className="font-bold">
                          {formatMoney(payment.amountCents, payment.currency)}
                        </TableCell>
                        <TableCell className="text-xs">{payment.method}</TableCell>
                        <TableCell>
                          {receiptUrl ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 gap-1 text-xs"
                              onClick={() => setPreviewImage(receiptUrl)}
                            >
                              <Eye className="size-3.5" /> معاينة الإيصال
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">بلا صورة</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <PaymentStatusBadge status={payment.status} />
                          {payment.rejectionReason && (
                            <p className="mt-1 max-w-xs text-[0.7rem] text-destructive">
                              السبب: {payment.rejectionReason}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{date(payment.createdAt)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {payment.reviewedBy?.email || "—"}
                        </TableCell>
                        {canWrite && (
                          <TableCell className="text-end">
                            {payment.status === "PENDING_REVIEW" && (
                              <div className="flex justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => setReviewTarget({ payment, action: "APPROVED" })}
                                >
                                  <CheckCircle2 className="size-3.5 me-1" /> اعتماد
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:bg-destructive/10"
                                  onClick={() => setReviewTarget({ payment, action: "REJECTED" })}
                                >
                                  <XCircle className="size-3.5 me-1" /> رفض
                                </Button>
                              </div>
                            )}
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
        {query.data && (history.length > 0 || query.data.hasMore) && (
          <div className="flex justify-end gap-2 border-t p-4">
            <Button variant="outline" size="sm" onClick={previous} disabled={!history.length}>
              <ChevronRight /> السابق
            </Button>
            <Button variant="outline" size="sm" onClick={next} disabled={!query.data.hasMore}>
              التالي <ChevronLeft />
            </Button>
          </div>
        )}
      </Card>

      {previewImage && (
        <Dialog open onOpenChange={(open) => !open && setPreviewImage(null)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>معاينة إيصال التحويل البنكي</DialogTitle>
            </DialogHeader>
            <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-xl bg-muted/40 p-2">
              <img src={previewImage} alt="Receipt Proof" className="max-h-full max-w-full rounded-lg object-contain" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewImage(null)}>
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {reviewTarget && (
        <ReviewPaymentModal
          payment={reviewTarget.payment}
          action={reviewTarget.action}
          onClose={() => setReviewTarget(null)}
          onSuccess={async () => {
            setReviewTarget(null);
            await client.invalidateQueries({ queryKey: ["admin-billing-payments"] });
            await client.invalidateQueries({ queryKey: ["admin-billing-invoices"] });
          }}
        />
      )}
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "APPROVED":
      return <Badge className="bg-emerald-600 hover:bg-emerald-700">معتمد</Badge>;
    case "PENDING_REVIEW":
      return <Badge variant="secondary" className="border-amber-500 bg-amber-50 text-amber-700">قيد المراجعة</Badge>;
    case "REJECTED":
      return <Badge variant="destructive">مرفوض</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function ReviewPaymentModal({
  payment,
  action,
  onClose,
  onSuccess,
}: {
  payment: Payment;
  action: "APPROVED" | "REJECTED";
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      adminFetch(adminPaths.billingPaymentReview(payment.publicId), {
        method: "PATCH",
        body: JSON.stringify({
          status: action,
          ...(action === "REJECTED" ? { rejectionReason: reason.trim() } : {}),
        }),
      }),
    onSuccess,
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{action === "APPROVED" ? "اعتماد إيصال التحويل" : "رفض إيصال التحويل"}</DialogTitle>
          <DialogDescription>
            {action === "APPROVED"
              ? "سيتم تسجيل الدفعة كناجحة وتحديث رصيد المعرض أو تسوية الفاتورة المرتبطة."
              : "يرجى توضيح سبب رفض الإيصال ليتم إشعار المعرض به."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-xl border bg-muted/40 p-3 text-xs space-y-1">
            <p><strong>المعرض:</strong> {payment.vendor?.displayName}</p>
            <p><strong>المبلغ:</strong> {formatMoney(payment.amountCents, payment.currency)}</p>
          </div>

          {action === "REJECTED" && (
            <div className="space-y-1.5">
              <Label>سبب الرفض (مطلوب)</Label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="مثال: صورة الإيصال غير واضحة أو المبلغ غير مطابق أو تم التحويل لحساب خاطئ..."
                className="min-h-24 w-full rounded-xl border border-input bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

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
            variant={action === "APPROVED" ? "default" : "destructive"}
            className={action === "APPROVED" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || (action === "REJECTED" && reason.trim().length < 3)}
          >
            {mutation.isPending ? "جارٍ الحفظ…" : action === "APPROVED" ? "تأكيد الاعتماد" : "تأكيد الرفض"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3: SUBSCRIPTION PLANS
// ─────────────────────────────────────────────────────────────────────────────

function SubscriptionPlansTab({ canWrite }: { canWrite: boolean }) {
  const client = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | "new" | null>(null);

  const query = useQuery({
    queryKey: ["admin-subscription-plans"],
    queryFn: () => adminFetch<SubscriptionPlan[]>(adminPaths.subscriptionPlans),
  });

  const plans = query.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">باقات اشتراك المعارض</h2>
          <p className="text-xs text-muted-foreground">حدد أسعار ومزايا وحصص الإعلانات لكل مستوى اشتراك</p>
        </div>
        {canWrite && (
          <Button onClick={() => setEditingPlan("new")}>
            <Plus className="me-1 size-4" /> إضافة باقة جديدة
          </Button>
        )}
      </div>

      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error as ApiError} />
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="grid min-h-56 place-items-center text-center p-6">
            <div>
              <CreditCard className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-2 font-bold">لا توجد باقات مضافة حتى الآن</p>
              {canWrite && (
                <Button variant="outline" className="mt-4" onClick={() => setEditingPlan("new")}>
                  إضافة أول باقة
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="flex flex-col justify-between overflow-hidden">
              <CardHeader className="border-b bg-muted/20 pb-4">
                <div className="flex items-center justify-between">
                  <Badge variant={plan.isActive ? "default" : "secondary"}>
                    {plan.isActive ? "نشطة" : "غير مفعلة"}
                  </Badge>
                  <span className="font-mono text-xs font-bold text-muted-foreground">{plan.code}</span>
                </div>
                <CardTitle className="mt-2 text-xl font-black">
                  {parseTranslatable(plan.name)}
                </CardTitle>
                <CardDescription className="text-xs">
                  {parseTranslatable(plan.description)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4 p-5">
                <div>
                  <span className="text-3xl font-black text-foreground">
                    {(plan.priceCents / 100).toLocaleString("ar-EG")}
                  </span>{" "}
                  <span className="text-xs font-bold text-muted-foreground">
                    ج.م / {plan.billingInterval === "YEARLY" ? "سنوياً" : "شهرياً"}
                  </span>
                </div>

                {plan.features && Object.keys(plan.features).length > 0 && (
                  <div className="space-y-1.5 rounded-xl border bg-muted/40 p-3 text-xs">
                    <p className="font-bold text-muted-foreground">المزايا والحصص:</p>
                    {Object.entries(plan.features).map(([key, val]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground">{key}:</span>
                        <span className="font-semibold">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              {canWrite && (
                <div className="border-t bg-muted/10 p-3 text-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingPlan(plan)}
                    className="font-semibold"
                  >
                    <SlidersHorizontal className="size-3.5 me-1" /> تعديل الباقة
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {editingPlan && (
        <PlanEditorModal
          plan={editingPlan === "new" ? null : editingPlan}
          onClose={() => setEditingPlan(null)}
          onSuccess={async () => {
            setEditingPlan(null);
            await client.invalidateQueries({ queryKey: ["admin-subscription-plans"] });
          }}
        />
      )}
    </div>
  );
}

function PlanEditorModal({
  plan,
  onClose,
  onSuccess,
}: {
  plan: SubscriptionPlan | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = Boolean(plan);
  const [code, setCode] = useState(plan?.code ?? "");
  const [nameAr, setNameAr] = useState(
    typeof plan?.name === "object" ? plan?.name?.ar ?? "" : typeof plan?.name === "string" ? plan?.name : ""
  );
  const [nameEn, setNameEn] = useState(
    typeof plan?.name === "object" ? plan?.name?.en ?? "" : ""
  );
  const [descAr, setDescAr] = useState(
    typeof plan?.description === "object" ? plan?.description?.ar ?? "" : typeof plan?.description === "string" ? plan?.description : ""
  );
  const [price, setPrice] = useState(plan ? String(plan.priceCents / 100) : "1000");
  const [billingInterval, setBillingInterval] = useState<"MONTHLY" | "YEARLY">(
    plan?.billingInterval ?? "MONTHLY"
  );
  const [isActive, setIsActive] = useState(plan?.isActive ?? true);
  const [featuresRaw, setFeaturesRaw] = useState(
    plan?.features ? JSON.stringify(plan.features, null, 2) : "{\n  \"maxActiveListings\": 50,\n  \"featuredCreditsMonthly\": 5,\n  \"analyticsAccess\": true\n}"
  );

  const mutation = useMutation({
    mutationFn: () => {
      let parsedFeatures = {};
      try {
        parsedFeatures = JSON.parse(featuresRaw);
      } catch {
        // ignore invalid json
      }

      const body = {
        name: { ar: nameAr.trim(), en: nameEn.trim() || nameAr.trim() },
        description: { ar: descAr.trim(), en: descAr.trim() },
        priceCents: Math.round(Number(price) * 100),
        billingInterval,
        isActive,
        features: parsedFeatures,
        ...(!isEdit && code.trim() ? { code: code.trim().toUpperCase() } : {}),
      };

      if (isEdit && plan) {
        return adminFetch(adminPaths.subscriptionPlan(String(plan.id)), {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        return adminFetch(adminPaths.subscriptionPlans, {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
    },
    onSuccess,
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل باقة الاشتراك" : "إضافة باقة اشتراك جديدة"}</DialogTitle>
          <DialogDescription>
            تحديد تفاصيل الباقة، التكلفة، ودورة الفوترة
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          {!isEdit && (
            <div className="space-y-1">
              <Label>رمز الباقة الفريد (Code)</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="مثال: DEALER_STARTER_MONTHLY"
                dir="ltr"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>اسم الباقة (عربي)</Label>
              <Input
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder="باقة البداية / المحترفين"
              />
            </div>
            <div className="space-y-1">
              <Label>اسم الباقة (إنجليزي)</Label>
              <Input
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="Pro Plan / Enterprise"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>الوصف (عربي)</Label>
            <Input
              value={descAr}
              onChange={(e) => setDescAr(e.target.value)}
              placeholder="وصف مختصر لمزايا الباقة"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>السعر (ج.م)</Label>
              <Input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="1500"
              />
            </div>
            <div className="space-y-1">
              <Label>فترة الفوترة</Label>
              <CustomSelect
                value={billingInterval}
                onChange={(e) => setBillingInterval(e.target.value as "MONTHLY" | "YEARLY")}
                options={[
                  { value: "MONTHLY", label: "شهرياً (Monthly)" },
                  { value: "YEARLY", label: "سنوياً (Yearly)" },
                ]}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="plan-is-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-4 rounded border-input"
            />
            <Label htmlFor="plan-is-active" className="cursor-pointer">
              الباقة نشطة ومتاحة للاشتراك حالياً
            </Label>
          </div>

          <div className="space-y-1">
            <Label>المزايا والحصص (JSON format)</Label>
            <textarea
              value={featuresRaw}
              onChange={(e) => setFeaturesRaw(e.target.value)}
              rows={4}
              dir="ltr"
              className="w-full rounded-xl border border-input bg-background p-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
            />
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
            disabled={mutation.isPending || !nameAr.trim() || !price}
          >
            {mutation.isPending ? "جارٍ الحفظ…" : "حفظ الباقة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// METRIC CARD HELPER
// ─────────────────────────────────────────────────────────────────────────────

function MetricCard({
  title,
  value,
  icon: Icon,
  variant = "default",
}: {
  title: string;
  value: number;
  icon: typeof ReceiptText;
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
