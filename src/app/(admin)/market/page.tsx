import { TaxonomyControl } from "@/features/market/taxonomy-control";
import { requireAdminCapability } from "@/lib/auth/server-session";

export default async function MarketPage() { const session = await requireAdminCapability("taxonomy:read"); return <TaxonomyControl canWrite={session.capabilities.includes("taxonomy:write")} />; }
