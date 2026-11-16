# Hawasa Gebeya — Local Marketplace for Hawassa, Sidama Region, Ethiopia

Hawasa Gebeya connects customers with local merchants across Hawassa neighborhoods (Piazza, Menhariya, Gebeya Dar, Tabor, Datto, Arab Sefer, Bilo, Atote) with real-time Firebase Firestore integration, multilingual support (English, Amharic / አማርኛ, Afaan Oromo), Ethiopian Birr (ETB) pricing, cart management, and seller/admin workflows.

---

## Architecture & Modules

- `src/services/firebase.ts`: Firebase initialization (`firebase-applet-config.json`), Firestore database binding (`ai-studio-bcec819d-4eea-4847-b776-a2071d5399a2`), connection verification, and structured `handleFirestoreError`.
- `src/services/marketplaceService.ts`: Firestore listeners and transactions for `shops`, `products`, `categories`, `orders`, `addresses`, `reviews`, `notifications`, and `users`.
- `src/utils/marketplaceLogic.ts`: Pure business logic for ETB formatting, cart totals, multi-shop checkout guards, order state transitions (`pending` -> `accepted` -> `preparing` -> `ready_for_pickup` / `out_for_delivery` -> `delivered`), product filtering, and form validation.
- `src/context/MarketplaceContext.tsx`: Unified app state, Firebase Auth session management, local fallback persistence, and Expo Router-style screen navigation.
- `src/components/MobileSimulatorShell.tsx`: Interactive Android-first mobile viewport frame with bottom navigation and desktop companion simulator controls.
- `src/screens/`: Complete screen implementations for Onboarding, Home, Search & Filters, Product Details, Shop Profile, Cart, Checkout, Order Confirmation, Order Tracking, Favorites, Notifications, Profile & Addresses, Seller Portal, and Admin Moderation.
- `firestore.rules` & `firebase-blueprint.json`: Hardened role-based security rules and collection schema definitions.

---

## Running & Testing

```bash
# Install dependencies
npm install

# Run unit tests for marketplace business logic
npx --yes tsx --test src/utils/marketplaceLogic.test.ts

# Type-check and build
npm run lint
npm run build

# Start development server on port 3000
npm run dev
```

---

## Firebase Setup & Security Rules

1. The application reads configuration from `firebase-applet-config.json`.
2. Firestore Security Rules are stored in `firestore.rules` and enforce:
   - Role and account status protection (`users/{uid}`)
   - Shop ownership verification on product writes (`products/{productId}`)
   - Customer ownership and shop fulfillment boundaries on orders (`orders/{orderId}`)
   - Private address and notification isolation (`addresses/{addressId}`, `notifications/{notificationId}`)
3. Never embed Firebase Admin SDK credentials or payment gateway secret keys (Telebirr / Chapa / CBE Birr secrets) in client code.

---

## Payment Integrations

- **Cash on Delivery (COD)** & **Pay at Shop / Pickup**: Ready for immediate Hawassa local fulfillment.
- **Telebirr & CBE Birr**: Integrated in checkout as clearly labeled development previews. Production usage requires a trusted backend endpoint to sign payment requests and verify webhooks before setting `paymentStatus: "paid"`.
