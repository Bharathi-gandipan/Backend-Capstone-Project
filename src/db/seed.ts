import bcrypt from 'bcryptjs';
import { DatabaseSchema, JsonDB } from '../db';

export function initializeSeedData(): void {
  const dbInstance = JsonDB.getInstance();
  const currentDb = dbInstance.db;

  if (currentDb.products && currentDb.products.length > 0) {
    return; // Already initialized
  }

  const adminPass = bcrypt.hashSync('Admin@123', 10);
  const userPass = bcrypt.hashSync('User@123', 10);

  const seed: DatabaseSchema = {
    users: [
      {
        id: 'usr_admin',
        email: 'admin@bookstore.com',
        passwordHash: adminPass,
        fullName: 'Store Administrator',
        role: 'STORE_ADMIN',
        entitlementTier: 'VIP',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'usr_catalog',
        email: 'catalog@bookstore.com',
        passwordHash: adminPass,
        fullName: 'Catalog Manager',
        role: 'CATALOG_MANAGER',
        entitlementTier: 'STANDARD',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'usr_john',
        email: 'john.doe@example.com',
        passwordHash: userPass,
        fullName: 'John Doe',
        role: 'CUSTOMER',
        entitlementTier: 'VIP',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    addresses: [
      {
        id: 'addr_1',
        userId: 'usr_john',
        type: 'SHIPPING',
        fullName: 'John Doe',
        street: '123 Market St, Suite 400',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94103',
        country: 'USA',
        phone: '+1-555-0199',
        isDefault: true
      },
      {
        id: 'addr_2',
        userId: 'usr_john',
        type: 'BILLING',
        fullName: 'John Doe',
        street: '123 Market St, Suite 400',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94103',
        country: 'USA',
        phone: '+1-555-0199',
        isDefault: true
      }
    ],
    stores: [
      {
        id: 'STORE_MAIN',
        name: 'Grand Central Bookstore',
        code: 'GCB-US',
        currency: 'USD',
        locale: 'en-US',
        supportEmail: 'support@grandcentralbooks.com',
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      }
    ],
    storePolicies: [
      {
        id: 'pol_1',
        storeId: 'STORE_MAIN',
        returnWindowDays: 14,
        cancellationWindowHours: 24,
        freeShippingThreshold: 50,
        taxRatePercent: 8,
        allowGuestCheckout: true
      }
    ],
    storeCatalogMappings: [
      {
        id: 'map_1',
        storeId: 'STORE_MAIN',
        catalogId: 'cat_master',
        isPrimary: true
      }
    ],
    categories: [
      { id: 'cat_tech', name: 'Software Architecture & Tech', slug: 'tech', description: 'System design, engineering, cloud computing' },
      { id: 'cat_sci', name: 'Science Fiction & Fantasy', slug: 'sci-fi', description: 'Futuristic epics, space operas, fantasy adventures' },
      { id: 'cat_business', name: 'Business & Management', slug: 'business', description: 'Leadership, product management, strategy' }
    ],
    products: [
      {
        id: 'prod_1',
        catalogId: 'cat_master',
        title: 'Designing Data-Intensive Applications',
        isbn: '978-1449373320',
        author: 'Martin Kleppmann',
        publisher: "O'Reilly Media",
        publicationYear: 2017,
        format: 'HARDCOVER',
        categoryId: 'cat_tech',
        price: 49.99,
        currency: 'USD',
        stockQuantity: 45,
        rating: 4.9,
        description: 'The definitive guide to distributed data systems, reliability, scalability, and maintainability.',
        imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c',
        entitlementAccess: 'ALL',
        relatedProductIds: ['prod_2', 'prod_4'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'prod_2',
        catalogId: 'cat_master',
        title: 'Building Microservices: Designing Fine-Grained Systems',
        isbn: '978-1492034025',
        author: 'Sam Newman',
        publisher: "O'Reilly Media",
        publicationYear: 2021,
        format: 'PAPERBACK',
        categoryId: 'cat_tech',
        price: 42.50,
        currency: 'USD',
        stockQuantity: 30,
        rating: 4.8,
        description: 'Comprehensive guide to distributed systems architecture, event-driven design, and microservices.',
        imageUrl: 'https://images.unsplash.com/photo-1532012164546-f432f2e37b29',
        entitlementAccess: 'ALL',
        relatedProductIds: ['prod_1'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'prod_3',
        catalogId: 'cat_master',
        title: 'Dune: Collector Deluxe Edition',
        isbn: '978-0441013593',
        author: 'Frank Herbert',
        publisher: 'Ace Books',
        publicationYear: 2019,
        format: 'HARDCOVER',
        categoryId: 'cat_sci',
        price: 35.00,
        currency: 'USD',
        stockQuantity: 20,
        rating: 4.9,
        description: 'Frank Herbert’s masterpiece—a triumph of the imagination and one of the bestselling science fiction novels of all time.',
        imageUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794',
        entitlementAccess: 'ALL',
        relatedProductIds: ['prod_4'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'prod_4',
        catalogId: 'cat_master',
        title: 'Project Hail Mary',
        isbn: '978-0593135204',
        author: 'Andy Weir',
        publisher: 'Ballantine Books',
        publicationYear: 2021,
        format: 'HARDCOVER',
        categoryId: 'cat_sci',
        price: 28.99,
        currency: 'USD',
        stockQuantity: 50,
        rating: 4.9,
        description: 'A lone astronaut must save the earth from disaster in this incredible new science-based thriller.',
        imageUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f',
        entitlementAccess: 'ALL',
        relatedProductIds: ['prod_3'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'prod_5',
        catalogId: 'cat_master',
        title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
        isbn: '978-0132350884',
        author: 'Robert C. Martin',
        publisher: 'Prentice Hall',
        publicationYear: 2008,
        format: 'PAPERBACK',
        categoryId: 'cat_tech',
        price: 39.99,
        currency: 'USD',
        stockQuantity: 60,
        rating: 4.7,
        description: 'Even bad code can function. But if code isn’t clean, it can bring a development organization to its knees.',
        imageUrl: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353',
        entitlementAccess: 'ALL',
        relatedProductIds: ['prod_1', 'prod_2'],
        createdAt: new Date().toISOString()
      }
    ],
    carts: [],
    coupons: [
      {
        code: 'WELCOME10',
        discountType: 'PERCENT',
        discountValue: 10,
        minOrderValue: 30,
        expiryDate: '2028-12-31',
        isActive: true
      },
      {
        code: 'FLAT15',
        discountType: 'FLAT',
        discountValue: 15,
        minOrderValue: 60,
        expiryDate: '2028-12-31',
        isActive: true
      }
    ],
    orders: [],
    paymentTransactions: [],
    wallets: [
      {
        userId: 'usr_john',
        balance: 150.00,
        giftPoints: 250,
        currency: 'USD',
        updatedAt: new Date().toISOString()
      }
    ],
    walletTransactions: [
      {
        id: 'wtx_1',
        userId: 'usr_john',
        type: 'CREDIT',
        amount: 150.00,
        balanceAfter: 150.00,
        referenceId: 'INIT',
        description: 'Welcome Account Credit',
        createdAt: new Date().toISOString()
      }
    ],
    refunds: [],
    shippingMethods: [
      {
        id: 'shp_std',
        name: 'Standard Ground Shipping',
        tier: 'STANDARD',
        baseRate: 4.99,
        perKgRate: 1.50,
        estimatedDaysMin: 3,
        estimatedDaysMax: 5
      },
      {
        id: 'shp_exp',
        name: 'Express Priority Air',
        tier: 'EXPRESS',
        baseRate: 14.99,
        perKgRate: 3.00,
        estimatedDaysMin: 1,
        estimatedDaysMax: 2
      },
      {
        id: 'shp_ovn',
        name: 'Overnight Guaranteed',
        tier: 'OVERNIGHT',
        baseRate: 24.99,
        perKgRate: 5.00,
        estimatedDaysMin: 1,
        estimatedDaysMax: 1
      }
    ],
    returnShipments: []
  };

  dbInstance.resetToSeed(seed);
}
