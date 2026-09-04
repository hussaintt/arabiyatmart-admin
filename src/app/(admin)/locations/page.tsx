import { requireAdminCapability } from "@/lib/auth/server-session";
import { LocationsControl } from "@/features/locations/locations-control";

export default async function LocationsPage() {
  const session = await requireAdminCapability("taxonomy:read");
  return (
    <LocationsControl
      canWrite={session.capabilities.includes("taxonomy:write")}
    />
  );
}
