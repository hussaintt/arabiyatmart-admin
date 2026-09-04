import { requireAdminCapability } from "@/lib/auth/server-session";
import { BillingControl } from "@/features/billing/billing-control";

export default async function BillingPage() {
  const session = await requireAdminCapability("billing:read");
  return (
    <BillingControl
      canWrite={session.capabilities.includes("billing:write")}
      canAdjust={session.capabilities.includes("billing:adjust")}
    />
  );
}
