import type {
  CoffeeBeanForm,
  CoffeeProcessMethod,
  CoffeeProductDetails,
  CoffeeRoastLevel,
  Product,
} from '../types';

export const CANONICAL_COFFEE_CATEGORY = 'coffee' as const;

export const CANONICAL_PRODUCT_CATEGORIES = [
  'coffee',
  'groceries',
  'clothing-fashion',
  'electronics',
  'food-spices',
  'home-living',
  'beauty-cosmetics',
  'sports',
  'automotive',
] as const;

export type CanonicalProductCategory = (typeof CANONICAL_PRODUCT_CATEGORIES)[number];

const COFFEE_CATEGORY_ALIAS_MAP = new Set<string>([
  'coffee',
  'ethiopian coffee',
  'ethiopian-coffee',
  'roasted coffee',
  'roasted-coffee',
  'coffee beans',
  'coffee-beans',
  'green coffee',
  'green-coffee',
  'green coffee beans',
  'green-coffee-beans',
  'ground coffee',
  'ground-coffee',
  'whole bean coffee',
  'whole-bean-coffee',
  'specialty coffee',
  'specialty-coffee',
  'coffee traders',
  'coffee-traders',
  'arabica coffee',
  'arabica-coffee',
  'single origin coffee',
  'single-origin-coffee',
  'espresso beans',
  'espresso-beans',
  'buna',
  'ethiopian buna',
  'ethiopian-buna',
]);

const GENERAL_CATEGORY_ALIAS_MAP: Record<string, CanonicalProductCategory> = {
  groceries: 'groceries',
  grocery: 'groceries',
  'groceries & coffee': 'groceries',
  'groceries and coffee': 'groceries',
  supermarket: 'groceries',
  pantry: 'groceries',
  'clothing-fashion': 'clothing-fashion',
  clothing: 'clothing-fashion',
  fashion: 'clothing-fashion',
  apparel: 'clothing-fashion',
  'clothing & habesha': 'clothing-fashion',
  'clothing and habesha': 'clothing-fashion',
  electronics: 'electronics',
  'phones & electronics': 'electronics',
  'phones and electronics': 'electronics',
  phones: 'electronics',
  mobile: 'electronics',
  'mobile phones': 'electronics',
  gadgets: 'electronics',
  'food-spices': 'food-spices',
  spices: 'food-spices',
  'spices & honey': 'food-spices',
  'spices and honey': 'food-spices',
  'food & spices': 'food-spices',
  'food & drinks': 'food-spices',
  'home-living': 'home-living',
  home: 'home-living',
  household: 'home-living',
  'home & household': 'home-living',
  'home & living': 'home-living',
  furniture: 'home-living',
  kitchenware: 'home-living',
  'beauty-cosmetics': 'beauty-cosmetics',
  beauty: 'beauty-cosmetics',
  cosmetics: 'beauty-cosmetics',
  'beauty & care': 'beauty-cosmetics',
  'beauty & health': 'beauty-cosmetics',
  skincare: 'beauty-cosmetics',
  sports: 'sports',
  fitness: 'sports',
  'sports & fitness': 'sports',
  automotive: 'automotive',
  auto: 'automotive',
  'car parts': 'automotive',
};

const PERMISSIVE_AUTO_COFFEE_SOURCE_CATEGORIES = new Set<string>([
  '',
  'coffee',
  'groceries',
  'food-spices',
]);

const CONFLICTING_NON_COFFEE_CATEGORIES = new Set<string>([
  'electronics',
  'clothing-fashion',
  'home-living',
  'beauty-cosmetics',
  'sports',
  'automotive',
]);

export const COFFEE_PRODUCT_TYPE_SUGGESTIONS = [
  'Ethiopian Coffee',
  'Roasted Coffee',
  'Coffee Beans',
  'Ground Coffee',
  'Green Coffee Beans',
  'Whole Bean Coffee',
  'Specialty Coffee',
] as const;

const KNOWN_COFFEE_ORIGINS = [
  'Sidama',
  'Yirgacheffe',
  'Guji',
  'Harar',
  'Jimma',
  'Kaffa',
  'Limu',
  'Nekemte',
  'Bench Maji',
] as const;

// Non-coffee accessories, equipment, furniture, cosmetics, apparel, and confections
// that may contain the word "coffee" in their name and therefore require confirmation
// or belong to a non-coffee category instead of Coffee Traders.
const COFFEE_ACCESSORY_OR_AMBIGUOUS_PATTERN =
  /\b(mug|mugs|cup|cups|tumbler|thermos|flask|table|tables|tray|coaster|maker|machine|grinder|press|kettle|pot|jebena|filter|filters|scale|tamper|frother|spoon|jar|canister|tin|rack|stand|poster|art|sign|scrub|soap|lotion|cream|serum|shampoo|mask|candle|perfume|lipstick|polish|cake|cookie|cookies|biscuit|biscuits|brownie|chocolate|candy|toffee|ice[\s-]?cream|syrup|liqueur|shirt|t-shirt|tee|dress|kemis|pants|trousers|jeans|jacket|hoodie|sweater|scarf|shoes|sneakers|bag|backpack|sofa|curtain|rug|pillow|paint|dye|colored|colour|color|shade|brown|flavored|flavoured|scented|print|themed)\b/i;

// Unmistakable non-coffee product patterns used to reject direct API attempts to
// force obviously non-coffee goods (e.g., smartphones, clothes) into Coffee Traders.
const DEFINITE_NON_COFFEE_PRODUCT_PATTERN =
  /\b(smartphone|mobile\s+phone|cell\s+phone|iphone|samsung|galaxy|tecno|infinix|xiaomi|redmi|huawei|laptop|notebook|tablet|ipad|earbuds|airpods|headphones|charger|power\s+bank|television|smart\s+tv|refrigerator|washing\s+machine|habesha\s+kemis|cotton\s+dress|t-shirt|jeans|sneakers|running\s+shoes|car\s+battery|motor\s+oil|brake\s+pad|dumbbell|treadmill|football|basketball|berbere|mitmita|shiro|teff\s+flour|pure\s+honey|sidama\s+honey)\b/i;

// Strong structured coffee signals evaluated ONLY against product name & productType
// (NEVER description).
const REGIONAL_COFFEE_PATTERN =
  /\b(sidama|yirgacheffe|yirgachefe|harar|hararghe|jimma|kaffa|guji|limu|nekemte|bench[\s-]?maji|ethiopian)\b[\s\w-]{0,40}\b(coffee|buna|arabica|espresso)\b/i;

const EXPLICIT_COFFEE_FORM_PATTERN =
  /\b(roasted|ground|green|whole[\s-]?bean|single[\s-]?origin|specialty|organic|washed|natural|honey[\s-]?process|arabica|espresso|decaf|instant|traditional|freshly[\s-]?roasted|dark[\s-]?roast|medium[\s-]?roast|light[\s-]?roast)\s+(?:ethiopian\s+|sidama\s+|yirgacheffe\s+|harar\s+|jimma\s+|guji\s+)?(coffee|buna)(\s+beans?)?\b/i;

const COFFEE_NOUN_HEAD_PATTERN =
  /\b(coffee|buna)\s+(beans?|powder|roast|roasted|blend|grounds?|pack|pouch|bag|lot|sack|harvest|export|250\s*g|500\s*g|1\s*kg|2\s*kg|5\s*kg)\b/i;

const REGIONAL_ROASTED_BEANS_PATTERN =
  /\b(sidama|yirgacheffe|yirgachefe|harar|hararghe|jimma|kaffa|guji|limu|ethiopian)\s+(roasted|washed|natural|green|whole)\s+beans?\b/i;

const STANDALONE_COFFEE_WORD_PATTERN = /\b(coffee|buna)\b/i;

const PACKAGE_WEIGHT_REGEX = /\b(\d+(?:\.\d+)?\s*(?:g|kg))\b/i;

export type CoffeeCategorizationOutcome = 'coffee' | 'non_coffee' | 'ambiguous' | 'conflict';

export interface CoffeeCategorizationInput {
  name: string;
  category?: string;
  productType?: string;
  coffeeDetails?: Partial<CoffeeProductDetails>;
  categoryConfirmed?: boolean;
  confirmedCategory?: string;
}

export interface CoffeeCategorizationResult {
  outcome: CoffeeCategorizationOutcome;
  isCoffee: boolean;
  resolvedCategory: string;
  requestedCategory: string;
  suggestedCategory: string;
  autoAssigned: boolean;
  requiresConfirmation: boolean;
  reason: string;
  matchedSignals: string[];
  inferredCoffeeDetails?: Partial<CoffeeProductDetails>;
}

/**
 * Normalizes raw category labels and case/whitespace variations into a canonical
 * lowercase kebab-case slug so `coffee`, `Coffee`, `COFFEE`, `Ethiopian Coffee`,
 * `Roasted Coffee`, `Coffee Beans`, and `Ground Coffee` all map to `'coffee'`.
 */
export function normalizeProductCategory(rawCategory?: string | null): string {
  if (!rawCategory || typeof rawCategory !== 'string') return '';
  const cleaned = rawCategory
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/\s+/g, ' ');
  if (!cleaned) return '';

  if (COFFEE_CATEGORY_ALIAS_MAP.has(cleaned)) {
    return CANONICAL_COFFEE_CATEGORY;
  }
  const hyphenated = cleaned.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (COFFEE_CATEGORY_ALIAS_MAP.has(hyphenated)) {
    return CANONICAL_COFFEE_CATEGORY;
  }

  if (GENERAL_CATEGORY_ALIAS_MAP[cleaned]) {
    return GENERAL_CATEGORY_ALIAS_MAP[cleaned];
  }
  if (GENERAL_CATEGORY_ALIAS_MAP[hyphenated]) {
    return GENERAL_CATEGORY_ALIAS_MAP[hyphenated];
  }

  return hyphenated;
}

export function isCoffeeCategoryAlias(rawCategory?: string | null): boolean {
  return normalizeProductCategory(rawCategory) === CANONICAL_COFFEE_CATEGORY;
}

function inferNonCoffeeCategoryHint(structuredText: string): string {
  const lower = structuredText.toLowerCase();
  if (/\b(smartphone|mobile\s+phone|phone|iphone|samsung|galaxy|tecno|infinix|xiaomi|redmi|laptop|tablet|earbuds|charger|tv)\b/.test(lower)) {
    return 'electronics';
  }
  if (/\b(shirt|t-shirt|tee|dress|kemis|pants|trousers|jeans|jacket|hoodie|sweater|scarf|shoes|sneakers)\b/.test(lower)) {
    return 'clothing-fashion';
  }
  if (/\b(scrub|soap|lotion|cream|serum|shampoo|mask|perfume|lipstick|polish)\b/.test(lower)) {
    return 'beauty-cosmetics';
  }
  if (/\b(mug|cup|tumbler|thermos|flask|table|tray|coaster|maker|machine|grinder|press|kettle|pot|jebena|filter|candle|sofa|curtain|rug|pillow)\b/.test(lower)) {
    return 'home-living';
  }
  if (/\b(car\s+battery|motor\s+oil|brake\s+pad|tire)\b/.test(lower)) {
    return 'automotive';
  }
  if (/\b(dumbbell|treadmill|football|basketball)\b/.test(lower)) {
    return 'sports';
  }
  if (/\b(berbere|mitmita|shiro|honey)\b/.test(lower)) {
    return 'food-spices';
  }
  return 'groceries';
}

/**
 * Extracts only factual coffee metadata literally stated in structured fields
 * (`name`, `productType`) without fabricating roast dates or certifications.
 */
export function inferCoffeeDetailsFromStructuredFields(
  name: string,
  productType?: string
): Partial<CoffeeProductDetails> {
  const text = `${name ?? ''} ${productType ?? ''}`.trim();
  if (!text) return {};
  const inferred: Partial<CoffeeProductDetails> = {};

  for (const origin of KNOWN_COFFEE_ORIGINS) {
    if (new RegExp(`\\b${origin}\\b`, 'i').test(text)) {
      inferred.origin = origin;
      break;
    }
  }
  if (!inferred.origin && /\byirgachefe\b/i.test(text)) {
    inferred.origin = 'Yirgacheffe';
  } else if (!inferred.origin && /\bhararghe\b/i.test(text)) {
    inferred.origin = 'Harar';
  }

  let beanForm: CoffeeBeanForm | undefined;
  if (/\b(ground|powder|fine\s+grind|medium\s+grind|coarse\s+grind)\b/i.test(text)) {
    beanForm = 'ground';
  } else if (/\b(whole[\s-]?bean|coffee\s+beans?|green\s+coffee\s+beans?|roasted\s+beans?)\b/i.test(text)) {
    beanForm = 'whole_bean';
  }
  if (beanForm) inferred.beanForm = beanForm;

  let roastLevel: CoffeeRoastLevel | undefined;
  if (/\bmedium[\s-]?dark\s+roast\b/i.test(text)) {
    roastLevel = 'medium_dark';
  } else if (/\blight\s+roast\b/i.test(text)) {
    roastLevel = 'light';
  } else if (/\bmedium\s+roast\b/i.test(text)) {
    roastLevel = 'medium';
  } else if (/\bdark\s+roast\b/i.test(text)) {
    roastLevel = 'dark';
  }
  if (roastLevel) inferred.roastLevel = roastLevel;

  let processingMethod: CoffeeProcessMethod | undefined;
  if (/\bwashed\b/i.test(text)) {
    processingMethod = 'washed';
  } else if (/\bnatural(?:\s+process)?\b/i.test(text)) {
    processingMethod = 'natural';
  } else if (/\bhoney[\s-]?process\b/i.test(text)) {
    processingMethod = 'honey';
  } else if (/\banaerobic\b/i.test(text)) {
    processingMethod = 'anaerobic';
  }
  if (processingMethod) inferred.processingMethod = processingMethod;

  const weightMatch = text.match(PACKAGE_WEIGHT_REGEX);
  if (weightMatch?.[1]) {
    inferred.packageWeight = weightMatch[1].replace(/\s+/g, '').toLowerCase();
  }

  return inferred;
}

/**
 * Classifies a product strictly from structured fields (`category`, `productType`,
 * `name`) — NEVER from free-text `description` — to prevent false positives on
 * incidental coffee mentions (e.g., "coffee brown" clothing descriptions).
 */
export function classifyProductCoffeeCategory(
  input: CoffeeCategorizationInput
): CoffeeCategorizationResult {
  const name = (input.name ?? '').trim();
  const productType = (input.productType ?? '').trim();
  const rawCategory = (input.category ?? '').trim();
  const normalizedCategory = normalizeProductCategory(rawCategory);
  const normalizedProductTypeCategory = normalizeProductCategory(productType);
  const structuredText = `${name} ${productType}`.trim();

  const matchedSignals: string[] = [];
  const categoryIsCoffee = normalizedCategory === CANONICAL_COFFEE_CATEGORY;
  const productTypeIsCoffee = normalizedProductTypeCategory === CANONICAL_COFFEE_CATEGORY;

  if (categoryIsCoffee) matchedSignals.push(`category:${rawCategory || 'coffee'}`);
  if (productTypeIsCoffee) matchedSignals.push(`productType:${productType}`);

  const hasAccessoryOrAmbiguousTerm = COFFEE_ACCESSORY_OR_AMBIGUOUS_PATTERN.test(structuredText);
  const hasDefiniteNonCoffeeTerm = DEFINITE_NON_COFFEE_PRODUCT_PATTERN.test(structuredText);
  const hasRegionalCoffee = REGIONAL_COFFEE_PATTERN.test(structuredText);
  const hasExplicitCoffeeForm = EXPLICIT_COFFEE_FORM_PATTERN.test(structuredText);
  const hasCoffeeNounHead = COFFEE_NOUN_HEAD_PATTERN.test(structuredText);
  const hasRegionalBeans = REGIONAL_ROASTED_BEANS_PATTERN.test(structuredText);
  const hasCoffeeWord = STANDALONE_COFFEE_WORD_PATTERN.test(structuredText);

  if (hasRegionalCoffee) matchedSignals.push('regional_coffee_name');
  if (hasExplicitCoffeeForm) matchedSignals.push('coffee_form_name');
  if (hasCoffeeNounHead) matchedSignals.push('coffee_noun_head');
  if (hasRegionalBeans) matchedSignals.push('regional_roasted_beans');
  if (hasCoffeeWord && matchedSignals.length === 0) matchedSignals.push('coffee_keyword');

  const inferredCoffeeDetails = inferCoffeeDetailsFromStructuredFields(name, productType);
  const inferredPayload =
    Object.keys(inferredCoffeeDetails).length > 0 ? inferredCoffeeDetails : undefined;

  // 1. Ambiguous products: mentions coffee/buna in name or productType alongside
  //    a non-coffee accessory, equipment, color, scent, apparel, or confection term
  //    (e.g., "Coffee Mug", "Coffee Table", "Coffee Brown Dress", "Coffee Body Scrub").
  if ((hasCoffeeWord || categoryIsCoffee || productTypeIsCoffee) && hasAccessoryOrAmbiguousTerm) {
    const hintedNonCoffee =
      normalizedCategory && normalizedCategory !== CANONICAL_COFFEE_CATEGORY
        ? normalizedCategory
        : inferNonCoffeeCategoryHint(structuredText);

    if (input.categoryConfirmed) {
      const confirmed = normalizeProductCategory(
        input.confirmedCategory || normalizedCategory || hintedNonCoffee
      );
      if (confirmed === CANONICAL_COFFEE_CATEGORY) {
        return {
          outcome: 'coffee',
          isCoffee: true,
          resolvedCategory: CANONICAL_COFFEE_CATEGORY,
          requestedCategory: normalizedCategory,
          suggestedCategory: CANONICAL_COFFEE_CATEGORY,
          autoAssigned: normalizedCategory !== CANONICAL_COFFEE_CATEGORY,
          requiresConfirmation: false,
          reason: 'Seller confirmed this ambiguous product belongs in Coffee Traders.',
          matchedSignals,
          inferredCoffeeDetails: inferredPayload,
        };
      }
      return {
        outcome: 'non_coffee',
        isCoffee: false,
        resolvedCategory: confirmed || hintedNonCoffee,
        requestedCategory: normalizedCategory,
        suggestedCategory: confirmed || hintedNonCoffee,
        autoAssigned: false,
        requiresConfirmation: false,
        reason: `Seller confirmed this product belongs in "${confirmed || hintedNonCoffee}" rather than Coffee Traders.`,
        matchedSignals,
      };
    }

    return {
      outcome: 'ambiguous',
      isCoffee: false,
      resolvedCategory: hintedNonCoffee,
      requestedCategory: normalizedCategory || hintedNonCoffee,
      suggestedCategory: hintedNonCoffee,
      autoAssigned: false,
      requiresConfirmation: true,
      reason:
        'Product name/type looks coffee-related but resembles an accessory, apparel, or non-coffee item. Confirm whether it belongs in Coffee Traders or a general category.',
      matchedSignals,
    };
  }

  // 2. Definite coffee product detected from structured name / productType
  //    (without accessory/non-coffee terms).
  const hasClearCoffeeSignal =
    !hasDefiniteNonCoffeeTerm &&
    (productTypeIsCoffee ||
      hasRegionalCoffee ||
      hasExplicitCoffeeForm ||
      hasCoffeeNounHead ||
      hasRegionalBeans ||
      hasCoffeeWord);

  if (hasClearCoffeeSignal) {
    // Reject direct attempts to bypass categorization by placing an unmistakable
    // coffee product into an unrelated non-coffee category (e.g., electronics, clothing).
    if (
      normalizedCategory &&
      CONFLICTING_NON_COFFEE_CATEGORIES.has(normalizedCategory)
    ) {
      return {
        outcome: 'conflict',
        isCoffee: true,
        resolvedCategory: CANONICAL_COFFEE_CATEGORY,
        requestedCategory: normalizedCategory,
        suggestedCategory: CANONICAL_COFFEE_CATEGORY,
        autoAssigned: false,
        requiresConfirmation: false,
        reason: `Product "${name}" is identified as Ethiopian/specialty coffee and cannot be listed under "${normalizedCategory}". Assign it to Coffee Traders ("coffee").`,
        matchedSignals,
        inferredCoffeeDetails: inferredPayload,
      };
    }

    if (PERMISSIVE_AUTO_COFFEE_SOURCE_CATEGORIES.has(normalizedCategory)) {
      return {
        outcome: 'coffee',
        isCoffee: true,
        resolvedCategory: CANONICAL_COFFEE_CATEGORY,
        requestedCategory: normalizedCategory,
        suggestedCategory: CANONICAL_COFFEE_CATEGORY,
        autoAssigned: rawCategory.trim() !== CANONICAL_COFFEE_CATEGORY,
        requiresConfirmation: false,
        reason:
          normalizedCategory === CANONICAL_COFFEE_CATEGORY
            ? 'Normalized coffee category assigned to Coffee Traders.'
            : 'Automatically detected coffee product from structured fields and assigned to Coffee Traders.',
        matchedSignals,
        inferredCoffeeDetails: inferredPayload,
      };
    }

    // Any other unrecognized custom category sent with a clear coffee product is also a conflict.
    return {
      outcome: 'conflict',
      isCoffee: true,
      resolvedCategory: CANONICAL_COFFEE_CATEGORY,
      requestedCategory: normalizedCategory,
      suggestedCategory: CANONICAL_COFFEE_CATEGORY,
      autoAssigned: false,
      requiresConfirmation: false,
      reason: `Product "${name}" is identified as a coffee product and conflicts with category "${normalizedCategory}".`,
      matchedSignals,
      inferredCoffeeDetails: inferredPayload,
    };
  }

  // 3. Explicit coffee category alias chosen by seller (e.g., "Coffee", "COFFEE",
  //    "Ethiopian Coffee", "Roasted Coffee", "Coffee Beans", "Ground Coffee").
  if (categoryIsCoffee) {
    // Prevent forcing unmistakably non-coffee items (smartphones, clothes, etc.)
    // into Coffee Traders via direct API submission.
    if (hasDefiniteNonCoffeeTerm) {
      const suggested = inferNonCoffeeCategoryHint(structuredText);
      return {
        outcome: 'conflict',
        isCoffee: false,
        resolvedCategory: suggested,
        requestedCategory: CANONICAL_COFFEE_CATEGORY,
        suggestedCategory: suggested,
        autoAssigned: false,
        requiresConfirmation: false,
        reason: `Product "${name}" appears to be a non-coffee item and cannot be categorized under Coffee Traders.`,
        matchedSignals,
      };
    }

    return {
      outcome: 'coffee',
      isCoffee: true,
      resolvedCategory: CANONICAL_COFFEE_CATEGORY,
      requestedCategory: CANONICAL_COFFEE_CATEGORY,
      suggestedCategory: CANONICAL_COFFEE_CATEGORY,
      autoAssigned: rawCategory.trim() !== CANONICAL_COFFEE_CATEGORY,
      requiresConfirmation: false,
      reason: 'Coffee category normalized and assigned to Coffee Traders.',
      matchedSignals,
      inferredCoffeeDetails: inferredPayload,
    };
  }

  // 4. Standard non-coffee product — preserve normalized non-coffee category.
  const finalNonCoffeeCategory = normalizedCategory || 'groceries';
  return {
    outcome: 'non_coffee',
    isCoffee: false,
    resolvedCategory: finalNonCoffeeCategory,
    requestedCategory: finalNonCoffeeCategory,
    suggestedCategory: finalNonCoffeeCategory,
    autoAssigned: false,
    requiresConfirmation: false,
    reason: 'Standard non-coffee marketplace product.',
    matchedSignals: [],
  };
}

export interface CoffeeMigrationProductChange {
  productId: string;
  name: string;
  previousCategory: string;
  nextCategory: string;
  updatedProduct: Product;
  reason: string;
}

export interface CoffeeMigrationPlan {
  scanned: number;
  alreadyCategorized: number;
  eligible: number;
  skipped: number;
  ambiguous: number;
  changes: CoffeeMigrationProductChange[];
}

/**
 * Pure, idempotent backfill planner for existing products.
 * - Identifies existing products that clearly qualify as coffee products
 *   (e.g., legacy `groceries` coffee products or unnormalized `'Coffee'` / `'COFFEE'` labels).
 * - Preserves ownership, shopId, pricing, stock, images, status, ratings, and timestamps.
 * - Never touches unrelated non-coffee products or ambiguous products.
 * - Running again on the migrated catalog produces `eligible: 0, changes: []`.
 */
export function planCoffeeProductMigration(
  products: Product[],
  nowIso: string = new Date().toISOString()
): CoffeeMigrationPlan {
  let alreadyCategorized = 0;
  let skipped = 0;
  let ambiguous = 0;
  const changes: CoffeeMigrationProductChange[] = [];

  for (const product of products) {
    const normalizedCurrent = normalizeProductCategory(product.category);
    const alreadyCanonicalCoffee = product.category === CANONICAL_COFFEE_CATEGORY;

    if (alreadyCanonicalCoffee) {
      alreadyCategorized += 1;
      continue;
    }

    const classification = classifyProductCoffeeCategory({
      name: product.name,
      category: product.category,
      productType: product.productType,
      coffeeDetails: product.coffeeDetails,
    });

    if (classification.outcome === 'ambiguous') {
      ambiguous += 1;
      continue;
    }

    // Only auto-migrate products that unambiguously qualify as coffee
    // (either unnormalized coffee category aliases or clear coffee products in groceries/food-spices).
    if (classification.outcome === 'coffee') {
      const mergedCoffeeDetails: CoffeeProductDetails | undefined =
        product.coffeeDetails || classification.inferredCoffeeDetails
          ? {
              ...(classification.inferredCoffeeDetails ?? {}),
              ...(product.coffeeDetails ?? {}),
            }
          : undefined;

      const updatedProduct: Product = {
        ...product,
        category: CANONICAL_COFFEE_CATEGORY,
        ...(mergedCoffeeDetails && Object.keys(mergedCoffeeDetails).length > 0
          ? { coffeeDetails: mergedCoffeeDetails }
          : {}),
        updatedAt: nowIso,
      };

      changes.push({
        productId: product.productId,
        name: product.name,
        previousCategory: product.category,
        nextCategory: CANONICAL_COFFEE_CATEGORY,
        updatedProduct,
        reason: classification.reason,
      });
      continue;
    }

    // Also normalize unnormalized non-coffee category casing (e.g., "Electronics" -> "electronics")
    // without touching coffee status.
    if (normalizedCurrent && normalizedCurrent !== product.category) {
      const updatedProduct: Product = {
        ...product,
        category: normalizedCurrent,
        updatedAt: nowIso,
      };
      if ('coffeeDetails' in updatedProduct) {
        delete updatedProduct.coffeeDetails;
      }
      changes.push({
        productId: product.productId,
        name: product.name,
        previousCategory: product.category,
        nextCategory: normalizedCurrent,
        updatedProduct,
        reason: `Normalized category slug from "${product.category}" to "${normalizedCurrent}".`,
      });
      continue;
    }

    skipped += 1;
  }

  return {
    scanned: products.length,
    alreadyCategorized,
    eligible: changes.length,
    skipped,
    ambiguous,
    changes,
  };
}
