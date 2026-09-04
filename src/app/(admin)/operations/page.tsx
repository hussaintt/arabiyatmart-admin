import { redirect } from "next/navigation";
import { MarketplaceOperations } from "@/features/operations/marketplace-operations";
import { requireAdminSession } from "@/lib/auth/server-session";

export default async function OperationsPage() {
  const session = await requireAdminSession();
  if (!["leads:read", "offers:read", "conversations:read", "ops:read"].some((capability) => session.capabilities.includes(capability))) {
    redirect("/dashboard?forbidden=1");
  }
  return <MarketplaceOperations capabilities={session.capabilities} />;
}

