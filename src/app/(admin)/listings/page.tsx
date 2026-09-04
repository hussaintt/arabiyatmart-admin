import { ListingsList } from "@/features/listings/listings-list";
import { requireAdminCapability } from "@/lib/auth/server-session";

export default async function ListingsPage() {
  const session = await requireAdminCapability("listings:read");
  return <ListingsList capabilities={session.capabilities} />;
}
