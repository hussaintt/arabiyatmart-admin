export type Localized = { ar?: string; en?: string };

export type AdminListingRow = {
  publicId: string;
  slug: string;
  title: string;
  status: string;
  source: string;
  sellerType: string;
  year: number;
  mileageKm: number;
  priceCents: number;
  currency: string;
  makeName: Localized;
  modelName: Localized;
  cityName: Localized;
  coverImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletionReason: string | null;
  viewsCount: number;
  favoritesCount: number;
  leadsCount: number;
  isDuplicate: boolean;
  user: { publicId: string; firstName?: string | null; lastName?: string | null; phone?: string | null } | null;
  vendor: { publicId: string; displayName: Localized; slug: string } | null;
};

export type AdminListingDetail = AdminListingRow & {
  make: { publicId: string; slug: string; name: Localized };
  model: { publicId: string; slug: string; name: Localized };
  generation: { publicId: string; name: string } | null;
  trim: { publicId: string; name: Localized; officialPriceCents: number | null } | null;
  branch: { publicId: string; nameI18n: Localized; addressLine: string | null; phone: string | null; isActive: boolean } | null;
  city: { id: number; name: Localized };
  area: { id: number; name: Localized } | null;
  year: number;
  condition: string;
  conditionGrade: string | null;
  fuelType: string;
  transmission: string;
  bodyType: string;
  colorExterior: string | null;
  colorInterior: string | null;
  engineCc: number | null;
  powerHp: number | null;
  seats: number | null;
  drivetrain: string | null;
  vin: string | null;
  isNegotiable: boolean;
  installmentAvailable: boolean;
  exchangeAccepted: boolean;
  description: Localized | null;
  features: string[] | null;
  lat: number | null;
  lng: number | null;
  registrationStatus: string | null;
  hasWarranty: boolean;
  hasServiceHistory: boolean;
  contactPhone: string | null;
  whatsappPhone: string | null;
  allowChat: boolean;
  rejectionReason: string | null;
  preDeleteStatus: string | null;
  images: Array<{ publicId: string; filePublicId: string; url: string; mimeType: string; isCover: boolean; sortOrder: number }>;
  reports: Array<{ publicId: string; category: string; details: string | null; status: string; createdAt: string; handledAt: string | null }>;
  priceChanges: Array<{ oldPriceCents: number; newPriceCents: number; createdAt: string }>;
  provenance: Array<{ publicId: string; provider: string; externalId: string; sourceUrl: string; authorizationReference: string; sourceState: string | null; lastCheckedAt: string | null }>;
  user: { publicId: string; email: string; phone: string | null; firstName: string | null; lastName: string | null } | null;
  vendor: ({ publicId: string; displayName: Localized; slug: string; email: string; phone: string | null } | null);
};

export type ListingAudit = {
  publicId: string;
  action: string;
  actorRole: string | null;
  data: unknown;
  ipAddress: string | null;
  createdAt: string;
  actor: { publicId: string; email: string; firstName: string | null; lastName: string | null } | null;
};

export const listingStatusLabels: Record<string, string> = {
  DRAFT: "مسودة",
  PENDING_REVIEW: "بانتظار المراجعة",
  ACTIVE: "نشط",
  PAUSED: "متوقف",
  REJECTED: "مرفوض",
  EXPIRED: "منتهي",
  SOLD: "مباع",
  ARCHIVED: "مؤرشف",
  REMOVED: "مزال",
};

export function localized(value?: Localized | null) {
  return value?.ar || value?.en || "—";
}

export function formatPrice(value: number, currency: string) {
  return `${new Intl.NumberFormat("ar-EG").format(value / 100)} ${currency}`;
}
