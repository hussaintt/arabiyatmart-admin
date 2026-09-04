"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CheckCircle2,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { ActionDialog } from "@/components/admin/action-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomSelect } from "@/components/ui/custom-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminFetch, type ApiError } from "@/lib/api";
import { adminPaths } from "@/lib/api/paths";
import { personName, roleNames, type AdminUser } from "@/features/people/types";
import { date, ErrorState, Loading } from "@/features/people/users-list";

type SystemRole = {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
};

type StaffListResponse = {
  data: AdminUser[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
};

const PREDEFINED_ROLES = [
  {
    name: "SUPER_ADMIN",
    label: "مدير أعلى (Super Admin)",
    description: "كامل الصلاحيات دون قيود: إدارة الأدوار، العمليات التقنية، الصيانة وإدارة الفريق.",
    badgeClass: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  },
  {
    name: "ADMIN",
    label: "مدير منصة (Platform Admin)",
    description: "إدارة شاملة للإعلانات، المعارض، الفوترة، البنرات والترويج، مع تقارير السوق.",
    badgeClass: "bg-primary/10 text-primary border-primary/20",
  },
  {
    name: "MODERATOR",
    label: "مشرف محتوى (Moderator)",
    description: "مراجعة الإعلانات الجديدة، فحص التكرار، التحقق من هويات KYC، وحل البلاغات.",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  {
    name: "SUPPORT",
    label: "خدمة عملاء (Support)",
    description: "متابعة حسابات المستخدمين، طلبات التواصل، عروض الأسعار، والمحادثات.",
    badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  },
  {
    name: "ANALYST",
    label: "محلل بيانات (Analyst)",
    description: "الاطلاع على المؤشرات البيانية، لوحات القياس، وسجلات النشاط وتحميل التقارير.",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  },
];

export function StaffControl({ canWrite }: { canWrite: boolean }) {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [manageRolesUser, setManageRolesUser] = useState<AdminUser | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ user: AdminUser; action: "ACTIVE" | "SUSPENDED" } | null>(null);
  const [selectedRoleToAdd, setSelectedRoleToAdd] = useState<string>("");

  // Create staff user form state
  const [createForm, setCreateForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    roles: ["MODERATOR"],
  });

  const staffQuery = useQuery({
    queryKey: ["admin-staff-list"],
    queryFn: () => adminFetch<StaffListResponse>(adminPaths.staff),
  });

  const rolesQuery = useQuery({
    queryKey: ["admin-system-roles"],
    queryFn: () => adminFetch<SystemRole[]>(adminPaths.roles),
  });

  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["admin-staff-list"] }),
      client.invalidateQueries({ queryKey: ["admin-system-roles"] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      adminFetch(adminPaths.adminUserCreate, {
        method: "POST",
        body: JSON.stringify({
          firstName: createForm.firstName.trim(),
          lastName: createForm.lastName.trim(),
          email: createForm.email.trim(),
          password: createForm.password,
          roles: createForm.roles,
        }),
      }),
    onSuccess: async () => {
      setCreateModalOpen(false);
      setCreateForm({ firstName: "", lastName: "", email: "", password: "", roles: ["MODERATOR"] });
      await refresh();
    },
  });

  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: number }) =>
      adminFetch(adminPaths.roleAssign, {
        method: "POST",
        body: JSON.stringify({ userId, roleId }),
      }),
    onSuccess: async () => {
      setSelectedRoleToAdd("");
      await refresh();
      if (manageRolesUser) {
        const updated = (staffQuery.data?.data ?? []).find((u) => u.publicId === manageRolesUser.publicId);
        if (updated) setManageRolesUser(updated);
      }
    },
  });

  const revokeRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: number }) =>
      adminFetch(adminPaths.roleRevoke(userId, roleId), {
        method: "DELETE",
      }),
    onSuccess: async () => {
      await refresh();
      if (manageRolesUser) {
        const updated = (staffQuery.data?.data ?? []).find((u) => u.publicId === manageRolesUser.publicId);
        if (updated) setManageRolesUser(updated);
      }
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ userPublicId, status, reason }: { userPublicId: string; status: "ACTIVE" | "SUSPENDED"; reason?: string }) =>
      adminFetch(adminPaths.userStatus(userPublicId), {
        method: "PATCH",
        body: JSON.stringify({ status, reason: reason || undefined }),
      }),
    onSuccess: async () => {
      setStatusTarget(null);
      await refresh();
    },
  });

  const staffList = staffQuery.data?.data ?? [];
  const filteredStaff = staffList.filter((user) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      user.email.toLowerCase().includes(term) ||
      (user.firstName && user.firstName.toLowerCase().includes(term)) ||
      (user.lastName && user.lastName.toLowerCase().includes(term)) ||
      roleNames(user).some((r) => r.toLowerCase().includes(term))
    );
  });

  const activeCount = staffList.filter((u) => u.status === "ACTIVE").length;
  const allRoles = rolesQuery.data ?? [];

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
            <ShieldCheck className="size-4 text-primary" />
            <span>الحوكمة والأمان</span>
          </div>
          <h1 className="mt-1 text-2xl font-black md:text-3xl">فريق العمل والصلاحيات</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            إدارة حسابات مسؤولي المنصة، تعيين الأدوار والصلاحيات (RBAC)، ومتابعة وصول الفريق.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh} disabled={staffQuery.isFetching}>
            <RefreshCw className={staffQuery.isFetching ? "size-4 animate-spin" : "size-4"} />
            <span>تحديث</span>
          </Button>
          {canWrite && (
            <Button onClick={() => setCreateModalOpen(true)}>
              <UserPlus className="size-4" />
              <span>إضافة عضو فريق جديد</span>
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground">إجمالي فريق العمل</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{staffQuery.isLoading ? "—" : staffList.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">حسابات الإدارة والمشرفين</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground">الحسابات النشطة</CardTitle>
            <UserCheck className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-600">{staffQuery.isLoading ? "—" : activeCount}</div>
            <p className="mt-1 text-xs text-muted-foreground">يمتلكون صلاحية الدخول للوحة</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground">الأدوار النظامية</CardTitle>
            <Shield className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{allRoles.length || PREDEFINED_ROLES.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">مستويات صلاحيات محددة</p>
          </CardContent>
        </Card>
      </div>

      {/* Staff Table Card */}
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>أعضاء الفريق والمسؤولون</CardTitle>
              <CardDescription>
                قائمة بجميع الحسابات التي تمتلك أدواراً إدارية أو إشرافية في المنصة.
              </CardDescription>
            </div>
            <div className="relative sm:w-72">
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بالاسم، البريد أو الدور…"
                className="ps-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {staffQuery.isLoading ? (
            <Loading />
          ) : staffQuery.error ? (
            <ErrorState error={staffQuery.error as ApiError} />
          ) : !filteredStaff.length ? (
            <div className="grid min-h-48 place-items-center text-center">
              <div>
                <Users className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-2 font-bold">لا يوجد أعضاء فريق مطابقين</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المسؤول</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الأدوار المعينة</TableHead>
                    <TableHead>آخر دخول</TableHead>
                    <TableHead>تاريخ الإنشاء</TableHead>
                    {canWrite && <TableHead className="text-end">الإجراءات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.map((user) => {
                    const roles = roleNames(user);
                    const isSuspended = user.status === "SUSPENDED";
                    return (
                      <TableRow key={user.publicId}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="grid size-10 place-items-center rounded-xl bg-muted font-bold text-muted-foreground">
                              {user.firstName ? user.firstName[0] : user.email[0].toUpperCase()}
                            </span>
                            <div>
                              <strong className="block text-sm">{personName(user)}</strong>
                              <span className="block text-xs text-muted-foreground" dir="ltr">
                                {user.email}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.status === "ACTIVE" ? "default" : isSuspended ? "destructive" : "secondary"}>
                            {user.status === "ACTIVE" ? "نشط" : isSuspended ? "موقوف" : user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {roles.map((role) => {
                              const meta = PREDEFINED_ROLES.find((r) => r.name === role);
                              return (
                                <Badge
                                  key={role}
                                  variant="outline"
                                  className={meta?.badgeClass ?? "font-semibold"}
                                >
                                  {meta?.label ?? role}
                                </Badge>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {date(user.lastLoginAt)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {date(user.createdAt)}
                        </TableCell>
                        {canWrite && (
                          <TableCell className="text-end">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setManageRolesUser(user)}
                              >
                                <KeyRound className="size-3.5" />
                                <span>الأدوار</span>
                              </Button>
                              {isSuspended ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setStatusTarget({ user, action: "ACTIVE" })}
                                >
                                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                                  <span>تفعيل</span>
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:bg-destructive/10"
                                  onClick={() => setStatusTarget({ user, action: "SUSPENDED" })}
                                >
                                  <Ban className="size-3.5" />
                                  <span>إيقاف</span>
                                </Button>
                              )}
                            </div>
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
      </Card>

      {/* Role Definitions Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="size-4 text-primary" />
            <span>دليل مستويات الصلاحيات النظامية (RBAC)</span>
          </CardTitle>
          <CardDescription>
            توزيع المسؤوليات والصلاحيات بين أقسام الإدارة لضمان سرية البيانات والنزاهة الإجرائية.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {PREDEFINED_ROLES.map((role) => (
              <div key={role.name} className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={role.badgeClass}>
                    {role.name}
                  </Badge>
                  <strong className="text-xs">{role.label.split("(")[0]}</strong>
                </div>
                <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                  {role.description}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal: Create Staff Member */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5 text-primary" />
              <span>إضافة عضو فريق عمل جديد</span>
            </DialogTitle>
            <DialogDescription>
              أنشئ حساباً جديداً لموظف أو مشرف مع تحديد دوره وصلاحياته المناسبة.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>الاسم الأول</Label>
                <Input
                  value={createForm.firstName}
                  onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                  placeholder="محمد"
                />
              </div>
              <div className="space-y-1.5">
                <Label>اسم العائلة</Label>
                <Input
                  value={createForm.lastName}
                  onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                  placeholder="أحمد"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>البريد الإلكتروني المهني</Label>
              <Input
                type="email"
                dir="ltr"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="staff@arabiyatmart.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>كلمة المرور المؤقتة (8 أحرف كحد أدنى)</Label>
              <Input
                type="password"
                dir="ltr"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="••••••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label>الأدوار والصلاحيات</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {PREDEFINED_ROLES.map((role) => {
                  const checked = createForm.roles.includes(role.name);
                  return (
                    <label
                      key={role.name}
                      className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 text-xs transition-colors ${
                        checked ? "border-primary bg-primary/5 font-bold" : "hover:bg-muted/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCreateForm({ ...createForm, roles: [...createForm.roles, role.name] });
                          } else {
                            setCreateForm({
                              ...createForm,
                              roles: createForm.roles.filter((r) => r !== role.name),
                            });
                          }
                        }}
                        className="mt-0.5"
                      />
                      <div>
                        <div>{role.label}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
            {createMutation.error && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                {(createMutation.error as ApiError).message}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending ||
                !createForm.firstName.trim() ||
                !createForm.lastName.trim() ||
                !createForm.email.trim() ||
                createForm.password.length < 8 ||
                !createForm.roles.length
              }
            >
              {createMutation.isPending ? "جارٍ الإنشاء…" : "إنشاء الحساب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Manage Roles for an Existing User */}
      <Dialog open={Boolean(manageRolesUser)} onOpenChange={(open) => !open && setManageRolesUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-5 text-primary" />
              <span>إدارة أدوار {manageRolesUser ? personName(manageRolesUser) : ""}</span>
            </DialogTitle>
            <DialogDescription dir="ltr">{manageRolesUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">الأدوار المعينة حالياً:</Label>
              <div className="space-y-2">
                {manageRolesUser?.roles.map((item) => {
                  const roleName = item.role?.name || item.name || "";
                  const roleObj = allRoles.find((r) => r.name === roleName);
                  return (
                    <div
                      key={roleName}
                      className="flex items-center justify-between rounded-xl border bg-muted/30 p-2.5 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{roleName}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {PREDEFINED_ROLES.find((r) => r.name === roleName)?.label ?? ""}
                        </span>
                      </div>
                      {canWrite && roleObj && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-destructive hover:bg-destructive/10"
                          disabled={revokeRoleMutation.isPending}
                          onClick={() =>
                            revokeRoleMutation.mutate({
                              userId: manageRolesUser.publicId,
                              roleId: roleObj.id,
                            })
                          }
                        >
                          إزالة
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {canWrite && (
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs font-bold">إسناد دور إضافي:</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <CustomSelect
                      value={selectedRoleToAdd}
                      onChange={(e) => setSelectedRoleToAdd(e.target.value)}
                      options={[
                        { value: "", label: "اختر دوراً لإسناده…" },
                        ...allRoles
                          .filter((r) => !roleNames(manageRolesUser!).includes(r.name))
                          .map((r) => ({
                            value: String(r.id),
                            label: `${r.name} (${PREDEFINED_ROLES.find((p) => p.name === r.name)?.label ?? r.name})`,
                          })),
                      ]}
                    />
                  </div>
                  <Button
                    disabled={!selectedRoleToAdd || assignRoleMutation.isPending}
                    onClick={() =>
                      assignRoleMutation.mutate({
                        userId: manageRolesUser!.publicId,
                        roleId: Number(selectedRoleToAdd),
                      })
                    }
                  >
                    <Plus className="size-4" />
                    <span>إسناد</span>
                  </Button>
                </div>
              </div>
            )}

            {(assignRoleMutation.error || revokeRoleMutation.error) && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                {((assignRoleMutation.error || revokeRoleMutation.error) as ApiError).message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageRolesUser(null)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend / Activate Action Dialog */}
      <ActionDialog
        open={Boolean(statusTarget)}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        title={statusTarget?.action === "SUSPENDED" ? "إيقاف حساب المسؤول" : "إعادة تفعيل الحساب"}
        description={
          statusTarget?.action === "SUSPENDED"
            ? "سيتم إبطال جميع جلسات الدخول ومنع المسؤول من الوصول للوحة التحكم فوراً."
            : "سيتمكن المسؤول من تسجيل الدخول واستخدام صلاحياته المعتمدة مجدداً."
        }
        confirmLabel={statusTarget?.action === "SUSPENDED" ? "إيقاف الحساب" : "تفعيل الحساب"}
        requireReason={statusTarget?.action === "SUSPENDED"}
        destructive={statusTarget?.action === "SUSPENDED"}
        pending={statusMutation.isPending}
        error={(statusMutation.error as ApiError | null)?.message}
        onConfirm={(reason) => {
          if (statusTarget) {
            statusMutation.mutate({
              userPublicId: statusTarget.user.publicId,
              status: statusTarget.action,
              reason,
            });
          }
        }}
      />
    </div>
  );
}
