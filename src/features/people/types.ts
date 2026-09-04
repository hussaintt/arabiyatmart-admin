export type Role = { role?: { name?: string }; name?: string };

export type AdminUser = {
  publicId: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  status: string;
  locale: string;
  lastLoginAt: string | null;
  createdAt: string;
  roles: Role[];
  addresses?: unknown[];
  userVerifications?: unknown[];
  vendorMemberships?: Array<{ vendor: { publicId: string; displayName: { ar?: string; en?: string }; status: string } }>;
  _count?: { listings: number; vendorMemberships: number };
};

export type Dealer = {
  publicId: string;
  slug: string;
  legalName: string;
  displayName: { ar?: string; en?: string };
  description?: { ar?: string; en?: string } | null;
  email: string;
  phone: string | null;
  status: string;
  storeType: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  defaultCurrency: string;
  ratingAverage: number | string;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  businessAddressLine: string | null;
  businessCountryId: number | null;
  businessCityId: number | null;
  businessPostalCode: string | null;
  businessPhone: string | null;
  commercialRegisterNumber: string | null;
  taxId: string | null;
  businessCountry?: { id: number; code: string; name: { ar?: string; en?: string } } | null;
  businessCity?: { id: number; name: { ar?: string; en?: string } } | null;
  _count: { listings: number; members: number };
};

export function personName(user: AdminUser) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

export function dealerName(dealer: Dealer) {
  return dealer.displayName?.ar || dealer.displayName?.en || dealer.legalName;
}

export function roleNames(user: AdminUser) {
  return user.roles.map((item) => item.role?.name || item.name).filter(Boolean) as string[];
}
