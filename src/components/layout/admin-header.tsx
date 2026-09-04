"use client";

import { usePathname } from "next/navigation";
import { CalendarDays, ShieldCheck } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const routeMeta = [
  { path: "/dashboard", title: "لوحة التحكم", section: "نظرة عامة" },
  { path: "/listings", title: "إدارة الإعلانات", section: "المحتوى والسوق" },
  { path: "/market", title: "بيانات السوق والسيارات", section: "المحتوى والسوق" },
  { path: "/users", title: "المستخدمون والحسابات", section: "إدارة السوق" },
  { path: "/dealers", title: "المعارض والبائعون", section: "إدارة السوق" },
  { path: "/trust", title: "الثقة والسلامة", section: "الإشراف والامتثال" },
  { path: "/operations", title: "عمليات السوق", section: "التحويل والتواصل" },
  { path: "/imports", title: "مركز البيانات", section: "الاستيراد والمعالجة" },
  { path: "/scraper", title: "مركز السكرابر", section: "المصادر الخارجية" },
  { path: "/jobs", title: "سجل الوظائف", section: "العمليات" },
  { path: "/gemini-batch-runner", title: "Gemini Batch Runner", section: "معالجة الصور بالذكاء الاصطناعي" },
  { path: "/settings", title: "إعدادات المنصة", section: "النظام" },
  { path: "/audit", title: "سجل التدقيق", section: "الأمان والامتثال" },
];

export function AdminHeader() {
  const pathname = usePathname();
  const meta = routeMeta.find((item) => pathname.startsWith(item.path)) ?? routeMeta[0];
  const today = new Intl.DateTimeFormat("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <header className="sticky top-0 z-30 flex h-[4.5rem] shrink-0 items-center justify-between border-b border-border/60 bg-background/82 px-4 backdrop-blur-xl md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className="-ms-1" aria-label="فتح قائمة التنقل" />
        <Separator orientation="vertical" className="hidden h-6 sm:block" />
        <div className="min-w-0">
          <p className="truncate text-[0.68rem] font-bold tracking-[0.12em] text-muted-foreground uppercase">
            {meta.section}
          </p>
          <h2 className="truncate text-base font-bold tracking-tight md:text-lg">{meta.title}</h2>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="hidden items-center gap-2 rounded-xl border border-border/70 bg-card/80 px-3 py-2 text-xs text-muted-foreground shadow-xs lg:flex">
          <CalendarDays className="size-3.5" />
          <span>{today}</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/80 px-3 py-2 text-xs font-semibold shadow-xs">
          <span className="status-dot" aria-hidden="true" />
          <ShieldCheck className="size-3.5 text-muted-foreground" />
          <span className="hidden sm:inline">جلسة إدارية آمنة</span>
          <span className="sm:hidden">آمنة</span>
        </div>
      </div>
    </header>
  );
}
