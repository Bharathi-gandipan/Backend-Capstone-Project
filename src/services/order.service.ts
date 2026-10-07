import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { JsonDB, Cart, Order, OrderItem, Address } from '../db';
import { authenticate, optionalAuthenticate } from '../middleware/auth';

export const orderRouter = Router();
const dbInstance = JsonDB.getInstance();

// Helper to get or create active cart
function getOrCreateCart(userId?: string, guestSessionId?: string): Cart {
  let cart: Cart | undefined;
  if (userId) {
    cart = dbInstance.db.carts.find(c => c.userId === userId);
  } else if (guestSessionId) {
    cart = dbInstance.db.carts.find(c => c.guestSessionId === guestSessionId);
  }

  if (!cart) {
    cart = {
      id: uuidv4(),
      userId,
      guestSessionId: userId ? undefined : (guestSessionId || uuidv4()),
      items: [],
      discountAmount: 0,
      redeemedGiftPoints: 0,
      updatedAt: new Date().toISOString()
    };
    dbInstance.db.carts.push(cart);
    dbInstance.save();
  }
  return cart;
}

// 1. Get Current Cart
orderRouter.get('/cart', optionalAuthenticate, (req: Request, res: Response) => {
  const guestSessionId = req.headers['x-guest-session-id'] as string;
  const cart = getOrCreateCart(req.user?.userId, guestSessionId);

  // Compute pricing breakdown
  const enrichedItems = cart.items.map(item => {
    const product = dbInstance.db.products.find(p => p.id === item.productId);
    return {
      ...item,
      product: product ? {
        id: product.id,
        title: product.title,
        isbn: product.isbn,
        author: product.author,
        imageUrl: product.imageUrl,
        stockQuantity: product.stockQuantity
      } : null
    };
  });

  const subtotal = cart.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const total = Math.max(0, subtotal - cart.discountAmount - (cart.redeemedGiftPoints * 0.1)); // 10 points = $1

  res.json({
    success: true,
    data: {
      ...cart,
      items: enrichedItems,
      subtotal,
      total
    }
  });
});

// 2. Add / Update Cart Item
orderRouter.post('/cart/items', optionalAuthenticate, (req: Request, res: Response) => {
  const { productId, quantity } = req.body;
  const guestSessionId = req.headers['x-guest-session-id'] as string;
  const product = dbInstance.db.products.find(p => p.id === productId);

  if (!product) {
    res.status(404).json({ success: false, error: 'Product not found' });
    return;
  }

  const cart = getOrCreateCart(req.user?.userId, guestSessionId);
  const existingItemIndex = cart.items.findIndex(i => i.productId === productId);

  const parsedQty = Number(quantity);
  if (parsedQty <= 0) {
    if (existingItemIndex > -1) {
      cart.items.splice(existingItemIndex, 1);
    }
  } else {
    if (existingItemIndex > -1) {
      cart.items[existingItemIndex].quantity = parsedQty;
      cart.items[existingItemIndex].unitPrice = product.price;
    } else {
      cart.items.push({
        productId: product.id,
        quantity: parsedQty,
        unitPrice: product.price
      });
    }
  }

  cart.updatedAt = new Date().toISOString();
  dbInstance.save();

  res.json({ success: true, message: 'Cart updated', data: cart });
});

// 3. Merge Guest Cart to Registered User Cart upon Login
orderRouter.post('/cart/merge', authenticate, (req: Request, res: Response) => {
  const { guestSessionId } = req.body;
  if (!guestSessionId) {
    res.status(400).json({ success: false, error: 'guestSessionId is required' });
    return;
  }

  const guestCart = dbInstance.db.carts.find(c => c.guestSessionId === guestSessionId);
  const userCart = getOrCreateCart(req.user!.userId);

  if (guestCart && guestCart.items.length > 0) {
    guestCart.items.forEach(guestItem => {
      const idx = userCart.items.findIndex(i => i.productId === guestItem.productId);
      if (idx > -1) {
        userCart.items[idx].quantity += guestItem.quantity;
      } else {
        userCart.items.push({ ...guestItem });
      }
    });

    // Remove guest cart
    const guestIdx = dbInstance.db.carts.findIndex(c => c.guestSessionId === guestSessionId);
    if (guestIdx > -1) {
      dbInstance.db.carts.splice(guestIdx, 1);
    }
    dbInstance.save();
  }

  res.json({ success: true, message: 'Carts merged successfully', data: userCart });
});

// 4. Apply Coupon & Redeem Gift Points
orderRouter.post('/cart/apply-coupon', optionalAuthenticate, (req: Request, res: Response) => {
  const { couponCode, redeemPoints } = req.body;
  const guestSessionId = req.headers['x-guest-session-id'] as string;
  const cart = getOrCreateCart(req.user?.userId, guestSessionId);

  const subtotal = cart.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

  if (couponCode) {
    const coupon = dbInstance.db.coupons.find(c => c.code.toUpperCase() === couponCode.toUpperCase() && c.isActive);
    if (!coupon) {
      res.status(400).json({ success: false, error: 'Invalid or expired coupon code' });
      return;
    }
    if (subtotal < coupon.minOrderValue) {
      res.status(400).json({ success: false, error: `Minimum order value for ${couponCode} is $${coupon.minOrderValue}` });
      return;
    }

    cart.couponCode = coupon.code;
    cart.discountAmount = coupon.discountType === 'PERCENT'
      ? (subtotal * coupon.discountValue) / 100
      : coupon.discountValue;
  }

  if (redeemPoints !== undefined) {
    const points = Number(redeemPoints);
    if (req.user) {
      const wallet = dbInstance.db.wallets.find(w => w.userId === req.user!.userId);
      if (wallet && wallet.giftPoints >= points) {
        cart.redeemedGiftPoints = points;
      } else {
        res.status(400).json({ success: false, error: 'Insufficient gift points balance' });
        return;
      }
    } else {
      res.status(400).json({ success: false, error: 'Must be logged in to redeem gift points' });
      return;
    }
  }

  dbInstance.save();
  res.json({ success: true, message: 'Discounts and points applied', data: cart });
});

// 5. Checkout / Create Order
orderRouter.post('/checkout', optionalAuthenticate, (req: Request, res: Response) => {
  const { storeId, shippingAddress, billingAddress, guestEmail, shippingMethodTier } = req.body;
  const guestSessionId = req.headers['x-guest-session-id'] as string;
  const cart = getOrCreateCart(req.user?.userId, guestSessionId);

  if (cart.items.length === 0) {
    res.status(400).json({ success: false, error: 'Cannot checkout with an empty cart' });
    return;
  }

  if (!req.user && !guestEmail) {
    res.status(400).json({ success: false, error: 'guestEmail is required for guest checkout' });
    return;
  }

  if (!shippingAddress || !billingAddress) {
    res.status(400).json({ success: false, error: 'Shipping and Billing addresses are required' });
    return;
  }

  // Calculate pricing & inventory validation
  const orderItems: OrderItem[] = [];
  let subtotal = 0;

  for (const item of cart.items) {
    const product = dbInstance.db.products.find(p => p.id === item.productId);
    if (!product || product.stockQuantity < item.quantity) {
      res.status(400).json({ success: false, error: `Product ${product?.title || item.productId} is out of stock` });
      return;
    }
    // Deduct stock reservation
    product.stockQuantity -= item.quantity;

    const itemTotal = item.quantity * item.unitPrice;
    subtotal += itemTotal;
    orderItems.push({
      productId: product.id,
      title: product.title,
      isbn: product.isbn,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: itemTotal
    });
  }

  const shippingFee = (shippingMethodTier === 'EXPRESS' ? 15 : shippingMethodTier === 'OVERNIGHT' ? 25 : 5);
  const tax = subtotal * 0.08;
  const discount = cart.discountAmount || 0;
  const pointsRedeemedVal = (cart.redeemedGiftPoints || 0) * 0.1;
  const totalAmount = Math.max(0, subtotal - discount - pointsRedeemedVal + shippingFee + tax);

  const deliveryDays = (shippingMethodTier === 'OVERNIGHT' ? 1 : shippingMethodTier === 'EXPRESS' ? 2 : 5);
  const estDate = new Date();
  estDate.setDate(estDate.getDate() + deliveryDays);

  const order: Order = {
    id: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    storeId: storeId || 'STORE_MAIN',
    userId: req.user?.userId,
    guestEmail: req.user ? undefined : guestEmail,
    items: orderItems,
    subtotal,
    discount,
    giftPointsRedeemed: cart.redeemedGiftPoints || 0,
    shippingFee,
    tax,
    totalAmount: Number(totalAmount.toFixed(2)),
    shippingAddress,
    billingAddress,
    status: 'PENDING_PAYMENT',
    trackingNumber: `TRK-${uuidv4().substring(0, 8).toUpperCase()}`,
    estimatedDeliveryDate: estDate.toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  dbInstance.db.orders.push(order);

  // Clear cart items
  cart.items = [];
  cart.discountAmount = 0;
  cart.redeemedGiftPoints = 0;
  cart.couponCode = undefined;
  cart.updatedAt = new Date().toISOString();

  dbInstance.save();

  res.status(201).json({
    success: true,
    message: 'Order created successfully. Proceed to payment.',
    data: order
  });
});

// 6. Get Order History (Registered Users)
orderRouter.get('/history', authenticate, (req: Request, res: Response) => {
  const orders = dbInstance.db.orders.filter(o => o.userId === req.user!.userId);
  res.json({ success: true, data: orders });
});

// 7. Get Order By ID
orderRouter.get('/:id', optionalAuthenticate, (req: Request, res: Response) => {
  const order = dbInstance.db.orders.find(o => o.id === req.params.id);
  if (!order) {
    res.status(404).json({ success: false, error: 'Order not found' });
    return;
  }
  res.json({ success: true, data: order });
});

// 8. Cancel Order
orderRouter.post('/:id/cancel', optionalAuthenticate, (req: Request, res: Response) => {
  const order = dbInstance.db.orders.find(o => o.id === req.params.id);
  if (!order) {
    res.status(404).json({ success: false, error: 'Order not found' });
    return;
  }

  if (order.status === 'SHIPPED' || order.status === 'DELIVERED') {
    res.status(400).json({ success: false, error: 'Order cannot be cancelled as it is already shipped/delivered' });
    return;
  }

  order.status = 'CANCELLED';
  order.updatedAt = new Date().toISOString();

  // Restock items
  order.items.forEach(item => {
    const prod = dbInstance.db.products.find(p => p.id === item.productId);
    if (prod) prod.stockQuantity += item.quantity;
  });

  dbInstance.save();
  res.json({ success: true, message: 'Order cancelled successfully', data: order });
});

// 9. Request Return
orderRouter.post('/:id/return', optionalAuthenticate, (req: Request, res: Response) => {
  const { reason } = req.body;
  const order = dbInstance.db.orders.find(o => o.id === req.params.id);
  if (!order) {
    res.status(404).json({ success: false, error: 'Order not found' });
    return;
  }

  if (order.status !== 'DELIVERED' && order.status !== 'CONFIRMED' && order.status !== 'SHIPPED') {
    res.status(400).json({ success: false, error: 'Returns can only be requested for processed/delivered orders' });
    return;
  }

  order.status = 'RETURN_REQUESTED';
  order.updatedAt = new Date().toISOString();

  // Create return shipment record
  const returnRecord = {
    id: uuidv4(),
    orderId: order.id,
    userId: order.userId,
    reason: reason || 'Customer requested return',
    status: 'REQUESTED' as const,
    returnTrackingNumber: `RET-${uuidv4().substring(0, 8).toUpperCase()}`,
    createdAt: new Date().toISOString()
  };
  dbInstance.db.returnShipments.push(returnRecord);

  dbInstance.save();

  res.json({
    success: true,
    message: 'Return request submitted',
    data: {
      order,
      returnDetails: returnRecord
    }
  });
});
