import { UserDetail } from "@/features/people/user-detail";
import { requireAdminCapability } from "@/lib/auth/server-session";

export default async function UserPage({ params }: { params: Promise<{ publicId: string }> }) { const [session, { publicId }] = await Promise.all([requireAdminCapability("users:read"), params]); return <UserDetail publicId={publicId} canWrite={session.capabilities.includes("users:write")} />; }
