import { ListingDetail } from "@/features/listings/listing-detail";
import { requireAdminCapability } from "@/lib/auth/server-session";

export default async function ListingDetailPage({ params }: { params: Promise<{ publicId: string }> }) {
  const [session, { publicId }] = await Promise.all([requireAdminCapability("listings:read"), params]);
  return <ListingDetail publicId={publicId} capabilities={session.capabilities} />;
}
