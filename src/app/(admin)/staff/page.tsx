import { requireAdminCapability } from "@/lib/auth/server-session";
import { StaffControl } from "@/features/staff/staff-control";

export default async function StaffPage() {
  const session = await requireAdminCapability("admins:read");
  return (
    <StaffControl
      canWrite={session.capabilities.includes("admins:write") || session.capabilities.includes("roles:write")}
    />
  );
}
