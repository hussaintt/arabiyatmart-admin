const fs = require('fs');
const path = require('path');

const files = {
  'src/i18n/request.ts': `import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = cookieStore.get('locale')?.value || 'ar';
  
  return {
    locale,
    messages: (await import(\`../../messages/\${locale}.json\`)).default,
  };
});
`,
  'src/i18n/routing.ts': `export const locales = ['ar', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ar';
`,
  'messages/ar.json': `{
  "common": {
    "appName": "يلا موتورز - لوحة التحكم",
    "dashboard": "لوحة التحكم",
    "listings": "الإعلانات",
    "imports": "الاستيراد",
    "scraper": "جامع البيانات",
    "jobs": "المهام",
    "settings": "الإعدادات",
    "auditLog": "سجل المراجعة",
    "login": "تسجيل الدخول",
    "logout": "تسجيل الخروج",
    "search": "بحث...",
    "save": "حفظ",
    "cancel": "إلغاء",
    "delete": "حذف",
    "edit": "تعديل",
    "approve": "موافقة",
    "reject": "رفض",
    "loading": "جاري التحميل...",
    "noResults": "لا توجد نتائج",
    "error": "حدث خطأ",
    "success": "تم بنجاح",
    "confirm": "تأكيد",
    "actions": "إجراءات",
    "status": "الحالة",
    "date": "التاريخ",
    "total": "الإجمالي",
    "of": "من",
    "page": "صفحة",
    "next": "التالي",
    "previous": "السابق",
    "all": "الكل",
    "selected": "محدد",
    "bulkActions": "إجراءات جماعية"
  },
  "dashboard": {
    "title": "لوحة التحكم",
    "totalListings": "إجمالي الإعلانات",
    "activeListings": "إعلانات نشطة",
    "pendingReview": "في انتظار المراجعة",
    "lastImport": "آخر استيراد",
    "pipelineHealth": "صحة النظام",
    "recentActivity": "النشاط الأخير"
  },
  "listings": {
    "title": "إدارة الإعلانات",
    "search": "بحث في الإعلانات...",
    "filterByStatus": "تصفية حسب الحالة",
    "filterByMake": "تصفية حسب الماركة",
    "filterBySource": "تصفية حسب المصدر",
    "sortBy": "ترتيب حسب",
    "newest": "الأحدث",
    "oldest": "الأقدم",
    "priceHighToLow": "السعر: من الأعلى للأقل",
    "priceLowToHigh": "السعر: من الأقل للأعلى",
    "year": "السنة",
    "make": "الماركة",
    "model": "الموديل",
    "price": "السعر",
    "mileage": "الممشى",
    "city": "المدينة",
    "status": "الحالة",
    "source": "المصدر",
    "images": "الصور",
    "details": "التفاصيل",
    "editListing": "تعديل الإعلان",
    "approveSelected": "موافقة على المحدد",
    "rejectSelected": "رفض المحدد",
    "deleteSelected": "حذف المحدد",
    "statusDraft": "مسودة",
    "statusPending": "قيد المراجعة",
    "statusActive": "نشط",
    "statusPaused": "متوقف",
    "statusRejected": "مرفوض",
    "statusExpired": "منتهي",
    "statusSold": "مباع",
    "statusArchived": "مؤرشف",
    "statusRemoved": "محذوف",
    "sourceManual": "يدوي",
    "sourceAdmin": "مدير",
    "sourceDealerCsv": "ملف تاجر",
    "sourceHatla2ee": "حط لي",
    "egp": "ج.م",
    "km": "كم"
  },
  "imports": {
    "title": "مركز الاستيراد",
    "newImport": "استيراد جديد",
    "uploadCsv": "رفع ملف CSV",
    "uploadImages": "رفع ملف الصور (ZIP)",
    "validate": "التحقق",
    "preview": "معاينة",
    "commit": "تنفيذ",
    "rollback": "تراجع",
    "history": "سجل الاستيراد",
    "duplicateStrategy": "استراتيجية التكرار",
    "skip": "تخطي",
    "updateExisting": "تحديث الموجود",
    "createNew": "إنشاء جديد"
  },
  "jobs": {
    "title": "المهام",
    "running": "قيد التنفيذ",
    "completed": "مكتمل",
    "failed": "فشل",
    "queued": "في الانتظار",
    "pause": "إيقاف مؤقت",
    "resume": "استئناف",
    "cancel": "إلغاء",
    "retry": "إعادة المحاولة",
    "progress": "التقدم",
    "duration": "المدة",
    "startedAt": "بدأ في",
    "triggeredBy": "بواسطة"
  },
  "auth": {
    "loginTitle": "تسجيل الدخول للوحة التحكم",
    "email": "البريد الإلكتروني",
    "password": "كلمة المرور",
    "mfaCode": "رمز المصادقة",
    "loginButton": "دخول",
    "verifyButton": "تحقق",
    "invalidCredentials": "بيانات الدخول غير صحيحة",
    "sessionExpired": "انتهت الجلسة، يرجى تسجيل الدخول مجدداً"
  }
}
`,
  'messages/en.json': `{
  "common": {
    "appName": "YallaMotors — Control Center",
    "dashboard": "Dashboard",
    "listings": "Listings",
    "imports": "Imports",
    "scraper": "Scraper",
    "jobs": "Jobs",
    "settings": "Settings",
    "auditLog": "Audit Log",
    "login": "Login",
    "logout": "Logout",
    "search": "Search...",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "approve": "Approve",
    "reject": "Reject",
    "loading": "Loading...",
    "noResults": "No results found",
    "error": "An error occurred",
    "success": "Success",
    "confirm": "Confirm",
    "actions": "Actions",
    "status": "Status",
    "date": "Date",
    "total": "Total",
    "of": "of",
    "page": "Page",
    "next": "Next",
    "previous": "Previous",
    "all": "All",
    "selected": "selected",
    "bulkActions": "Bulk Actions"
  },
  "dashboard": {
    "title": "Dashboard",
    "totalListings": "Total Listings",
    "activeListings": "Active Listings",
    "pendingReview": "Pending Review",
    "lastImport": "Last Import",
    "pipelineHealth": "Pipeline Health",
    "recentActivity": "Recent Activity"
  },
  "listings": {
    "title": "Listings Management",
    "search": "Search listings...",
    "filterByStatus": "Filter by status",
    "filterByMake": "Filter by make",
    "filterBySource": "Filter by source",
    "sortBy": "Sort by",
    "newest": "Newest",
    "oldest": "Oldest",
    "priceHighToLow": "Price: High to Low",
    "priceLowToHigh": "Price: Low to High",
    "year": "Year",
    "make": "Make",
    "model": "Model",
    "price": "Price",
    "mileage": "Mileage",
    "city": "City",
    "status": "Status",
    "source": "Source",
    "images": "Images",
    "details": "Details",
    "editListing": "Edit Listing",
    "approveSelected": "Approve Selected",
    "rejectSelected": "Reject Selected",
    "deleteSelected": "Delete Selected",
    "statusDraft": "Draft",
    "statusPending": "Pending Review",
    "statusActive": "Active",
    "statusPaused": "Paused",
    "statusRejected": "Rejected",
    "statusExpired": "Expired",
    "statusSold": "Sold",
    "statusArchived": "Archived",
    "statusRemoved": "Removed",
    "sourceManual": "Manual",
    "sourceAdmin": "Admin",
    "sourceDealerCsv": "Dealer CSV",
    "sourceHatla2ee": "Hatla2ee",
    "egp": "EGP",
    "km": "km"
  },
  "imports": {
    "title": "Import Center",
    "newImport": "New Import",
    "uploadCsv": "Upload CSV",
    "uploadImages": "Upload Images (ZIP)",
    "validate": "Validate",
    "preview": "Preview",
    "commit": "Commit",
    "rollback": "Rollback",
    "history": "Import History",
    "duplicateStrategy": "Duplicate Strategy",
    "skip": "Skip",
    "updateExisting": "Update Existing",
    "createNew": "Create New"
  },
  "jobs": {
    "title": "Jobs",
    "running": "Running",
    "completed": "Completed",
    "failed": "Failed",
    "queued": "Queued",
    "pause": "Pause",
    "resume": "Resume",
    "cancel": "Cancel",
    "retry": "Retry",
    "progress": "Progress",
    "duration": "Duration",
    "startedAt": "Started at",
    "triggeredBy": "Triggered by"
  },
  "auth": {
    "loginTitle": "Admin Login",
    "email": "Email",
    "password": "Password",
    "mfaCode": "Authentication Code",
    "loginButton": "Sign In",
    "verifyButton": "Verify",
    "invalidCredentials": "Invalid credentials",
    "sessionExpired": "Session expired, please sign in again"
  }
}
`,
  'src/app/layout.tsx': `import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Cairo } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/components/providers/query-provider';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
});

export const metadata: Metadata = {
  title: 'YallaMotors — Control Center',
  description: 'Admin & Control Center for YallaMotors marketplace',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className={\`\${cairo.variable} font-sans antialiased\`}>
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            {children}
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
`,
  'src/app/(auth)/login/page.tsx': `export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-4 rounded-lg border p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-center">YallaMotors Admin</h1>
        <p className="text-center text-muted-foreground">Login page — Module B</p>
      </div>
    </div>
  );
}
`,
  'src/app/(admin)/layout.tsx': `import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbPage } from '@/components/ui/breadcrumb';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ms-1" />
          <Separator orientation="vertical" className="me-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Dashboard</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className="flex-1 p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
`,
  'src/app/(admin)/dashboard/page.tsx': `export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">Dashboard content — Module F</p>
    </div>
  );
}
`,
  'src/app/(admin)/listings/page.tsx': `export default function ListingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Listings Management</h1>
      <p className="text-muted-foreground">Listings Management — Module C</p>
    </div>
  );
}
`,
  'src/app/(admin)/listings/[publicId]/page.tsx': `export default function ListingDetailPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Listing Detail</h1>
      <p className="text-muted-foreground">Listing Detail — Module C</p>
    </div>
  );
}
`,
  'src/app/(admin)/imports/page.tsx': `export default function ImportsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Import Center</h1>
      <p className="text-muted-foreground">Import Center — Module D</p>
    </div>
  );
}
`,
  'src/app/(admin)/imports/new/page.tsx': `export default function NewImportPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New Import</h1>
      <p className="text-muted-foreground">New Import — Module D</p>
    </div>
  );
}
`,
  'src/app/(admin)/jobs/page.tsx': `export default function JobsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Jobs</h1>
      <p className="text-muted-foreground">Jobs — Module E</p>
    </div>
  );
}
`,
  'src/app/(admin)/jobs/[jobId]/page.tsx': `export default function JobDetailPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Job Detail</h1>
      <p className="text-muted-foreground">Job Detail — Module E</p>
    </div>
  );
}
`,
  'src/app/(admin)/scraper/page.tsx': `export default function ScraperPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Scraper</h1>
      <p className="text-muted-foreground">Scraper — Module G</p>
    </div>
  );
}
`,
  'src/app/(admin)/settings/page.tsx': `export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-muted-foreground">Settings — Module F</p>
    </div>
  );
}
`,
  'src/app/(admin)/audit/page.tsx': `export default function AuditPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit Log</h1>
      <p className="text-muted-foreground">Audit Log — Module F</p>
    </div>
  );
}
`,
  'src/components/layout/app-sidebar.tsx': `'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Car,
  Upload,
  Globe,
  ListTodo,
  Settings,
  FileText,
  LogOut,
} from 'lucide-react';

const navItems = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Listings', href: '/listings', icon: Car },
  { title: 'Imports', href: '/imports', icon: Upload },
  { title: 'Scraper', href: '/scraper', icon: Globe },
  { title: 'Jobs', href: '/jobs', icon: ListTodo },
  { title: 'Settings', href: '/settings', icon: Settings },
  { title: 'Audit Log', href: '/audit', icon: FileText },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Car className="h-6 w-6" />
          <span className="text-lg font-bold">YallaMotors</span>
        </Link>
        <span className="text-xs text-muted-foreground">Control Center</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname?.startsWith(item.href) ?? false}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <button className="flex w-full items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
`,
  'src/components/providers/query-provider.tsx': `'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
`,
  '.env.local': `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
`,
  'next.config.ts': `import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: \`\${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'}/:path*\`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
`
};

for (const [filePath, content] of Object.entries(files)) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}
