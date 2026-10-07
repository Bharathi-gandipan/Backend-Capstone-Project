import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { memberRouter } from './services/member.service';
import { storeRouter } from './services/store.service';
import { catalogRouter } from './services/catalog.service';
import { orderRouter } from './services/order.service';
import { paymentRouter } from './services/payment.service';
import { shippingRouter } from './services/shipping.service';
import { initializeSeedData } from './db/seed';

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Initialize Seed Data
  initializeSeedData();

  // Root Health & System Info
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'Bookstore E-Commerce Platform API',
      version: '1.0.0',
      status: 'ONLINE',
      domains: [
        { domain: 'Member & Identity', path: '/api/v1/members' },
        { domain: 'Store & Policy', path: '/api/v1/stores' },
        { domain: 'Catalog & Merchandising', path: '/api/v1/catalog' },
        { domain: 'Cart & Orders', path: '/api/v1/orders' },
        { domain: 'Payment & Wallet', path: '/api/v1/payments' },
        { domain: 'Shipping & Logistics', path: '/api/v1/shipping' }
      ],
      documentation: '/api/docs'
    });
  });

  // API Documentation specification endpoint
  app.get('/api/docs', (_req: Request, res: Response) => {
    res.json({
      openapi: '3.0.0',
      info: {
        title: 'Bookstore E-Commerce Backend API',
        version: '1.0.0',
        description: 'Complete RESTful API specifications implementing the 6 architectural domains.'
      },
      domains: {
        Member: [
          'POST /api/v1/members/register - User registration',
          'POST /api/v1/members/login - User authentication',
          'GET  /api/v1/members/profile - Get current profile (Auth)',
          'PUT  /api/v1/members/profile - Update profile details (Auth)',
          'POST /api/v1/members/addresses - Add user address (Auth)',
          'GET  /api/v1/members/addresses - List addresses (Auth)'
        ],
        Store: [
          'GET  /api/v1/stores - List all stores',
          'GET  /api/v1/stores/:id - Store details & policies',
          'POST /api/v1/stores - Create new store (Admin)',
          'PUT  /api/v1/stores/:id/policies - Update store policies (Admin)',
          'POST /api/v1/stores/:id/catalogs - Map catalog to store (Admin)'
        ],
        Catalog: [
          'GET  /api/v1/catalog/categories - List categories',
          'POST /api/v1/catalog/categories - Create category (Admin/Catalog Mgr)',
          'GET  /api/v1/catalog/products - Browse/Search books with multi-faceted filtering & entitlement',
          'GET  /api/v1/catalog/products/:id - Product detail with Cross-sell & Up-sell',
          'GET  /api/v1/catalog/recommendations - Personalized recommendations based on history',
          'POST /api/v1/catalog/products - Create new product (Admin/Catalog Mgr)'
        ],
        Order: [
          'GET  /api/v1/orders/cart - Get active cart for user or guest',
          'POST /api/v1/orders/cart/items - Add/update/remove items in cart',
          'POST /api/v1/orders/cart/merge - Merge guest cart into authenticated user cart',
          'POST /api/v1/orders/cart/apply-coupon - Apply discount coupons & redeem gift points',
          'POST /api/v1/orders/checkout - Process checkout & reserve inventory',
          'GET  /api/v1/orders/history - Registered user order history (Auth)',
          'GET  /api/v1/orders/:id - Order details',
          'POST /api/v1/orders/:id/cancel - Cancel pending/confirmed order',
          'POST /api/v1/orders/:id/return - Request return for order'
        ],
        Payment: [
          'POST /api/v1/payments/process - Process payment (Card/Wallet/Gateway)',
          'POST /api/v1/payments/refund - Process refund to source or wallet',
          'GET  /api/v1/payments/wallet - Get wallet balance and transaction ledger (Auth)',
          'POST /api/v1/payments/wallet/topup - Top up wallet balance (Auth)'
        ],
        Shipping: [
          'GET  /api/v1/shipping/methods - List shipping tiers & rates',
          'POST /api/v1/shipping/calculate-rates - Dynamic shipping rate & EDD calculation',
          'GET  /api/v1/shipping/track/:trackingNumber - Real-time tracking for forward and return shipments',
          'POST /api/v1/shipping/returns - Generate return label and initiate return transit'
        ]
      }
    });
  });

  // Mount Domain Services
  app.use('/api/v1/members', memberRouter);
  app.use('/api/v1/stores', storeRouter);
  app.use('/api/v1/catalog', catalogRouter);
  app.use('/api/v1/orders', orderRouter);
  app.use('/api/v1/payments', paymentRouter);
  app.use('/api/v1/shipping', shippingRouter);

  return app;
}
