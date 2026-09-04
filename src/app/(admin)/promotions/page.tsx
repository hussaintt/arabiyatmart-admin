import { requireAdminCapability } from "@/lib/auth/server-session";
import { PromotionsControl } from "@/features/promotions/promotions-control";

export default async function PromotionsPage() {
  const session = await requireAdminCapability("marketing:read");
  return (
    <PromotionsControl
      canWrite={session.capabilities.includes("marketing:write")}
      canAdjust={session.capabilities.includes("billing:adjust")}
    />
  );
}
