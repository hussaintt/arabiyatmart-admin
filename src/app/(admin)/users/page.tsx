import { UsersList } from "@/features/people/users-list";
import { requireAdminCapability } from "@/lib/auth/server-session";

export default async function UsersPage() { await requireAdminCapability("users:read"); return <UsersList />; }
