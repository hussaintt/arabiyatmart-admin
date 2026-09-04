import { SettingsControl } from "@/features/settings/settings-control";
import { requireAdminCapability } from "@/lib/auth/server-session";

export default async function SettingsPage() {
  const session = await requireAdminCapability("settings:read");
  return <SettingsControl canWrite={session.capabilities.includes("settings:write")} />;
}
