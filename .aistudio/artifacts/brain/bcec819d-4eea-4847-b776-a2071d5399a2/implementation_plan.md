# Implementation Plan: Hawasa Gebeya Mobile Marketplace

Hawasa Gebeya is a production-oriented mobile marketplace connecting local shops and customers in Hawassa, Sidama Region, Ethiopia.

## User Preferences & Decisions
- **Presentation**: Interactive Mobile Simulator running an Expo/React Native architecture with a device shell, device rotation, and direct inspection capabilities.
- **Data Strategy**: Live Firestore integration with automatic seeding of authentic Hawassa shops (Piazza, Menhariya, Arab Sefer, Gebeya Dar) across fashion, electronics, fresh groceries, coffee/spices, and household goods.
- **Database**: Cloud Firestore (`ai-studio-bcec819d-4eea-4847-b776-a2071d5399a2` on project `arctic-nebula-xwpgt`) with Firebase Authentication.
- **Currency**: Ethiopian Birr (ETB) with tabular numeral formatting.
- **Languages**: English, Amharic (አማርኛ), and Afaan Oromo.

---

## Architecture & Technology Stack

### 1. Mobile & Frontend Architecture
- **Framework**: React Native Web / Expo component hierarchy running on Vite.
- **Routing**: View & screen router reflecting Expo Router layout (`(customer)`, `product/[id]`, `shop/[id]`, `cart`, `checkout`, `orders/[id]`, `seller/`, `admin/`, `onboarding`).
- **Styling**: Tailwind CSS with deep green (`#0F5132` / `#166534`), warm Ethiopian gold (`#D97706` / `#F59E0B`), warm stone backgrounds, and accessible touch targets ($\ge 44\text{px}$).
- **State Management**: Reactive cart and user session stores with optimistic updates and local persistence.

### 2. Backend & Firebase Services
- **Firebase Auth**: Google sign-in and email/password authentication with persistence and role-based access control.
- **Cloud Firestore**:
  - `users/{uid}`: Profiles, roles (`customer`, `seller`, `admin`), preferred language.
  - `shops/{shopId}`: Verified Hawassa shops with neighborhood, coordinates, business hours, and delivery capabilities.
  - `products/{productId}`: Structured product catalog with stock, pricing in ETB, and shop references.
  - `categories/{slug}`: Dynamic categories with multilingual labels.
  - `orders/{orderId}`: Real orders with item snapshots, status workflows, and seller notes.
  - `addresses/{addressId}`: Customer delivery addresses in Hawassa neighborhoods.
  - `notifications/{notificationId}`: Real-time user order and status notifications.
- **Security**: Hardened Firestore rules with RBAC and path verification, preventing unauthorized privilege escalation.

---

## Planned User Journeys

1. **Customer Journey**:
   - Onboarding & Hawassa neighborhood selection (Piazza, Menhariya, Gebeya Dar, Datto, Arab Sefer).
   - Home screen browsing with categories, banners, featured shops, and nearby products.
   - Search by product, shop name, or category with price filters.
   - Product details with real stock validation, shop profile navigation, and quantity selection.
   - Shopping cart and secure checkout (Cash on Delivery, Pay at Pickup, Telebirr/CBE Birr sandbox).
   - Real-time order tracking through all valid lifecycle states (`pending` $\to$ `accepted` $\to$ `preparing` $\to$ `ready_for_pickup` $\to$ `out_for_delivery` $\to$ `delivered`).

2. **Seller Journey**:
   - Shop dashboard with incoming orders, active listings, and inventory counts.
   - Order management: Accept or reject orders with explicit reasons, and advance status to preparing/ready/dispatched.
   - Product listing management: Add new products with image URLs, set ETB pricing and stock.

3. **Admin Journey**:
   - Overview of marketplace metrics, shops pending approval, product moderation, and category management.

---

## Phased Execution Steps

### Phase 1: Security Rules & Intermediate Representation
- Deploy `firestore.rules` and sync `firebase-blueprint.json`.
- Implement `handleFirestoreError` and connection verification testing.

### Phase 2: Firebase Client & Seed Data Engine
- Initialize Firebase app with `firebase-applet-config.json`.
- Seed authentic Hawassa shops (e.g. *Tabor Textiles*, *Haile Groceries & Spices*, *Lake Hawassa Fish & Fresh Market*, *Piazza Electronics*, *Sidama Organic Coffee Roasters*).

### Phase 3: Core UI & Mobile Screen Architecture
- Implement mobile frame shell with status bar, notch, and navigation.
- Implement Onboarding, Home, Search, Product Detail, Shop Profile, Cart, Checkout, Order Tracking, Customer Profile, Seller Dashboard, and Admin Moderation.

### Phase 4: Localization & Accessibility
- Complete translations for English, Amharic, and Afaan Oromo.

### Phase 5: Verification & Tests
- Write pure logic unit tests for cart calculations, order state transitions, and role enforcement.
- Verify in headless browser via Playwright CLI.
- Lint and compile.
