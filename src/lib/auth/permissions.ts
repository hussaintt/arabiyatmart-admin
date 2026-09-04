export const ADMIN_CAPABILITIES = [
  "dashboard:read", "listings:read", "listings:write", "listings:moderate", "listings:bulk", "listings:feature",
  "taxonomy:read", "taxonomy:write", "users:read", "users:write", "users:sessions",
  "dealers:read", "dealers:write", "dealers:kyc", "dealers:team", "leads:read", "leads:write",
  "offers:read", "offers:moderate", "conversations:read", "conversations:moderate", "trust:read", "trust:moderate",
  "marketing:read", "marketing:write", "billing:read", "billing:write", "billing:adjust",
  "imports:read", "imports:run", "imports:commit", "imports:rollback", "media:read", "media:write", "ai:run",
  "notifications:read", "notifications:send", "analytics:read", "analytics:export", "settings:read", "settings:write",
  "ops:read", "ops:run", "audit:read", "audit:export", "admins:read", "admins:write", "roles:write",
] as const;

export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number];

export function can(capabilities: readonly string[], capability: AdminCapability) {
  return capabilities.includes(capability);
}
