import { DealerDetail } from "@/features/people/dealer-detail";
import { requireAdminCapability } from "@/lib/auth/server-session";

export default async function DealerPage({ params }: { params: Promise<{ publicId: string }> }) { const [session, { publicId }] = await Promise.all([requireAdminCapability("dealers:read"), params]); return <DealerDetail publicId={publicId} canWrite={session.capabilities.includes("dealers:write")} canKyc={session.capabilities.includes("dealers:kyc")} canBilling={session.capabilities.includes("billing:read")} canUpload={session.capabilities.includes("media:write")} canReadLocations={session.capabilities.includes("taxonomy:read")} />; }
