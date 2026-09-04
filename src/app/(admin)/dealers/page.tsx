import { DealersList } from "@/features/people/dealers-list";
import { requireAdminCapability } from "@/lib/auth/server-session";

export default async function DealersPage() { await requireAdminCapability("dealers:read"); return <DealersList />; }
