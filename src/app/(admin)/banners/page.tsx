import { requireAdminCapability } from "@/lib/auth/server-session";
import { BannersControl } from "@/features/banners/banners-control";

export default async function BannersPage() {
  const session = await requireAdminCapability("marketing:read");
  return <BannersControl canWrite={session.capabilities.includes("marketing:write")} />;
}
