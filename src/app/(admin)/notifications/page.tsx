import { NotificationsControl } from "@/features/communications/notifications-control";
import { requireAdminCapability } from "@/lib/auth/server-session";

export default async function NotificationsPage() {
  const session = await requireAdminCapability("notifications:read");
  return <NotificationsControl canSend={session.capabilities.includes("notifications:send")} />;
}
