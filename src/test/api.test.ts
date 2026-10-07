import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../app';

let server: http.Server;
let baseUrl: string;

test.before(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address() as any;
      baseUrl = `http://localhost:${address.port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('1. Member Domain: Register, Login and Fetch Profile', async () => {
  // Register
  const regRes = await fetch(`${baseUrl}/api/v1/members/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alice@test.com',
      password: 'Password@123',
      fullName: 'Alice Smith',
      entitlementTier: 'VIP'
    })
  });
  const regData = await regRes.json();
  assert.equal(regRes.status, 201);
  assert.equal(regData.success, true);
  assert.ok(regData.data.token);

  const token = regData.data.token;

  // Profile
  const profRes = await fetch(`${baseUrl}/api/v1/members/profile`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const profData = await profRes.json();
  assert.equal(profRes.status, 200);
  assert.equal(profData.data.email, 'alice@test.com');
  assert.equal(profData.data.entitlementTier, 'VIP');
  assert.equal(profData.data.wallet.balance, 50.0);
});

test('2. Store Domain: List Stores & Policies', async () => {
  const res = await fetch(`${baseUrl}/api/v1/stores`);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.ok(data.data.length > 0);
  assert.equal(data.data[0].id, 'STORE_MAIN');
});

test('3. Catalog Domain: Browse Products, Search & Upsell Associations', async () => {
  // Browse products
  const res = await fetch(`${baseUrl}/api/v1/catalog/products?search=Data-Intensive`);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.data.length, 1);
  assert.equal(data.data[0].isbn, '978-1449373320');

  // Product detail with Cross-sell & Up-sell
  const prodId = data.data[0].id;
  const detailRes = await fetch(`${baseUrl}/api/v1/catalog/products/${prodId}`);
  const detailData = await detailRes.json();
  assert.equal(detailRes.status, 200);
  assert.ok(detailData.data.crossSellAndUpSell.length > 0);

  // Recommendations
  const recRes = await fetch(`${baseUrl}/api/v1/catalog/recommendations`);
  const recData = await recRes.json();
  assert.equal(recRes.status, 200);
  assert.ok(recData.data.length > 0);
});

test('4. End-to-End Flow: Cart -> Apply Coupon -> Checkout -> Pay with Wallet -> Track -> Return', async () => {
  // Login user with wallet
  const loginRes = await fetch(`${baseUrl}/api/v1/members/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'john.doe@example.com',
      password: 'User@123'
    })
  });
  const loginData = await loginRes.json();
  const token = loginData.data.token;

  // Add book to cart
  const cartRes = await fetch(`${baseUrl}/api/v1/orders/cart/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      productId: 'prod_1',
      quantity: 1
    })
  });
  assert.equal(cartRes.status, 200);

  // Apply Coupon
  const couponRes = await fetch(`${baseUrl}/api/v1/orders/cart/apply-coupon`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      couponCode: 'WELCOME10',
      redeemPoints: 50 // $5 off
    })
  });
  const couponData = await couponRes.json();
  assert.equal(couponRes.status, 200);
  assert.ok(couponData.data.discountAmount > 0);

  // Checkout
  const checkoutRes = await fetch(`${baseUrl}/api/v1/orders/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      storeId: 'STORE_MAIN',
      shippingMethodTier: 'STANDARD',
      shippingAddress: {
        street: '123 Market St',
        city: 'San Francisco',
        postalCode: '94103',
        country: 'USA'
      },
      billingAddress: {
        street: '123 Market St',
        city: 'San Francisco',
        postalCode: '94103',
        country: 'USA'
      }
    })
  });
  const checkoutData = await checkoutRes.json();
  assert.equal(checkoutRes.status, 201);
  const orderId = checkoutData.data.id;
  const trackingNumber = checkoutData.data.trackingNumber;

  // Process Payment via Wallet
  const payRes = await fetch(`${baseUrl}/api/v1/payments/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      orderId,
      paymentMethod: 'WALLET'
    })
  });
  const payData = await payRes.json();
  assert.equal(payRes.status, 200);
  assert.equal(payData.data.orderStatus, 'CONFIRMED');

  // Track Shipment
  const trackRes = await fetch(`${baseUrl}/api/v1/shipping/track/${trackingNumber}`);
  const trackData = await trackRes.json();
  assert.equal(trackRes.status, 200);
  assert.equal(trackData.trackingNumber, trackingNumber);

  // Initiate Return
  const returnRes = await fetch(`${baseUrl}/api/v1/orders/${orderId}/return`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      reason: 'Read finished, initiating return'
    })
  });
  const returnData = await returnRes.json();
  assert.equal(returnRes.status, 200);
  assert.equal(returnData.data.order.status, 'RETURN_REQUESTED');
});
