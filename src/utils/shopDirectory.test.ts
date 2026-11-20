import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Shop } from '../types/index.ts';
import {
  buildShopShareUrl,
  canStartShopChat,
  filterAndPaginateDiscoverShops,
  isShopPubliclyDiscoverable,
  resolveShopCallablePhone,
  sanitizePublicShopProfile,
  validateShopProfilePayload,
} from './shopDirectory.ts';

function makeShop(overrides: Partial<Shop> = {}): Shop {
  return {
    shopId: 'shop-1',
    ownerUid: 'seller-uid-1',
    name: 'Sidama Coffee House',
    slug: 'sidama-coffee-house',
    description: 'Authentic washed and natural Sidama specialty coffee beans roasted weekly in Hawassa.',
    logoUrl: '/assets/aistudio/image_703e5fa8.png',
    coverImageUrl: '/assets/aistudio/image_f24c9e47.png',
    phoneNumber: '+251911223344',
    mainCategory: 'coffee',
    productTypes: ['Sidama Whole Beans', 'Roasted Espresso', 'Green Coffee'],
    region: 'Sidama Region',
    city: 'Hawassa',
    subCity: 'Tabor',
    neighborhood: 'Piazza',
    address: 'Piazza Main Road, Stall 4',
    operatingHours: 'Mon–Sat 8:00 AM – 7:00 PM',
    preferredContactMethod: 'both',
    deliveryAvailable: true,
    pickupAvailable: true,
    status: 'approved',
    verificationStatus: 'approved',
    availabilityStatus: 'active',
    isPublished: true,
    traderType: 'coffee',
    rating: 4.8,
    reviewCount: 12,
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-01-10T10:00:00.000Z',
    ...overrides,
  };
}

describe('Discover Shops — Public Discoverability (including 0-product shops)', () => {
  it('allows verified active shops with zero individual products to appear in Discover Shops', () => {
    const zeroProductShop = makeShop({ shopId: 'shop-no-products' });
    assert.equal(isShopPubliclyDiscoverable(zeroProductShop), true);

    const result = filterAndPaginateDiscoverShops([zeroProductShop], [], {
      strictShopVerification: true,
    });
    assert.equal(result.total, 1);
    assert.equal(result.items[0].shopId, 'shop-no-products');
  });

  it('excludes unverified, pending, suspended, inactive, and unpublished shops', () => {
    const shops: Shop[] = [
      makeShop({ shopId: 's-ok' }),
      makeShop({ shopId: 's-temp', availabilityStatus: 'temporarily_closed' }),
      makeShop({ shopId: 's-pending', status: 'pending', verificationStatus: 'unverified' }),
      makeShop({ shopId: 's-suspended', status: 'suspended' }),
      makeShop({ shopId: 's-inactive', availabilityStatus: 'inactive' }),
      makeShop({ shopId: 's-unpub', isPublished: false }),
    ];

    const result = filterAndPaginateDiscoverShops(shops, [], {
      strictShopVerification: true,
    });
    assert.deepEqual(
      result.items.map((s) => s.shopId),
      ['s-ok', 's-temp']
    );
  });
});

describe('Discover Shops — Direct Phone Call Normalization & Safety', () => {
  it('normalizes Ethiopian local numbers and generates valid tel:+251 URIs', () => {
    const localShop = makeShop({ phoneNumber: '0911223344' });
    const resolved = resolveShopCallablePhone(localShop);
    assert.equal(resolved.callable, true);
    assert.equal(resolved.e164, '+251911223344');
    assert.equal(resolved.telHref, 'tel:+251911223344');
    assert.equal(resolved.source, 'account');
  });

  it('uses separate business phone only when publishBusinessPhone is explicitly true', () => {
    const shopUnpublishedBiz = makeShop({
      phoneNumber: '+251911223344',
      businessPhoneNumber: '+251922334455',
      publishBusinessPhone: false,
    });
    const res1 = resolveShopCallablePhone(shopUnpublishedBiz);
    assert.equal(res1.e164, '+251911223344');
    assert.equal(res1.source, 'account');

    const shopPublishedBiz = makeShop({
      phoneNumber: '+251911223344',
      businessPhoneNumber: '0922334455',
      publishBusinessPhone: true,
    });
    const res2 = resolveShopCallablePhone(shopPublishedBiz);
    assert.equal(res2.callable, true);
    assert.equal(res2.e164, '+251922334455');
    assert.equal(res2.telHref, 'tel:+251922334455');
    assert.equal(res2.source, 'business');
  });

  it('disables Call Shop safely when phone is missing, malformed, or placeholder', () => {
    for (const badPhone of ['', '   ', '12345', 'not-a-phone', '0000000000', '+251000000000']) {
      const shop = makeShop({ phoneNumber: badPhone });
      const res = resolveShopCallablePhone(shop);
      assert.equal(res.callable, false, `Expected "${badPhone}" to be non-callable`);
      assert.equal(res.telHref, null);
    }
  });
});

describe('Discover Shops — Public Profile Sanitization', () => {
  it('strips internal moderation fields and never leaks private owner metadata', () => {
    const shopWithExtra = {
      ...makeShop({ suspensionReason: 'Internal review note' }),
      ownerEmail: 'private@example.com',
      tinNumber: '0099887766',
      licenseNumber: 'LIC-PRIVATE-1',
    } as Shop;

    const sanitized = sanitizePublicShopProfile(shopWithExtra) as unknown as Record<string, unknown>;
    assert.equal(sanitized.shopId, 'shop-1');
    assert.equal(sanitized.telHref, 'tel:+251911223344');
    assert.equal('suspensionReason' in sanitized, false);
    assert.equal('ownerEmail' in sanitized, false);
    assert.equal('tinNumber' in sanitized, false);
    assert.equal('licenseNumber' in sanitized, false);
  });
});

describe('Discover Shops — Search, Category Filtering, Availability & Pagination', () => {
  const catalog: Shop[] = [
    makeShop({
      shopId: 'shop-coffee',
      name: 'Yirga Aroma Roasters',
      mainCategory: 'coffee',
      productTypes: ['Sidama Coffee', 'Yirgacheffe Beans'],
      neighborhood: 'Piazza',
      availabilityStatus: 'active',
      featured: true,
    }),
    makeShop({
      shopId: 'shop-electronics',
      name: 'Hawassa Tech Hub',
      mainCategory: 'electronics',
      productTypes: ['Samsung Phones', 'USB-C Chargers'],
      neighborhood: 'Menhariya',
      availabilityStatus: 'active',
    }),
    makeShop({
      shopId: 'shop-agri',
      name: 'Rift Valley Farm Supply',
      mainCategory: 'agriculture',
      productTypes: ['Teff Grain', 'Organic Honey'],
      neighborhood: 'Tabor',
      availabilityStatus: 'temporarily_closed',
    }),
  ];

  it('filters by category including Coffee Traders and Agriculture', () => {
    const coffeeRes = filterAndPaginateDiscoverShops(catalog, [], { category: 'coffee' });
    assert.deepEqual(
      coffeeRes.items.map((s) => s.shopId),
      ['shop-coffee']
    );

    const agriRes = filterAndPaginateDiscoverShops(catalog, [], { category: 'agriculture' });
    assert.deepEqual(
      agriRes.items.map((s) => s.shopId),
      ['shop-agri']
    );
  });

  it('searches across shop name, product types, category, and location', () => {
    assert.equal(
      filterAndPaginateDiscoverShops(catalog, [], { searchQuery: 'USB-C' }).items[0]?.shopId,
      'shop-electronics'
    );
    assert.equal(
      filterAndPaginateDiscoverShops(catalog, [], { searchQuery: 'Menhariya' }).items[0]?.shopId,
      'shop-electronics'
    );
    assert.equal(
      filterAndPaginateDiscoverShops(catalog, [], { searchQuery: 'Teff' }).items[0]?.shopId,
      'shop-agri'
    );
  });

  it('filters by availability status and paginates accurately', () => {
    const activeOnly = filterAndPaginateDiscoverShops(catalog, [], { availability: 'active' });
    assert.equal(activeOnly.total, 2);

    const page1 = filterAndPaginateDiscoverShops(catalog, [], { page: 1, pageSize: 2 });
    assert.equal(page1.items.length, 2);
    assert.equal(page1.total, 3);
    assert.equal(page1.hasMore, true);

    const page2 = filterAndPaginateDiscoverShops(catalog, [], { page: 2, pageSize: 2 });
    assert.equal(page2.items.length, 1);
    assert.equal(page2.hasMore, false);
  });
});

describe('Discover Shops — In-App Chat Guard & Validation & Share URL', () => {
  it('prevents self-chat, unauthenticated chat, and suspended account/shop chat', () => {
    const shop = makeShop({ ownerUid: 'owner-1', status: 'approved' });

    assert.equal(canStartShopChat({ currentUid: null, shop }).code, 'AUTH_REQUIRED');
    assert.equal(canStartShopChat({ currentUid: 'owner-1', shop }).code, 'SELF_CHAT_BLOCKED');
    assert.equal(
      canStartShopChat({ currentUid: 'buyer-2', isSuspended: true, shop }).code,
      'ACCOUNT_SUSPENDED'
    );
    assert.equal(
      canStartShopChat({
        currentUid: 'buyer-2',
        shop: { ownerUid: 'owner-1', status: 'suspended' },
      }).code,
      'SHOP_UNAVAILABLE'
    );
    assert.equal(canStartShopChat({ currentUid: 'buyer-2', shop }).allowed, true);
  });

  it('validates shop profile payload and rejects bad coordinates or missing phone', () => {
    const invalid = validateShopProfilePayload({
      name: 'A',
      description: 'short',
      mainCategory: 'coffee',
      neighborhood: 'Piazza',
      address: 'Hi',
      phoneNumber: 'invalid',
      latitude: 120,
      longitude: 200,
    });
    assert.equal(invalid.valid, false);
    assert.ok(invalid.errors.name);
    assert.ok(invalid.errors.description);
    assert.ok(invalid.errors.phoneNumber);
    assert.ok(invalid.errors.coordinates);

    const valid = validateShopProfilePayload({
      name: 'Lakeview Organic Market',
      description: 'Fresh Sidama farm produce and spices available daily in Hawassa.',
      mainCategory: 'agriculture',
      productTypes: ['Organic Honey', 'Fresh Avocado'],
      neighborhood: 'Hayk Dar',
      address: 'Lake Side Road, Stall 9',
      phoneNumber: '0911223344',
    });
    assert.equal(valid.valid, true);
    assert.equal(valid.normalized?.phoneNumber, '+251911223344');
  });

  it('builds clean shareable shop links', () => {
    assert.equal(
      buildShopShareUrl('https://affinconnect.app/', 'shop-123'),
      'https://affinconnect.app/?shop=shop-123'
    );
  });
});
