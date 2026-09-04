import { AppSidebar } from '@/components/layout/app-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { requireAdminSession } from '@/lib/auth/server-session';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await requireAdminSession();
  return (
    <SidebarProvider className="bg-muted/20">
      <AppSidebar identity={identity} />
      <SidebarInset className="min-w-0 bg-transparent">
        <AdminHeader />
        <main className="mx-auto w-full max-w-[100rem] flex-1 px-4 pt-5 md:px-7 md:pt-7 xl:px-9">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
