import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Shop } from '../types/index.ts';
import {
  buildCreatedShopDocument,
  buildStatusUpdatedShopDocument,
  buildUpdatedShopDocument,
  evaluateShopCreateAuthorization,
  evaluateShopUpdateAuthorization,
} from './shops.ts';

function makeExistingShop(overrides: Partial<Shop> = {}): Shop {
  return {
    shopId: 'shop-100',
    ownerUid: 'seller-1',
    name: 'Hawassa Coffee & Spice',
    slug: 'hawassa-coffee-spice',
    description: 'Direct-from-farm Sidama coffee and traditional spice blends.',
    logoUrl: '/assets/aistudio/image_703e5fa8.png',
    coverImageUrl: '/assets/aistudio/image_f24c9e47.png',
    phoneNumber: '+251911223344',
    mainCategory: 'coffee',
    productTypes: ['Roasted Coffee', 'Berbere'],
    region: 'Sidama Region',
    city: 'Hawassa',
    neighborhood: 'Piazza',
    address: 'Piazza Main Street #10',
    preferredContactMethod: 'both',
    deliveryAvailable: true,
    pickupAvailable: true,
    status: 'approved',
    verificationStatus: 'approved',
    availabilityStatus: 'active',
    isPublished: true,
    traderType: 'coffee',
    rating: 4.9,
    reviewCount: 7,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Backend Shops API — Authorization Rules', () => {
  it('blocks ordinary customers and suspended users from creating shop profiles', () => {
    const customerCheck = evaluateShopCreateAuthorization({
      uid: 'cust-1',
      userProfile: { role: 'customer', accountStatus: 'active' },
      existingShops: [],
    });
    assert.equal(customerCheck.allowed, false);
    assert.equal(customerCheck.code, 'CUSTOMER_NOT_SELLER');

    const suspendedCheck = evaluateShopCreateAuthorization({
      uid: 'seller-bad',
      userProfile: { role: 'seller', accountStatus: 'suspended' },
      existingShops: [],
    });
    assert.equal(suspendedCheck.allowed, false);
    assert.equal(suspendedCheck.code, 'ACCOUNT_SUSPENDED');

    const sellerCheck = evaluateShopCreateAuthorization({
      uid: 'seller-1',
      userProfile: { role: 'seller', accountStatus: 'active' },
      existingShops: [],
    });
    assert.equal(sellerCheck.allowed, true);
    assert.equal(sellerCheck.isAdmin, false);
  });

  it('prevents cross-seller edits and edits to suspended shops', () => {
    const shop = makeExistingShop({ ownerUid: 'seller-1' });

    const otherSeller = evaluateShopUpdateAuthorization({
      uid: 'seller-2',
      userProfile: { role: 'seller', accountStatus: 'active' },
      existingShop: shop,
    });
    assert.equal(otherSeller.allowed, false);
    assert.equal(otherSeller.code, 'SHOP_NOT_OWNED');

    const suspendedShop = evaluateShopUpdateAuthorization({
      uid: 'seller-1',
      userProfile: { role: 'seller', accountStatus: 'active' },
      existingShop: makeExistingShop({ status: 'suspended' }),
    });
    assert.equal(suspendedShop.allowed, false);
    assert.equal(suspendedShop.code, 'SHOP_SUSPENDED');

    const ownerCheck = evaluateShopUpdateAuthorization({
      uid: 'seller-1',
      userProfile: { role: 'seller', accountStatus: 'active' },
      existingShop: shop,
    });
    assert.equal(ownerCheck.allowed, true);
  });
});

describe('Backend Shops API — Document Creation, Update & Status Lifecycle', () => {
  it('creates a shop profile with 0 products, account default phone, and pending verification for non-admin', () => {
    const created = buildCreatedShopDocument({
      input: {
        name: 'Tabor Electronics Studio',
        description: 'Authorized smartphones, chargers, and repairs in Tabor Hawassa.',
        mainCategory: 'electronics',
        productTypes: ['Smartphones', 'Laptop Chargers'],
        neighborhood: 'Tabor',
        address: 'Tabor Square Building 2',
      },
      uid: 'seller-2',
      isAdmin: false,
      accountPhone: '0912345678',
      existingShops: [makeExistingShop()],
    });

    assert.equal(created.ok, true);
    if (created.ok) {
      assert.equal(created.shop.ownerUid, 'seller-2');
      assert.equal(created.shop.phoneNumber, '+251912345678');
      assert.equal(created.shop.status, 'pending');
      assert.equal(created.shop.verificationStatus, 'unverified');
      assert.equal(created.shop.isPublished, false);
      assert.deepEqual(created.shop.productTypes, ['Smartphones', 'Laptop Chargers']);
    }
  });

  it('blocks unverified sellers from publishing their shop publicly on update or status change', () => {
    const unverifiedShop = makeExistingShop({
      status: 'pending',
      verificationStatus: 'unverified',
      isPublished: false,
    });

    const updateRes = buildUpdatedShopDocument({
      existingShop: unverifiedShop,
      input: {
        name: 'Updated Unverified Shop',
        isPublished: true,
      },
      isAdmin: false,
      existingShops: [unverifiedShop],
    });
    assert.equal(updateRes.ok, false);
    if (!updateRes.ok) {
      assert.equal(updateRes.status, 403);
    }

    const statusRes = buildStatusUpdatedShopDocument({
      existingShop: unverifiedShop,
      availabilityStatus: 'active',
      isPublished: true,
      isAdmin: false,
    });
    assert.equal(statusRes.ok, false);
    if (!statusRes.ok) {
      assert.equal(statusRes.status, 403);
    }
  });

  it('allows verified sellers to update details, preserve immutable moderation fields, and toggle availability status', () => {
    const verifiedShop = makeExistingShop({
      status: 'approved',
      verificationStatus: 'approved',
      rating: 4.9,
      reviewCount: 7,
    });

    const updateRes = buildUpdatedShopDocument({
      existingShop: verifiedShop,
      input: {
        name: 'Hawassa Coffee & Spice Roastery',
        productTypes: ['Sidama Whole Beans', 'Roasted Espresso'],
        availabilityStatus: 'temporarily_closed',
      },
      isAdmin: false,
      existingShops: [verifiedShop],
    });
    assert.equal(updateRes.ok, true);
    if (updateRes.ok) {
      assert.equal(updateRes.shop.status, 'approved');
      assert.equal(updateRes.shop.rating, 4.9);
      assert.equal(updateRes.shop.availabilityStatus, 'temporarily_closed');
      assert.equal(updateRes.shop.isPublished, true);
    }

    const deactivateRes = buildStatusUpdatedShopDocument({
      existingShop: verifiedShop,
      availabilityStatus: 'inactive',
      isPublished: false,
      isAdmin: false,
    });
    assert.equal(deactivateRes.ok, true);
    if (deactivateRes.ok) {
      assert.equal(deactivateRes.shop.availabilityStatus, 'inactive');
      assert.equal(deactivateRes.shop.isPublished, false);
    }
  });
});
