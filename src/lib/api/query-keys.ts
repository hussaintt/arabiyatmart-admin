export const queryKeys = {
  session: ["admin-session"] as const,
  listings: (query: string) => ["admin-listings", query] as const,
  listing: (publicId: string) => ["admin-listing", publicId] as const,
  listingAudit: (publicId: string) => ["admin-listing-audit", publicId] as const,
  users: (query: string) => ["admin-users", query] as const,
  user: (publicId: string) => ["admin-user", publicId] as const,
  dealers: (query: string) => ["admin-dealers", query] as const,
  dealer: (publicId: string) => ["admin-dealer", publicId] as const,
} as const;
