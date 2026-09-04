'use client';

import { usePathname, useRouter } from 'next/navigation';
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
  SidebarRail,
  SidebarSeparator,
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
  ShieldCheck,
  DatabaseZap,
  Images,
  UsersRound,
  Building2,
  Tags,
  ShieldAlert,
  Handshake,
  Bell,
  ReceiptText,
  Megaphone,
  Zap,
  MapPin,
} from 'lucide-react';
import { endSession } from '@/lib/api';
import type { AdminIdentity } from '@/lib/admin-session';
import type { AdminCapability } from '@/lib/auth/permissions';

const navItems = [
  { title: 'لوحة التحكم', href: '/dashboard', icon: LayoutDashboard, capabilities: ['dashboard:read'] },
  { title: 'الإعلانات', href: '/listings', icon: Car, capabilities: ['listings:read'] },
  { title: 'ترويج الإعلانات (Boost)', href: '/promotions', icon: Zap, capabilities: ['marketing:read'] },
  { title: 'البنرات الإعلانية', href: '/banners', icon: Megaphone, capabilities: ['marketing:read'] },
  { title: 'بيانات السوق', href: '/market', icon: Tags, capabilities: ['taxonomy:read'] },
  { title: 'المواقع والمحافظات', href: '/locations', icon: MapPin, capabilities: ['taxonomy:read'] },
  { title: 'المستخدمون', href: '/users', icon: UsersRound, capabilities: ['users:read'] },
  { title: 'فريق العمل والصلاحيات', href: '/staff', icon: ShieldCheck, capabilities: ['admins:read'] },
  { title: 'المعارض', href: '/dealers', icon: Building2, capabilities: ['dealers:read'] },
  { title: 'الفوترة والاشتراكات', href: '/billing', icon: ReceiptText, capabilities: ['billing:read'] },
  { title: 'عمليات السوق', href: '/operations', icon: Handshake, capabilities: ['leads:read', 'offers:read', 'conversations:read'] },
  { title: 'الثقة والسلامة', href: '/trust', icon: ShieldAlert, capabilities: ['trust:read'] },
  { title: 'الإشعارات', href: '/notifications', icon: Bell, capabilities: ['notifications:read'] },
  { title: 'مركز البيانات', href: '/imports', icon: Upload, capabilities: ['imports:read'] },
  { title: 'تكامل هتلاقي', href: '/scraper', icon: Globe, capabilities: ['imports:run'] },
  { title: 'سجل الوظائف', href: '/jobs', icon: ListTodo, capabilities: ['ops:read'] },
  { title: 'Gemini Batch Runner', href: '/gemini-batch-runner', icon: Images, capabilities: ['ai:run'] },
  { title: 'الإعدادات', href: '/settings', icon: Settings, capabilities: ['settings:read'] },
  { title: 'سجل التدقيق', href: '/audit', icon: FileText, capabilities: ['audit:read'] },
] satisfies Array<{ title: string; href: string; icon: typeof Car; capabilities: AdminCapability[] }>;

export function AppSidebar({ identity }: { identity: AdminIdentity }) {
  const pathname = usePathname();
  const router = useRouter();
  async function logout() { await endSession(); router.replace('/login'); router.refresh(); }

  return (
    <Sidebar side="right" variant="inset" collapsible="icon" className="border-e-0">
      <SidebarHeader className="gap-4 border-b border-sidebar-border/70 p-4 group-data-[collapsible=icon]:p-2">
        <Link href="/dashboard" className="group/brand flex items-center gap-3 overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-md transition-transform duration-300 group-hover/brand:-rotate-3 group-hover/brand:scale-105">
            <Car className="size-5" />
          </span>
          <span className="min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-[1.05rem] font-bold tracking-tight">YallaMotors</span>
            <span className="block truncate text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Control Center</span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-2 py-3">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="mb-2 px-3 text-[0.65rem] font-bold tracking-[0.16em] uppercase">مساحة العمل</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {navItems.filter((item) => item.capabilities.some((capability) => identity.capabilities.includes(capability))).map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname?.startsWith(item.href) ?? false}
                    tooltip={item.title}
                    size="lg"
                    className="relative h-11 rounded-xl px-3 text-[0.84rem] font-semibold transition-all duration-200 hover:translate-x-0.5 data-active:bg-sidebar-primary data-active:text-sidebar-primary-foreground data-active:shadow-md group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:p-2.5!"
                  >
                    <item.icon className="size-[1.05rem]" />
                    <span>{item.title}</span>
                    {(pathname?.startsWith(item.href) ?? false) && (
                      <span className="absolute inset-y-2 end-1 w-0.5 rounded-full bg-sidebar-primary-foreground/70 group-data-[collapsible=icon]:hidden" />
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-3 border-t border-sidebar-border/70 p-3">
        <div className="rounded-xl border border-sidebar-border/70 bg-sidebar-accent/60 p-3 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2 text-xs font-bold">
            <DatabaseZap className="size-3.5" />
            <span>حالة المنصة</span>
            <span className="ms-auto size-1.5 rounded-full bg-sidebar-foreground" />
          </div>
          <p className="mt-1.5 text-[0.68rem] leading-5 text-sidebar-foreground/60">المراقبة والتدقيق يعملان بصورة مستمرة.</p>
        </div>
        <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />
        <div className="flex items-center gap-2 rounded-xl px-1.5 py-1">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sidebar-accent text-sidebar-accent-foreground">
            <ShieldCheck className="size-4" />
          </span>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-xs font-bold">{[identity.firstName, identity.lastName].filter(Boolean).join(' ') || identity.email}</p>
            <p className="truncate text-[0.65rem] text-muted-foreground">{identity.roles.join(' · ')}</p>
          </div>
          <button
            onClick={logout}
            aria-label="تسجيل الخروج"
            className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
