# Bookstore E-Commerce Platform Backend

Enterprise-grade TypeScript RESTful backend implementing all 6 domains derived from the E-Commerce architecture diagram.

---

## 🌟 Architecture & Bounded Contexts Implemented

1. **Member & Identity Service (`/api/v1/members`)**
   - User Registration, JWT Authentication & Session Token generation
   - Role-Based Access Control (`CUSTOMER`, `STORE_ADMIN`, `CATALOG_MANAGER`, `SUPPORT_AGENT`)
   - User Entitlement Tiers (`STANDARD`, `VIP`, `STUDENT`, `WHOLESALE`)
   - Address book management (Shipping and Billing)

2. **Store & Governance Service (`/api/v1/stores`)**
   - Multi-Store configurations (Currencies, Locales, Support emails)
   - Operational Policies (Return windows, Cancellation hours, Tax percentages, Free shipping threshold)
   - Store-to-Catalog bindings

3. **Catalog & Recommendation Service (`/api/v1/catalog`)**
   - Category hierarchy and product attributes (ISBN, Authors, Formats: Hardcover/Paperback/eBook)
   - Entitlement-aware catalog browsing and multi-faceted search (Author, Format, Price range)
   - Cross-Selling and Up-Selling recommendations
   - Personalized recommendations based on customer purchase history

4. **Cart & Order Service (`/api/v1/orders`)**
   - Persistent Guest & Member carts with guest-to-member cart merging upon login
   - Real-time stock reservation and price calculation
   - Coupon codes (`WELCOME10`, `FLAT15`) and Gift Points redemption
   - Full order lifecycle state machine (`PENDING_PAYMENT` -> `CONFIRMED` -> `SHIPPED` -> `DELIVERED` -> `RETURN_REQUESTED` -> `CANCELLED`)

5. **Payment & Wallet Service (`/api/v1/payments`)**
   - Payment gateway orchestration for Credit/Debit Cards and digital payments
   - Internal Wallet balance management with automated transaction ledger
   - Loyalty Gift Points rewards (Earn 1 point per $1 spent, Redeem 10 pts = $1)
   - Full & Partial refund processing directly to source card or wallet

6. **Shipping & Fulfillment Service (`/api/v1/shipping`)**
   - Dynamic carrier rate matrix (Standard, Express, Overnight) and Free Shipping rules
   - Estimated Delivery Date (EDD) calculation based on carrier SLAs
   - Real-time forward tracking & Reverse return logistics tracking

---

## 🚀 Quickstart & Running the Backend

### Prerequisites
- Node.js (v18+)
- npm

### 1. Build TypeScript
```powershell
npm run build
```

### 2. Run Test Suite
```powershell
npm test
```

### 3. Start the Server
```powershell
npm start
```

Default Server Address: **`http://localhost:3000`**

---

## 📚 API Endpoints Summary

| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| **GET** | `/` | Service health and domain directory | Public |
| **GET** | `/api/docs` | Full OpenAPI specifications | Public |
| **POST** | `/api/v1/members/register` | Register customer | Public |
| **POST** | `/api/v1/members/login` | Login and get JWT | Public |
| **GET** | `/api/v1/members/profile` | Current profile & wallet | Bearer JWT |
| **GET** | `/api/v1/stores` | List stores and active policies | Public |
| **GET** | `/api/v1/catalog/products` | Search books with facets | Public / Optional |
| **GET** | `/api/v1/catalog/recommendations` | Personalized book recommendations | Public / Optional |
| **GET** | `/api/v1/orders/cart` | Get active cart items & totals | Guest / Auth |
| **POST** | `/api/v1/orders/cart/items` | Add/update items in cart | Guest / Auth |
| **POST** | `/api/v1/orders/cart/apply-coupon` | Apply coupon & points | Guest / Auth |
| **POST** | `/api/v1/orders/checkout` | Reserve inventory & create order | Guest / Auth |
| **POST** | `/api/v1/payments/process` | Pay via Card or Wallet | Guest / Auth |
| **POST** | `/api/v1/payments/refund` | Refund order to card / wallet | Guest / Auth |
| **POST** | `/api/v1/shipping/calculate-rates`| Calculate shipping rates & EDD | Public |
| **GET** | `/api/v1/shipping/track/:trackingNumber` | Track package / return | Public |

---

## 🧪 Pre-configured Seed Credentials

- **Customer:** `john.doe@example.com` / `User@123` (Preloaded with $150.00 wallet balance and 250 gift points)
- **Store Admin:** `admin@bookstore.com` / `Admin@123`
- **Catalog Manager:** `catalog@bookstore.com` / `Admin@123`
