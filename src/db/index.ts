import fs from 'fs';
import path from 'path';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: 'CUSTOMER' | 'STORE_ADMIN' | 'CATALOG_MANAGER' | 'SUPPORT_AGENT';
  entitlementTier: 'STANDARD' | 'VIP' | 'STUDENT' | 'WHOLESALE';
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  id: string;
  userId: string;
  type: 'SHIPPING' | 'BILLING';
  fullName: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

export interface Store {
  id: string;
  name: string;
  code: string;
  currency: string;
  locale: string;
  supportEmail: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface StorePolicy {
  id: string;
  storeId: string;
  returnWindowDays: number;
  cancellationWindowHours: number;
  freeShippingThreshold: number;
  taxRatePercent: number;
  allowGuestCheckout: boolean;
}

export interface StoreCatalogMapping {
  id: string;
  storeId: string;
  catalogId: string;
  isPrimary: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  parentId?: string;
}

export interface Product {
  id: string;
  catalogId: string;
  title: string;
  isbn: string;
  author: string;
  publisher: string;
  publicationYear: number;
  format: 'HARDCOVER' | 'PAPERBACK' | 'EBOOK' | 'AUDIOBOOK';
  categoryId: string;
  price: number;
  currency: string;
  stockQuantity: number;
  rating: number;
  description: string;
  imageUrl: string;
  entitlementAccess: 'ALL' | 'VIP_ONLY' | 'STUDENT_ONLY';
  relatedProductIds: string[]; // For Cross-sell & Up-sell
  createdAt: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface Cart {
  id: string;
  userId?: string; // Optional if guest
  guestSessionId?: string;
  items: CartItem[];
  couponCode?: string;
  discountAmount: number;
  redeemedGiftPoints: number;
  updatedAt: string;
}

export interface Coupon {
  code: string;
  discountType: 'PERCENT' | 'FLAT';
  discountValue: number;
  minOrderValue: number;
  expiryDate: string;
  isActive: boolean;
}

export interface OrderItem {
  productId: string;
  title: string;
  isbn: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  storeId: string;
  userId?: string;
  guestEmail?: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  giftPointsRedeemed: number;
  shippingFee: number;
  tax: number;
  totalAmount: number;
  shippingAddress: Address;
  billingAddress: Address;
  status: 'CREATED' | 'PENDING_PAYMENT' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURN_REQUESTED' | 'RETURNED';
  paymentId?: string;
  trackingNumber?: string;
  estimatedDeliveryDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentTransaction {
  id: string;
  orderId: string;
  userId?: string;
  amount: number;
  currency: string;
  paymentMethod: 'CREDIT_CARD' | 'DEBIT_CARD' | 'NET_BANKING' | 'WALLET' | 'GIFT_CARD';
  gatewayTransactionId: string;
  status: 'INITIATED' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED';
  createdAt: string;
}

export interface WalletAccount {
  userId: string;
  balance: number;
  giftPoints: number;
  currency: string;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  type: 'CREDIT' | 'DEBIT' | 'POINTS_EARNED' | 'POINTS_REDEEMED' | 'REFUND';
  amount: number;
  balanceAfter: number;
  referenceId: string;
  description: string;
  createdAt: string;
}

export interface Refund {
  id: string;
  orderId: string;
  paymentTransactionId: string;
  amount: number;
  reason: string;
  refundMethod: 'ORIGINAL_PAYMENT' | 'WALLET';
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  createdAt: string;
}

export interface ShippingMethod {
  id: string;
  name: string;
  tier: 'STANDARD' | 'EXPRESS' | 'OVERNIGHT';
  baseRate: number;
  perKgRate: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
}

export interface ReturnShipment {
  id: string;
  orderId: string;
  userId?: string;
  reason: string;
  status: 'REQUESTED' | 'LABEL_GENERATED' | 'IN_TRANSIT' | 'RECEIVED' | 'INSPECTED' | 'REJECTED';
  returnTrackingNumber: string;
  createdAt: string;
}

export interface DatabaseSchema {
  users: User[];
  addresses: Address[];
  stores: Store[];
  storePolicies: StorePolicy[];
  storeCatalogMappings: StoreCatalogMapping[];
  categories: Category[];
  products: Product[];
  carts: Cart[];
  coupons: Coupon[];
  orders: Order[];
  paymentTransactions: PaymentTransaction[];
  wallets: WalletAccount[];
  walletTransactions: WalletTransaction[];
  refunds: Refund[];
  shippingMethods: ShippingMethod[];
  returnShipments: ReturnShipment[];
}

const DB_PATH = path.resolve(process.cwd(), 'data', 'ecommerce_db.json');

export class JsonDB {
  private static instance: JsonDB;
  private data: DatabaseSchema;

  private constructor() {
    this.data = this.loadData();
  }

  public static getInstance(): JsonDB {
    if (!JsonDB.instance) {
      JsonDB.instance = new JsonDB();
    }
    return JsonDB.instance;
  }

  private loadData(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('Could not read existing database file, initializing empty state.', err);
    }
    return this.getInitialSchema();
  }

  public save(): void {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  public get db(): DatabaseSchema {
    return this.data;
  }

  public resetToSeed(seedData?: DatabaseSchema): void {
    this.data = seedData || this.getInitialSchema();
    this.save();
  }

  private getInitialSchema(): DatabaseSchema {
    return {
      users: [],
      addresses: [],
      stores: [],
      storePolicies: [],
      storeCatalogMappings: [],
      categories: [],
      products: [],
      carts: [],
      coupons: [],
      orders: [],
      paymentTransactions: [],
      wallets: [],
      walletTransactions: [],
      refunds: [],
      shippingMethods: [],
      returnShipments: []
    };
  }
}
