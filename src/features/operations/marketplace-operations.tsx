"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  BadgeDollarSign,
  CheckCircle2,
  ChevronLeft,
  Code,
  FileJson,
  Layers,
  MessageCircle,
  PhoneCall,
  Radio,
  RefreshCw,
  Server,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { ActionDialog } from "@/components/admin/action-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminFetch, type ApiError } from "@/lib/api";
import { adminPaths } from "@/lib/api/paths";
import { Header, date, ErrorState, Loading } from "@/features/people/users-list";
import { CustomSelect } from "@/components/ui/custom-select";
import type { AdminCapability } from "@/lib/auth/permissions";

type Page<T> = { data: T[]; meta: { hasMore: boolean; nextCursor: string | null } };
type Person = { publicId: string; email: string; firstName: string | null; lastName: string | null };
type Listing = { publicId: string; slug: string; title: string; priceCents?: number };
type Lead = { publicId: string; channel: string; status: string; eventsCount: number; buyerPhone: string | null; buyerName: string | null; note: string | null; lastActivityAt: string; createdAt: string; buyer: Person | null; listing: Listing };
type Offer = { publicId: string; offerCents: number; counterCents: number | null; currency: string; status: string; message: string | null; sellerNote: string | null; expiresAt: string; createdAt: string; buyer: Person; listing: Listing };
type Conversation = { publicId: string; status: string; lastMessageAt: string | null; lastMessagePreview: string | null; messagesCount: number; buyer: Person; seller: Person | null; listing: Listing };
type Message = { publicId: string; type: string; body: string | null; createdAt: string; sender: Person };

type QueueSnapshot = {
  queues: Array<{
    name: string;
    counts: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
      paused: number;
    };
    deadLetterPreview: Array<{
      id: string;
      name: string;
      failedReason?: string;
      timestamp: number;
    }>;
  }>;
};

type WebhookEventItem = {
  id: number;
  gateway: string;
  signatureValid: boolean;
  externalId: string | null;
  payload: Record<string, unknown> | null;
  processedAt: string | null;
  createdAt: string;
};

type Tab = "leads" | "offers" | "conversations" | "queues" | "webhooks";

export function MarketplaceOperations({ capabilities }: { capabilities: AdminCapability[] | string[] }) {
  const client = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const available: Tab[] = [];
  if (capabilities.includes("leads:read")) available.push("leads");
  if (capabilities.includes("offers:read")) available.push("offers");
  if (capabilities.includes("conversations:read")) available.push("conversations");
  if (capabilities.includes("ops:read")) {
    available.push("queues");
    available.push("webhooks");
  }

  const [tab, setTab] = useState<Tab>(available[0] ?? "leads");

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      client.invalidateQueries({ queryKey: ["market-leads"] }),
      client.invalidateQueries({ queryKey: ["market-offers"] }),
      client.invalidateQueries({ queryKey: ["market-conversations"] }),
      client.invalidateQueries({ queryKey: ["admin-ops-queues"] }),
      client.invalidateQueries({ queryKey: ["admin-ops-webhooks"] }),
    ]);
    setRefreshing(false);
  };

  return (
    <div className="space-y-6 pb-10">
      <Header
        title="عمليات وتشغيل السوق"
        description="متابعة رحلة التحويل: الطلبات، عروض الأسعار، والمحادثات، بالإضافة إلى مراقبة طوابير المهام وبوابات الدفع."
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />
      <div className="flex flex-wrap gap-2">
        {available.map((item) => (
          <Button
            key={item}
            variant={tab === item ? "default" : "outline"}
            onClick={() => setTab(item)}
          >
            {item === "leads" && <PhoneCall className="size-4" />}
            {item === "offers" && <BadgeDollarSign className="size-4" />}
            {item === "conversations" && <MessageCircle className="size-4" />}
            {item === "queues" && <Server className="size-4" />}
            {item === "webhooks" && <Radio className="size-4" />}
            <span>
              {item === "leads"
                ? "الطلبات"
                : item === "offers"
                ? "العروض"
                : item === "conversations"
                ? "المحادثات"
                : item === "queues"
                ? "طوابير المهام (BullMQ)"
                : "سجلات بوابات الدفع (Webhooks)"}
            </span>
          </Button>
        ))}
      </div>

      {tab === "leads" ? (
        <Leads canWrite={capabilities.includes("leads:write")} />
      ) : tab === "offers" ? (
        <Offers canModerate={capabilities.includes("offers:moderate")} />
      ) : tab === "conversations" ? (
        <Conversations canModerate={capabilities.includes("conversations:moderate")} />
      ) : tab === "queues" ? (
        <QueuesHealth />
      ) : (
        <WebhooksInspector />
      )}
    </div>
  );
}

function usePage<T>(path: string, key: string, status: string, cursor: string | null) {
  const params = new URLSearchParams({ limit: "30", ...(status !== "ALL" ? { status } : {}), ...(cursor ? { cursor } : {}) });
  return useQuery({ queryKey: [key, params.toString()], queryFn: () => adminFetch<Page<T>>(`${path}?${params}`) });
}

function Leads({ canWrite }: { canWrite: boolean }) {
  const client = useQueryClient();
  const [status, setStatus] = useState("ALL");
  const [cursor, setCursor] = useState<string | null>(null);
  const [target, setTarget] = useState<Lead | null>(null);
  const [nextStatus, setNextStatus] = useState("CONTACTED");
  const query = usePage<Lead>(adminPaths.marketplaceLeads, "market-leads", status, cursor);
  const mutation = useMutation({
    mutationFn: (note: string) =>
      adminFetch(adminPaths.marketplaceLeadStatus(target!.publicId), {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus, note: note || undefined }),
      }),
    onSuccess: async () => {
      setTarget(null);
      await client.invalidateQueries({ queryKey: ["market-leads"] });
    },
  });

  return (
    <ResourceCard
      title="طلبات التواصل"
      status={status}
      statuses={["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST", "SPAM"]}
      onStatus={(value) => { setStatus(value); setCursor(null); }}
      loading={query.isLoading}
      error={query.error as ApiError}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>الإعلان</TableHead>
            <TableHead>المشتري</TableHead>
            <TableHead>القناة</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead>آخر نشاط</TableHead>
            {canWrite && <TableHead>إدارة</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.data?.data.map((lead) => (
            <TableRow key={lead.publicId}>
              <TableCell>
                <Link href={`/listings/${lead.listing.publicId}`} className="font-bold hover:underline">
                  {lead.listing.title}
                </Link>
                <p className="text-xs text-muted-foreground" dir="ltr">{lead.publicId}</p>
              </TableCell>
              <TableCell>
                <strong>{lead.buyerName || [lead.buyer?.firstName, lead.buyer?.lastName].filter(Boolean).join(" ") || "زائر"}</strong>
                <p className="text-xs text-muted-foreground" dir="ltr">{lead.buyerPhone || lead.buyer?.email || "—"}</p>
              </TableCell>
              <TableCell><Badge variant="outline">{lead.channel}</Badge></TableCell>
              <TableCell><Badge>{lead.status}</Badge></TableCell>
              <TableCell className="text-xs text-muted-foreground">{date(lead.lastActivityAt)}</TableCell>
              {canWrite && (
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => { setTarget(lead); setNextStatus(lead.status === "NEW" ? "CONTACTED" : "QUALIFIED"); }}>
                    تحديث
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {query.data?.meta.hasMore && <More onClick={() => setCursor(query.data!.meta.nextCursor)} />}
      <ActionDialog
        open={Boolean(target)}
        onOpenChange={(open) => { if (!open) setTarget(null); }}
        title="تحديث حالة الطلب"
        description={`ستنتقل الحالة إلى ${nextStatus}. أضف ملاحظة للفريق.`}
        confirmLabel="تحديث"
        requireReason
        pending={mutation.isPending}
        error={(mutation.error as ApiError | null)?.message}
        onConfirm={(reason) => mutation.mutate(reason)}
      />
    </ResourceCard>
  );
}

function Offers({ canModerate }: { canModerate: boolean }) {
  const client = useQueryClient();
  const [status, setStatus] = useState("ALL");
  const [cursor, setCursor] = useState<string | null>(null);
  const [target, setTarget] = useState<{ offer: Offer; status: "REJECTED" | "EXPIRED" } | null>(null);
  const query = usePage<Offer>(adminPaths.marketplaceOffers, "market-offers", status, cursor);
  const mutation = useMutation({
    mutationFn: (reason: string) =>
      adminFetch(adminPaths.marketplaceOfferStatus(target!.offer.publicId), {
        method: "PATCH",
        body: JSON.stringify({ status: target!.status, reason }),
      }),
    onSuccess: async () => {
      setTarget(null);
      await client.invalidateQueries({ queryKey: ["market-offers"] });
    },
  });

  return (
    <ResourceCard
      title="عروض الأسعار"
      status={status}
      statuses={["PENDING", "COUNTERED", "ACCEPTED", "REJECTED", "EXPIRED", "WITHDRAWN"]}
      onStatus={(value) => { setStatus(value); setCursor(null); }}
      loading={query.isLoading}
      error={query.error as ApiError}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>الإعلان</TableHead>
            <TableHead>العرض</TableHead>
            <TableHead>مقابل السعر</TableHead>
            <TableHead>المشتري</TableHead>
            <TableHead>الحالة</TableHead>
            {canModerate && <TableHead>إشراف</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.data?.data.map((offer) => (
            <TableRow key={offer.publicId}>
              <TableCell>
                <Link href={`/listings/${offer.listing.publicId}`} className="font-bold hover:underline">
                  {offer.listing.title}
                </Link>
              </TableCell>
              <TableCell className="font-bold">{money(offer.offerCents, offer.currency)}</TableCell>
              <TableCell>{offer.listing.priceCents ? money(offer.listing.priceCents, offer.currency) : "—"}</TableCell>
              <TableCell dir="ltr">{offer.buyer.email}</TableCell>
              <TableCell><Badge>{offer.status}</Badge></TableCell>
              {canModerate && (
                <TableCell>
                  {["PENDING", "COUNTERED"].includes(offer.status) && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="destructive" onClick={() => setTarget({ offer, status: "REJECTED" })}>
                        رفض
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setTarget({ offer, status: "EXPIRED" })}>
                        إنهاء
                      </Button>
                    </div>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {query.data?.meta.hasMore && <More onClick={() => setCursor(query.data!.meta.nextCursor)} />}
      <ActionDialog
        open={Boolean(target)}
        onOpenChange={(open) => { if (!open) setTarget(null); }}
        title="إجراء إشرافي على العرض"
        description="لن تقبل الإدارة عرضًا نيابة عن البائع؛ الإشراف يسمح فقط برفض عرض مخالف أو إنهاء عرض منتهي."
        confirmLabel="تأكيد"
        requireReason
        destructive
        pending={mutation.isPending}
        error={(mutation.error as ApiError | null)?.message}
        onConfirm={(reason) => mutation.mutate(reason)}
      />
    </ResourceCard>
  );
}

function Conversations({ canModerate }: { canModerate: boolean }) {
  const client = useQueryClient();
  const [status, setStatus] = useState("ALL");
  const [cursor, setCursor] = useState<string | null>(null);
  const [opened, setOpened] = useState<Conversation | null>(null);
  const [target, setTarget] = useState<{ conversation: Conversation; status: "ARCHIVED" | "BLOCKED" | "ACTIVE" } | null>(null);
  const query = usePage<Conversation>(adminPaths.marketplaceConversations, "market-conversations", status, cursor);
  const messages = useQuery({
    queryKey: ["conversation-messages", opened?.publicId],
    queryFn: () => adminFetch<{ data: Message[] }>(adminPaths.marketplaceConversationMessages(opened!.publicId)),
    enabled: Boolean(opened),
  });
  const mutation = useMutation({
    mutationFn: (reason: string) =>
      adminFetch(adminPaths.marketplaceConversationStatus(target!.conversation.publicId), {
        method: "PATCH",
        body: JSON.stringify({ status: target!.status, reason: reason || undefined }),
      }),
    onSuccess: async () => {
      setTarget(null);
      await client.invalidateQueries({ queryKey: ["market-conversations"] });
    },
  });

  return (
    <ResourceCard
      title="المحادثات"
      status={status}
      statuses={["ACTIVE", "ARCHIVED", "BLOCKED"]}
      onStatus={(value) => { setStatus(value); setCursor(null); }}
      loading={query.isLoading}
      error={query.error as ApiError}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>الإعلان</TableHead>
            <TableHead>الأطراف</TableHead>
            <TableHead>آخر رسالة</TableHead>
            <TableHead>الرسائل</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead>إجراء</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.data?.data.map((conversation) => (
            <TableRow key={conversation.publicId}>
              <TableCell>
                <Link href={`/listings/${conversation.listing.publicId}`} className="font-bold hover:underline">
                  {conversation.listing.title}
                </Link>
              </TableCell>
              <TableCell className="text-xs">
                <p dir="ltr">{conversation.buyer.email}</p>
                <p dir="ltr" className="text-muted-foreground">{conversation.seller?.email ?? "dealer"}</p>
              </TableCell>
              <TableCell className="max-w-xs text-xs text-muted-foreground">{conversation.lastMessagePreview || "—"}</TableCell>
              <TableCell>{conversation.messagesCount}</TableCell>
              <TableCell><Badge variant={conversation.status === "BLOCKED" ? "destructive" : "outline"}>{conversation.status}</Badge></TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setOpened(conversation)}>عرض</Button>
                  {canModerate && (conversation.status === "BLOCKED" ? (
                    <Button size="sm" onClick={() => setTarget({ conversation, status: "ACTIVE" })}>فتح</Button>
                  ) : (
                    <Button size="sm" variant="destructive" onClick={() => setTarget({ conversation, status: "BLOCKED" })}>
                      <ShieldAlert className="size-3.5" /> حظر
                    </Button>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {query.data?.meta.hasMore && <More onClick={() => setCursor(query.data!.meta.nextCursor)} />}
      <Dialog open={Boolean(opened)} onOpenChange={(open) => { if (!open) setOpened(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>سجل المحادثة</DialogTitle>
            <DialogDescription>الوصول إلى محتوى الرسائل محمي بصلاحية مستقلة ويستخدم فقط للتحقيق.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto rounded-xl bg-muted/40 p-3">
            {messages.isLoading ? (
              "جارٍ التحميل…"
            ) : (
              messages.data?.data.map((message) => (
                <div key={message.publicId} className="rounded-xl border bg-background p-3 text-sm">
                  <p>{message.body || `[${message.type}]`}</p>
                  <p className="mt-2 text-[0.68rem] text-muted-foreground" dir="ltr">
                    {message.sender.email} · {date(message.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      <ActionDialog
        open={Boolean(target)}
        onOpenChange={(open) => { if (!open) setTarget(null); }}
        title={target?.status === "BLOCKED" ? "حظر المحادثة" : "إعادة فتح المحادثة"}
        description="سيُسجل القرار والسبب في سجل التدقيق."
        confirmLabel="تأكيد"
        requireReason={target?.status === "BLOCKED"}
        destructive={target?.status === "BLOCKED"}
        pending={mutation.isPending}
        error={(mutation.error as ApiError | null)?.message}
        onConfirm={(reason) => mutation.mutate(reason)}
      />
    </ResourceCard>
  );
}

// --- Queue Health Component ---
function QueuesHealth() {
  const [selectedDeadLetter, setSelectedDeadLetter] = useState<{
    queueName: string;
    jobs: Array<{ id: string; name: string; failedReason?: string; timestamp: number }>;
  } | null>(null);

  const query = useQuery({
    queryKey: ["admin-ops-queues"],
    queryFn: () => adminFetch<QueueSnapshot>(adminPaths.opsQueues),
    refetchInterval: 10000,
  });

  const queues = query.data?.queues ?? [];
  const totalActive = queues.reduce((sum, q) => sum + (q.counts.active || 0), 0);
  const totalWaiting = queues.reduce((sum, q) => sum + (q.counts.waiting || 0), 0);
  const totalFailed = queues.reduce((sum, q) => sum + (q.counts.failed || 0), 0);

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground">الطوابير العاملة</CardTitle>
            <Server className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{query.isLoading ? "—" : queues.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">BullMQ Redis Workers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground">المهام الجارية (Active)</CardTitle>
            <Activity className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-600">{query.isLoading ? "—" : totalActive}</div>
            <p className="mt-1 text-xs text-muted-foreground">تُعالج حالياً في الخلفية</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground">المهام بالانتظار (Waiting)</CardTitle>
            <Layers className="size-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-600">{query.isLoading ? "—" : totalWaiting}</div>
            <p className="mt-1 text-xs text-muted-foreground">في قائمة الانتظار للتشغيل</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground">المهام الفاشلة (Failed)</CardTitle>
            <AlertCircle className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-destructive">{query.isLoading ? "—" : totalFailed}</div>
            <p className="mt-1 text-xs text-muted-foreground">Dead-letter queue</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>حالة طوابير المهام في الوقت الفعلي</CardTitle>
              <CardDescription>
                مراقبة حية لمعالجات الذكاء الاصطناعي، تكامل الاستيراد، الفوترة الدورية، الإشعارات ورسائل البريد.
              </CardDescription>
            </div>
            <Badge variant="outline" className="gap-1.5 py-1 text-xs">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>تحديث تلقائي (10 ثوانٍ)</span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {query.isLoading ? (
            <Loading />
          ) : query.error ? (
            <ErrorState error={query.error as ApiError} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>اسم الطابور (Queue)</TableHead>
                    <TableHead>نشطة (Active)</TableHead>
                    <TableHead>بالانتظار (Waiting)</TableHead>
                    <TableHead>مكتملة (Completed)</TableHead>
                    <TableHead>فاشلة (Failed)</TableHead>
                    <TableHead>مؤجلة (Delayed)</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="text-end">التفاصيل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queues.map((q) => {
                    const isPaused = q.counts.paused > 0;
                    const hasFailed = q.counts.failed > 0;
                    const isActive = q.counts.active > 0;

                    return (
                      <TableRow key={q.name}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold" dir="ltr">{q.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-bold ${isActive ? "text-emerald-600 font-black" : "text-muted-foreground"}`}>
                            {q.counts.active}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={q.counts.waiting > 0 ? "font-bold text-amber-600" : "text-muted-foreground"}>
                            {q.counts.waiting}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold text-muted-foreground">
                          {q.counts.completed.toLocaleString("ar-EG")}
                        </TableCell>
                        <TableCell>
                          <span className={hasFailed ? "font-bold text-destructive" : "text-muted-foreground"}>
                            {q.counts.failed}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {q.counts.delayed}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isPaused ? "secondary" : "default"}>
                            {isPaused ? "متوقف مؤقتاً" : "يعمل"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-end">
                          {hasFailed && q.deadLetterPreview?.length > 0 ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs text-destructive hover:bg-destructive/10"
                              onClick={() => setSelectedDeadLetter({ queueName: q.name, jobs: q.deadLetterPreview })}
                            >
                              فحص الأخطاء ({q.deadLetterPreview.length})
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dead-letter modal */}
      <Dialog open={Boolean(selectedDeadLetter)} onOpenChange={(open) => !open && setSelectedDeadLetter(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="size-5" />
              <span>أخطاء طابور {selectedDeadLetter?.queueName}</span>
            </DialogTitle>
            <DialogDescription>
              آخر المهام التي تعذرت معالجتها في طابور المهام.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto py-2">
            {selectedDeadLetter?.jobs.map((job) => (
              <div key={job.id} className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs space-y-1">
                <div className="flex items-center justify-between font-mono">
                  <strong>Job #{job.id}</strong>
                  <span className="text-muted-foreground">{new Date(job.timestamp).toLocaleString("ar-EG")}</span>
                </div>
                <p className="font-semibold">{job.name}</p>
                {job.failedReason && (
                  <p className="font-mono text-destructive bg-destructive/10 p-2 rounded-lg break-all">
                    {job.failedReason}
                  </p>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Webhooks Inspector Component ---
function WebhooksInspector() {
  const [gateway, setGateway] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [cursor, setCursor] = useState<string | null>(null);
  const [viewPayload, setViewPayload] = useState<WebhookEventItem | null>(null);

  const params = new URLSearchParams({ limit: "25" });
  if (gateway !== "ALL") params.set("gateway", gateway);
  if (status !== "ALL") params.set("status", status);
  if (cursor) params.set("cursor", cursor);

  const query = useQuery({
    queryKey: ["admin-ops-webhooks", params.toString()],
    queryFn: () => adminFetch<{ data: WebhookEventItem[]; meta: { hasMore: boolean; nextCursor: string | null } }>(
      `${adminPaths.opsWebhooks}?${params.toString()}`
    ),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Radio className="size-5 text-primary" />
                <span>سجلات إشارات بوابات الدفع (Webhooks)</span>
              </CardTitle>
              <CardDescription>
                سجل الاستجابة للإشعارات اللحظية من بوابات الدفع الإلكتروني (Paymob، فوري، المحافظ الإلكترونية).
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="w-36">
                <CustomSelect
                  value={gateway}
                  onChange={(e) => { setGateway(e.target.value); setCursor(null); }}
                  options={[
                    { value: "ALL", label: "كل البوابات" },
                    { value: "PAYMOB", label: "Paymob" },
                    { value: "FAWRY", label: "فوري" },
                    { value: "VODAFONE_CASH", label: "فودافون كاش" },
                  ]}
                />
              </div>
              <div className="w-36">
                <CustomSelect
                  value={status}
                  onChange={(e) => { setStatus(e.target.value); setCursor(null); }}
                  options={[
                    { value: "ALL", label: "كل التواقيع" },
                    { value: "valid", label: "توقيع صحيح" },
                    { value: "invalid", label: "توقيع غير مطابق" },
                  ]}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {query.isLoading ? (
            <Loading />
          ) : query.error ? (
            <ErrorState error={query.error as ApiError} />
          ) : !query.data?.data.length ? (
            <div className="grid min-h-48 place-items-center text-center">
              <div>
                <Radio className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-2 font-bold">لا توجد إشارات مسجلة</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>معرف الحدث</TableHead>
                    <TableHead>بوابة الدفع</TableHead>
                    <TableHead>صحة التوقيع (HMAC)</TableHead>
                    <TableHead>المعرف الخارجي (External ID)</TableHead>
                    <TableHead>تاريخ الوصول</TableHead>
                    <TableHead className="text-end">الحمولة (Payload)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.data.data.map((evt) => (
                    <TableRow key={evt.id}>
                      <TableCell className="font-mono text-xs font-bold">#{evt.id}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-bold">
                          {evt.gateway}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {evt.signatureValid ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
                            <CheckCircle2 className="size-4" />
                            <span>توقيع معتمد</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-destructive font-bold">
                            <XCircle className="size-4" />
                            <span>توقيع غير مطابق</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell dir="ltr" className="font-mono text-xs text-muted-foreground">
                        {evt.externalId || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {date(evt.createdAt)}
                      </TableCell>
                      <TableCell className="text-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs"
                          onClick={() => setViewPayload(evt)}
                        >
                          <FileJson className="size-3.5" />
                          <span>عرض الحمولة</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {query.data?.meta.hasMore && (
          <More onClick={() => setCursor(query.data!.meta.nextCursor)} />
        )}
      </Card>

      {/* Payload dialog */}
      <Dialog open={Boolean(viewPayload)} onOpenChange={(open) => !open && setViewPayload(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="size-5 text-primary" />
              <span>حمولة الإشارة #{viewPayload?.id} ({viewPayload?.gateway})</span>
            </DialogTitle>
            <DialogDescription>
              البيانات الخام المستلمة عبر HTTP POST من بوابة الدفع.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto rounded-xl border bg-muted/40 p-4">
            <pre dir="ltr" className="font-mono text-xs leading-relaxed">
              {JSON.stringify(viewPayload?.payload ?? {}, null, 2)}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResourceCard({
  title,
  status,
  statuses,
  onStatus,
  loading,
  error,
  children,
}: {
  title: string;
  status: string;
  statuses: string[];
  onStatus: (value: string) => void;
  loading: boolean;
  error: ApiError | null;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-4">
          <CardTitle>{title}</CardTitle>
          <div className="w-48">
            <CustomSelect
              value={status}
              onChange={(e) => onStatus(e.target.value)}
              options={[
                { value: "ALL", label: "كل الحالات" },
                ...statuses.map((item) => ({ value: item, label: item })),
              ]}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <Loading /> : error ? <ErrorState error={error} /> : <div className="overflow-x-auto">{children}</div>}
      </CardContent>
    </Card>
  );
}

function More({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-end border-t p-4">
      <Button variant="outline" onClick={onClick}>
        المزيد <ChevronLeft className="size-4" />
      </Button>
    </div>
  );
}

function money(value: number, currency: string) {
  return `${(value / 100).toLocaleString("ar-EG")} ${currency}`;
}
