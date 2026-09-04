import { ReportsControl } from "@/features/trust/reports-control";
import { requireAdminCapability } from "@/lib/auth/server-session";

export default async function TrustPage() { const session = await requireAdminCapability("trust:read"); return <ReportsControl canModerate={session.capabilities.includes("trust:moderate")} />; }
