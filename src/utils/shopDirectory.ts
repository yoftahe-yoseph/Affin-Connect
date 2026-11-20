import type {
  MerchantVerification,
  PreferredContactMethod,
  Product,
  PublicShopDirectoryItem,
  Shop,
  ShopAvailabilityStatus,
} from '../types/index.ts';
import {
  buildShopSlug,
  isVerifiedMerchantShop,
  normalizePhoneToE164,
  validateProductImageUrl,
} from './marketplaceLogic.ts';

export interface ShopDirectoryCategoryOption {
  slug: string;
  label: string;
  labelKey: string;
  iconName: string;
  aliases: string[];
}

export const SHOP_DIRECTORY_CATEGORIES: readonly ShopDirectoryCategoryOption[] = [
  {
    slug: 'coffee',
    label: 'Coffee Traders',
    labelKey: 'shopDirCatCoffee',
    iconName: 'Coffee',
    aliases: ['coffee', 'coffee-traders', 'coffee-honey', 'coffee traders', 'roaster', 'roasters'],
  },
  {
    slug: 'electronics',
    label: 'Electronics',
    labelKey: 'shopDirCatElectronics',
    iconName: 'Smartphone',
    aliases: ['electronics', 'phones', 'mobile', 'tech', 'computers'],
  },
  {
    slug: 'clothing-fashion',
    label: 'Clothing',
    labelKey: 'shopDirCatClothing',
    iconName: 'Shirt',
    aliases: ['clothing-fashion', 'clothing', 'fashion', 'habesha', 'apparel', 'shoes', 'textile'],
  },
  {
    slug: 'groceries',
    label: 'Groceries',
    labelKey: 'shopDirCatGroceries',
    iconName: 'ShoppingBasket',
    aliases: ['groceries', 'food-spices', 'supermarket', 'spices', 'honey', 'food', 'bakery'],
  },
  {
    slug: 'beauty-cosmetics',
    label: 'Beauty',
    labelKey: 'shopDirCatBeauty',
    iconName: 'Sparkles',
    aliases: ['beauty-cosmetics', 'beauty', 'cosmetics', 'skincare', 'personal-care', 'salon'],
  },
  {
    slug: 'home-living',
    label: 'Home & Furniture',
    labelKey: 'shopDirCatHomeFurniture',
    iconName: 'Home',
    aliases: ['home-living', 'home', 'furniture', 'household', 'kitchenware', 'decor'],
  },
  {
    slug: 'agriculture',
    label: 'Agriculture',
    labelKey: 'shopDirCatAgriculture',
    iconName: 'ShoppingBasket',
    aliases: ['agriculture', 'farming', 'produce', 'grains', 'livestock', 'seeds', 'farm'],
  },
  {
    slug: 'other',
    label: 'Other',
    labelKey: 'shopDirCatOther',
    iconName: 'Package',
    aliases: ['other', 'sports', 'automotive', 'services', 'general', 'books', 'stationery'],
  },
] as const;

export const VALID_SHOP_DIRECTORY_CATEGORY_SLUGS = new Set<string>(
  SHOP_DIRECTORY_CATEGORIES.map((c) => c.slug)
);

export const SHOP_AVAILABILITY_STATUSES: readonly ShopAvailabilityStatus[] = [
  'active',
  'temporarily_closed',
  'inactive',
] as const;

export const PREFERRED_CONTACT_METHODS: readonly PreferredContactMethod[] = [
  'both',
  'phone',
  'chat',
] as const;

export const MAX_SHOP_PRODUCT_TYPES = 12;
export const MAX_SHOP_PRODUCT_TYPE_LENGTH = 60;

export function normalizeShopMainCategory(raw?: string | null): string {
  const clean = (raw ?? '').trim().toLowerCase();
  if (!clean) return 'other';
  if (VALID_SHOP_DIRECTORY_CATEGORY_SLUGS.has(clean)) return clean;

  for (const cat of SHOP_DIRECTORY_CATEGORIES) {
    if (cat.aliases.includes(clean)) return cat.slug;
  }
  return 'other';
}

export function getShopDirectoryCategoryLabel(slug?: string | null): string {
  const normalized = normalizeShopMainCategory(slug);
  return (
    SHOP_DIRECTORY_CATEGORIES.find((c) => c.slug === normalized)?.label ?? 'Other'
  );
}

export function inferShopMainCategory(
  shop: Pick<Shop, 'mainCategory' | 'traderType' | 'name' | 'description'>,
  shopProducts: Pick<Product, 'category'>[] = []
): string {
  if (shop.mainCategory && shop.mainCategory.trim()) {
    return normalizeShopMainCategory(shop.mainCategory);
  }
  if (shop.traderType === 'coffee') {
    return 'coffee';
  }
  if (shopProducts.length > 0) {
    const counts = new Map<string, number>();
    for (const p of shopProducts) {
      const cat = normalizeShopMainCategory(p.category);
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    let best = 'other';
    let bestCount = 0;
    for (const [cat, count] of counts.entries()) {
      if (count > bestCount) {
        best = cat;
        bestCount = count;
      }
    }
    if (bestCount > 0) return best;
  }
  const text = `${shop.name ?? ''} ${shop.description ?? ''}`.toLowerCase();
  if (/\b(coffee|roast|buna|espresso|arabica)\b/.test(text)) return 'coffee';
  if (/\b(phone|smartphone|electronics|laptop|tech|charger)\b/.test(text)) return 'electronics';
  if (/\b(kemis|cloth|fashion|shoe|dress|handloom|tibeb|cotton|boutique)\b/.test(text)) {
    return 'clothing-fashion';
  }
  if (/\b(spice|honey|grocery|berbere|supermarket|food|grain)\b/.test(text)) return 'groceries';
  if (/\b(beauty|cosmetic|skincare|salon|perfume)\b/.test(text)) return 'beauty-cosmetics';
  if (/\b(furniture|home|kitchen|jebena|mesob|household)\b/.test(text)) return 'home-living';
  if (/\b(agricult|farm|seed|fertilizer|harvest|livestock)\b/.test(text)) return 'agriculture';
  return 'other';
}

export function getShopAvailabilityStatus(
  shop?: Pick<Shop, 'availabilityStatus' | 'status'> | null
): ShopAvailabilityStatus {
  if (!shop) return 'inactive';
  if (shop.status === 'suspended') return 'inactive';
  if (
    shop.availabilityStatus === 'active' ||
    shop.availabilityStatus === 'temporarily_closed' ||
    shop.availabilityStatus === 'inactive'
  ) {
    return shop.availabilityStatus;
  }
  return 'active';
}

export function sanitizeProductTypesList(raw: unknown): string[] {
  let items: string[] = [];
  if (Array.isArray(raw)) {
    items = raw.filter((v): v is string => typeof v === 'string');
  } else if (typeof raw === 'string') {
    items = raw.split(/[,\n;]+/);
  }
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const entry of items) {
    const trimmed = entry.trim().replace(/\s+/g, ' ').slice(0, MAX_SHOP_PRODUCT_TYPE_LENGTH);
    if (trimmed.length < 2) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(trimmed);
    if (cleaned.length >= MAX_SHOP_PRODUCT_TYPES) break;
  }
  return cleaned;
}

export interface ResolvedCallablePhone {
  callable: boolean;
  e164: string | null;
  telHref: string | null;
  displayPhone: string | null;
  source: 'business' | 'account' | 'none';
  reason?: string;
}

/**
 * Resolves and validates the shop's callable telephone URI (`tel:+251...`).
 * - Never hardcodes a fallback number.
 * - Uses businessPhoneNumber only when publishBusinessPhone is enabled and valid.
 * - Defaults to the shop's phoneNumber (sourced from the registered seller account).
 * - Returns `callable: false` and `telHref: null` when missing or invalid.
 */
export function resolveShopCallablePhone(
  shop?: Pick<Shop, 'phoneNumber' | 'businessPhoneNumber' | 'publishBusinessPhone'> | null,
  ownerRegisteredPhone?: string | null
): ResolvedCallablePhone {
  if (!shop) {
    return {
      callable: false,
      e164: null,
      telHref: null,
      displayPhone: null,
      source: 'none',
      reason: 'Shop contact phone is unavailable.',
    };
  }

  const useBusiness = Boolean(shop.publishBusinessPhone && shop.businessPhoneNumber?.trim());
  const rawCandidate = useBusiness
    ? shop.businessPhoneNumber!.trim()
    : (shop.phoneNumber ?? '').trim() || (ownerRegisteredPhone ?? '').trim();

  if (!rawCandidate) {
    return {
      callable: false,
      e164: null,
      telHref: null,
      displayPhone: null,
      source: 'none',
      reason: 'This shop has not published a phone number yet.',
    };
  }

  // Reject obvious non-dialable placeholder strings (e.g. +251000000000 or 0000000000)
  const digitsOnly = rawCandidate.replace(/\D/g, '');
  if (/^0+$/.test(digitsOnly) || /^2510+$/.test(digitsOnly)) {
    return {
      callable: false,
      e164: null,
      telHref: null,
      displayPhone: null,
      source: 'none',
      reason: 'Shop phone number is invalid.',
    };
  }

  const normalized = normalizePhoneToE164(rawCandidate);
  if (!normalized.valid || !normalized.e164) {
    return {
      callable: false,
      e164: null,
      telHref: null,
      displayPhone: null,
      source: 'none',
      reason: 'Shop phone number is not in a valid dialable format.',
    };
  }

  return {
    callable: true,
    e164: normalized.e164,
    telHref: `tel:${normalized.e164}`,
    displayPhone: formatDisplayPhoneNumber(normalized.e164),
    source: useBusiness ? 'business' : 'account',
  };
}

export function formatDisplayPhoneNumber(e164: string): string {
  const clean = (e164 ?? '').trim();
  if (/^\+251[79]\d{8}$/.test(clean)) {
    return `+251 ${clean.slice(4, 6)} ${clean.slice(6, 9)} ${clean.slice(9)}`;
  }
  return clean;
}

/**
 * Determines whether a shop profile is publicly discoverable in Discover Shops.
 * Note: Individual product listings are NOT required — verified shop profiles
 * with zero products are publicly discoverable when active or temporarily closed.
 */
export function isShopPubliclyDiscoverable(
  shop?: Shop | null,
  options: {
    strictShopVerification?: boolean;
    verification?: MerchantVerification | null;
    includeTemporarilyClosed?: boolean;
  } = {}
): boolean {
  if (!shop) return false;
  if (shop.status === 'suspended') return false;

  const strict = options.strictShopVerification !== false;
  if (strict) {
    if (!isVerifiedMerchantShop(shop)) return false;
    if (options.verification && options.verification.status !== 'approved') return false;
  }

  if (shop.isPublished === false) return false;

  const availability = getShopAvailabilityStatus(shop);
  if (availability === 'inactive') return false;
  if (availability === 'temporarily_closed' && options.includeTemporarilyClosed === false) {
    return false;
  }

  return true;
}

/**
 * Returns strictly public shop directory fields, stripping any sensitive/private
 * account or moderation attributes before sending in public API responses.
 */
export function sanitizePublicShopProfile(
  shop: Shop,
  shopProducts: Pick<Product, 'category'>[] = []
): PublicShopDirectoryItem {
  const callablePhone = resolveShopCallablePhone(shop);
  const availabilityStatus = getShopAvailabilityStatus(shop);
  const mainCategory = inferShopMainCategory(shop, shopProducts);
  const preferredContactMethod: PreferredContactMethod =
    shop.preferredContactMethod === 'phone' ||
    shop.preferredContactMethod === 'chat' ||
    shop.preferredContactMethod === 'both'
      ? shop.preferredContactMethod
      : 'both';

  const item: PublicShopDirectoryItem = {
    shopId: shop.shopId,
    ownerUid: shop.ownerUid,
    name: shop.name,
    slug: shop.slug || buildShopSlug(shop.name, shop.shopId),
    description: shop.description ?? '',
    logoUrl: shop.logoUrl ?? '',
    coverImageUrl: shop.coverImageUrl ?? '',
    mainCategory,
    productTypes: sanitizeProductTypesList(shop.productTypes ?? []),
    region: (shop.region ?? '').trim() || 'Sidama Region',
    city: (shop.city ?? '').trim() || 'Hawassa',
    ...(shop.subCity?.trim() ? { subCity: shop.subCity.trim() } : {}),
    neighborhood: (shop.neighborhood ?? '').trim(),
    address: (shop.address ?? '').trim(),
    ...(typeof shop.latitude === 'number' && Number.isFinite(shop.latitude)
      ? { latitude: shop.latitude }
      : {}),
    ...(typeof shop.longitude === 'number' && Number.isFinite(shop.longitude)
      ? { longitude: shop.longitude }
      : {}),
    ...(shop.operatingHours?.trim() ? { operatingHours: shop.operatingHours.trim() } : {}),
    phoneNumber: callablePhone.displayPhone,
    telHref: callablePhone.telHref,
    preferredContactMethod,
    availabilityStatus,
    deliveryAvailable: Boolean(shop.deliveryAvailable),
    pickupAvailable: Boolean(shop.pickupAvailable),
    ...(shop.traderType ? { traderType: shop.traderType } : {}),
    verified: isVerifiedMerchantShop(shop),
    rating: Number.isFinite(shop.rating) ? shop.rating : 0,
    reviewCount: Number.isFinite(shop.reviewCount) ? shop.reviewCount : 0,
    featured: Boolean(shop.featured),
    createdAt: shop.createdAt,
    updatedAt: shop.updatedAt,
  };

  return item;
}

export interface ShopProfileValidationInput {
  name?: string;
  mainCategory?: string;
  productTypes?: string[] | string;
  description?: string;
  region?: string;
  city?: string;
  subCity?: string;
  neighborhood?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  operatingHours?: string;
  phoneNumber?: string;
  businessPhoneNumber?: string;
  publishBusinessPhone?: boolean;
  preferredContactMethod?: string;
  availabilityStatus?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  deliveryAvailable?: boolean;
  pickupAvailable?: boolean;
}

export interface ShopProfileValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  normalized?: {
    name: string;
    mainCategory: string;
    productTypes: string[];
    description: string;
    region: string;
    city: string;
    subCity?: string;
    neighborhood: string;
    address: string;
    latitude?: number;
    longitude?: number;
    operatingHours?: string;
    phoneNumber: string;
    businessPhoneNumber?: string;
    publishBusinessPhone: boolean;
    preferredContactMethod: PreferredContactMethod;
    availabilityStatus: ShopAvailabilityStatus;
    logoUrl?: string;
    coverImageUrl?: string;
    deliveryAvailable: boolean;
    pickupAvailable: boolean;
  };
}

export function validateShopProfilePayload(
  input: ShopProfileValidationInput
): ShopProfileValidationResult {
  const errors: Record<string, string> = {};

  const name = (input.name ?? '').trim();
  if (name.length < 3 || name.length > 100) {
    errors.name = 'Shop name must be between 3 and 100 characters.';
  }

  const rawCategory = (input.mainCategory ?? '').trim();
  const mainCategory = normalizeShopMainCategory(rawCategory || 'other');
  if (!rawCategory || !VALID_SHOP_DIRECTORY_CATEGORY_SLUGS.has(mainCategory)) {
    errors.mainCategory = 'Please select a main shop category.';
  }

  const productTypes = sanitizeProductTypesList(input.productTypes ?? []);
  if (productTypes.length === 0) {
    errors.productTypes = 'Add at least one product type your shop offers (e.g. Roasted Coffee, Smartphones).';
  }

  const description = (input.description ?? '').trim();
  if (description.length < 10) {
    errors.description = 'Shop description must be at least 10 characters.';
  } else if (description.length > 1000) {
    errors.description = 'Shop description must be 1,000 characters or fewer.';
  }

  const region = (input.region ?? '').trim() || 'Sidama Region';
  if (region.length > 80) {
    errors.region = 'Region name must be 80 characters or fewer.';
  }

  const city = (input.city ?? '').trim() || 'Hawassa';
  if (city.length < 2 || city.length > 60) {
    errors.city = 'City must be between 2 and 60 characters.';
  }

  const subCity = (input.subCity ?? '').trim();
  if (subCity.length > 80) {
    errors.subCity = 'Sub-city must be 80 characters or fewer.';
  }

  const neighborhood = (input.neighborhood ?? '').trim();
  if (neighborhood.length < 2 || neighborhood.length > 100) {
    errors.neighborhood = 'Select or enter a neighborhood.';
  }

  const address = (input.address ?? '').trim();
  if (address.length < 4 || address.length > 200) {
    errors.address = 'Enter a specific street, building, or market stall location (4–200 characters).';
  }

  let latitude: number | undefined;
  let longitude: number | undefined;
  if (input.latitude != null || input.longitude != null) {
    if (
      typeof input.latitude !== 'number' ||
      typeof input.longitude !== 'number' ||
      !Number.isFinite(input.latitude) ||
      !Number.isFinite(input.longitude) ||
      input.latitude < -90 ||
      input.latitude > 90 ||
      input.longitude < -180 ||
      input.longitude > 180
    ) {
      errors.coordinates = 'Map coordinates must include valid latitude (-90..90) and longitude (-180..180).';
    } else {
      latitude = Number(input.latitude.toFixed(6));
      longitude = Number(input.longitude.toFixed(6));
    }
  }

  const operatingHours = (input.operatingHours ?? '').trim();
  if (operatingHours.length > 140) {
    errors.operatingHours = 'Opening hours must be 140 characters or fewer.';
  }

  const publishBusinessPhone = Boolean(input.publishBusinessPhone);
  const rawAccountPhone = (input.phoneNumber ?? '').trim();
  const normalizedAccountPhone = rawAccountPhone
    ? normalizePhoneToE164(rawAccountPhone)
    : { valid: false, e164: '' };

  let normalizedBusinessPhone: string | undefined;
  if (publishBusinessPhone) {
    const bizCheck = normalizePhoneToE164(input.businessPhoneNumber ?? '');
    if (!bizCheck.valid) {
      errors.businessPhoneNumber =
        'Enter a valid business phone number (e.g. 0911234567 or +251911234567).';
    } else {
      normalizedBusinessPhone = bizCheck.e164;
    }
  } else if (input.businessPhoneNumber?.trim()) {
    const bizCheck = normalizePhoneToE164(input.businessPhoneNumber);
    if (!bizCheck.valid) {
      errors.businessPhoneNumber =
        'Enter a valid business phone number (e.g. 0911234567 or +251911234567).';
    } else {
      normalizedBusinessPhone = bizCheck.e164;
    }
  }

  const effectivePhone =
    publishBusinessPhone && normalizedBusinessPhone
      ? normalizedBusinessPhone
      : normalizedAccountPhone.valid
        ? normalizedAccountPhone.e164
        : '';

  if (!effectivePhone) {
    errors.phoneNumber =
      'A valid registered seller phone number (e.g. +251911234567) is required for your shop profile.';
  }

  const rawContact = (input.preferredContactMethod ?? 'both').trim().toLowerCase();
  const preferredContactMethod: PreferredContactMethod =
    rawContact === 'phone' || rawContact === 'chat' || rawContact === 'both'
      ? rawContact
      : 'both';
  if (
    input.preferredContactMethod &&
    !['phone', 'chat', 'both'].includes(rawContact)
  ) {
    errors.preferredContactMethod = 'Preferred contact method must be Phone, In-App Chat, or Both.';
  }

  const rawStatus = (input.availabilityStatus ?? 'active').trim().toLowerCase();
  const availabilityStatus: ShopAvailabilityStatus =
    rawStatus === 'active' || rawStatus === 'temporarily_closed' || rawStatus === 'inactive'
      ? rawStatus
      : 'active';
  if (
    input.availabilityStatus &&
    !['active', 'temporarily_closed', 'inactive'].includes(rawStatus)
  ) {
    errors.availabilityStatus = 'Shop status must be Active, Temporarily Closed, or Inactive.';
  }

  const logoUrl = (input.logoUrl ?? '').trim();
  if (logoUrl && !validateProductImageUrl(logoUrl)) {
    errors.logoUrl = 'Shop logo must be a valid HTTPS URL, app asset path, or uploaded image under 150 KB.';
  }

  const coverImageUrl = (input.coverImageUrl ?? '').trim();
  if (coverImageUrl && !validateProductImageUrl(coverImageUrl)) {
    errors.coverImageUrl = 'Shop cover image must be a valid HTTPS URL, app asset path, or uploaded image under 150 KB.';
  }

  const deliveryAvailable = input.deliveryAvailable !== false;
  const pickupAvailable = input.pickupAvailable !== false;

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    normalized: {
      name,
      mainCategory,
      productTypes,
      description,
      region,
      city,
      ...(subCity ? { subCity } : {}),
      neighborhood,
      address,
      ...(latitude !== undefined && longitude !== undefined ? { latitude, longitude } : {}),
      ...(operatingHours ? { operatingHours } : {}),
      phoneNumber: normalizedAccountPhone.valid ? normalizedAccountPhone.e164 : effectivePhone,
      ...(normalizedBusinessPhone ? { businessPhoneNumber: normalizedBusinessPhone } : {}),
      publishBusinessPhone,
      preferredContactMethod,
      availabilityStatus,
      ...(logoUrl ? { logoUrl } : {}),
      ...(coverImageUrl ? { coverImageUrl } : {}),
      deliveryAvailable,
      pickupAvailable,
    },
  };
}

export interface DiscoverShopsFilterOptions {
  searchQuery?: string;
  category?: string;
  location?: string;
  availability?: 'all' | 'active' | 'temporarily_closed';
  strictShopVerification?: boolean;
  sortBy?: 'featured' | 'nearest' | 'rating' | 'newest';
  shopDistanceById?: Record<string, number>;
  page?: number;
  pageSize?: number;
}

export interface PaginatedDiscoverShopsResult {
  items: Shop[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export function filterAndPaginateDiscoverShops(
  shops: Shop[],
  products: Product[] = [],
  options: DiscoverShopsFilterOptions = {}
): PaginatedDiscoverShopsResult {
  const {
    searchQuery = '',
    category = 'all',
    location = 'All Hawassa',
    availability = 'all',
    strictShopVerification = true,
    sortBy = 'featured',
    shopDistanceById = {},
    page = 1,
    pageSize = 12,
  } = options;

  const q = searchQuery.trim().toLowerCase();
  const normalizedCategoryFilter =
    category && category !== 'all' && category !== 'more'
      ? normalizeShopMainCategory(category)
      : 'all';
  const normalizedLoc = location.trim().toLowerCase();
  const filterByLocation = Boolean(
    normalizedLoc && normalizedLoc !== 'all' && normalizedLoc !== 'all hawassa'
  );

  const activeProductsByShop = new Map<string, Product[]>();
  for (const p of products) {
    if (p.status !== 'active') continue;
    const existing = activeProductsByShop.get(p.shopId);
    if (existing) existing.push(p);
    else activeProductsByShop.set(p.shopId, [p]);
  }

  const filtered = shops.filter((shop) => {
    if (
      !isShopPubliclyDiscoverable(shop, {
        strictShopVerification,
        includeTemporarilyClosed: availability !== 'active',
      })
    ) {
      return false;
    }

    const shopAvailability = getShopAvailabilityStatus(shop);
    if (availability === 'active' && shopAvailability !== 'active') return false;
    if (availability === 'temporarily_closed' && shopAvailability !== 'temporarily_closed') {
      return false;
    }

    const shopProducts = activeProductsByShop.get(shop.shopId) ?? [];
    const shopMainCat = inferShopMainCategory(shop, shopProducts);

    if (normalizedCategoryFilter !== 'all') {
      const matchesMain = shopMainCat === normalizedCategoryFilter;
      const matchesProductCat = shopProducts.some(
        (p) => normalizeShopMainCategory(p.category) === normalizedCategoryFilter
      );
      if (!matchesMain && !matchesProductCat) return false;
    }

    if (filterByLocation) {
      const locHaystack = `${shop.region ?? ''} ${shop.city ?? ''} ${shop.subCity ?? ''} ${shop.neighborhood ?? ''} ${shop.address ?? ''}`.toLowerCase();
      if (!locHaystack.includes(normalizedLoc)) return false;
    }

    if (q) {
      const categoryLabel = getShopDirectoryCategoryLabel(shopMainCat);
      const productTypesText = (shop.productTypes ?? []).join(' ');
      const listedProductsText = shopProducts.map((p) => `${p.name} ${p.category}`).join(' ');
      const haystack = [
        shop.name,
        shop.description,
        shopMainCat,
        categoryLabel,
        productTypesText,
        shop.region ?? '',
        shop.city ?? '',
        shop.subCity ?? '',
        shop.neighborhood ?? '',
        shop.address ?? '',
        listedProductsText,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    // Active shops sort ahead of temporarily closed shops in default browse
    const aAvail = getShopAvailabilityStatus(a) === 'active' ? 1 : 0;
    const bAvail = getShopAvailabilityStatus(b) === 'active' ? 1 : 0;
    if (sortBy === 'nearest') {
      const da = shopDistanceById[a.shopId] ?? Number.POSITIVE_INFINITY;
      const db = shopDistanceById[b.shopId] ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
    } else if (sortBy === 'rating') {
      if ((b.rating ?? 0) !== (a.rating ?? 0)) return (b.rating ?? 0) - (a.rating ?? 0);
      if ((b.reviewCount ?? 0) !== (a.reviewCount ?? 0)) return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
    } else if (sortBy === 'newest') {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      if (tb !== ta) return tb - ta;
    } else {
      if (bAvail !== aAvail) return bAvail - aAvail;
      if (Boolean(b.featured) !== Boolean(a.featured)) {
        return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
      }
      if ((b.reviewCount ?? 0) !== (a.reviewCount ?? 0)) {
        return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
      }
    }
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  const safePageSize = Math.max(1, Math.min(50, Math.floor(pageSize)));
  const safePage = Math.max(1, Math.floor(page));
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const startIndex = (safePage - 1) * safePageSize;
  const items = sorted.slice(startIndex, startIndex + safePageSize);

  return {
    items,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    hasMore: startIndex + items.length < total,
  };
}

export function buildShopShareUrl(origin: string, shopId: string): string {
  const cleanOrigin = (origin ?? '').replace(/\/+$/, '');
  const cleanShopId = encodeURIComponent((shopId ?? '').trim());
  return `${cleanOrigin}/?shop=${cleanShopId}`;
}

export function canStartShopChat(params: {
  currentUid?: string | null;
  isSuspended?: boolean;
  shop?: Pick<Shop, 'ownerUid' | 'status'> | null;
}): { allowed: boolean; code?: 'AUTH_REQUIRED' | 'ACCOUNT_SUSPENDED' | 'SHOP_UNAVAILABLE' | 'SELF_CHAT_BLOCKED'; reason?: string } {
  const uid = (params.currentUid ?? '').trim();
  if (!uid) {
    return {
      allowed: false,
      code: 'AUTH_REQUIRED',
      reason: 'Please sign in to chat with this shop owner.',
    };
  }
  if (params.isSuspended) {
    return {
      allowed: false,
      code: 'ACCOUNT_SUSPENDED',
      reason: 'Your account is currently suspended and cannot start new chats.',
    };
  }
  if (!params.shop || params.shop.status === 'suspended') {
    return {
      allowed: false,
      code: 'SHOP_UNAVAILABLE',
      reason: 'This shop is currently unavailable for messaging.',
    };
  }
  if (params.shop.ownerUid && params.shop.ownerUid === uid) {
    return {
      allowed: false,
      code: 'SELF_CHAT_BLOCKED',
      reason: 'You cannot start a customer chat with your own shop.',
    };
  }
  return { allowed: true };
}
