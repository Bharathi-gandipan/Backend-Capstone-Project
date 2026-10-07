import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { JsonDB, ReturnShipment } from '../db';
import { optionalAuthenticate } from '../middleware/auth';

export const shippingRouter = Router();
const dbInstance = JsonDB.getInstance();

// 1. Get Shipping Methods & Rates
shippingRouter.get('/methods', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: dbInstance.db.shippingMethods
  });
});

// 2. Calculate Shipping Rates & Approximate Delivery Time (EDD)
shippingRouter.post('/calculate-rates', (req: Request, res: Response) => {
  const { postalCode, country, weightKg, orderTotal } = req.body;
  if (!postalCode) {
    res.status(400).json({ success: false, error: 'postalCode is required' });
    return;
  }

  const weight = Number(weightKg) || 1.0;
  const total = Number(orderTotal) || 0;

  const calculatedRates = dbInstance.db.shippingMethods.map(method => {
    // Check if free shipping applies
    let rate = method.baseRate + (weight * method.perKgRate);
    if (total >= 50 && method.tier === 'STANDARD') {
      rate = 0.0;
    }

    const minDate = new Date();
    minDate.setDate(minDate.getDate() + method.estimatedDaysMin);

    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + method.estimatedDaysMax);

    return {
      methodId: method.id,
      name: method.name,
      tier: method.tier,
      calculatedRate: Number(rate.toFixed(2)),
      currency: 'USD',
      estimatedDeliveryRange: {
        minDays: method.estimatedDaysMin,
        maxDays: method.estimatedDaysMax,
        estimatedDeliveryStart: minDate.toISOString().split('T')[0],
        estimatedDeliveryEnd: maxDate.toISOString().split('T')[0]
      }
    };
  });

  res.json({
    success: true,
    destination: { postalCode, country: country || 'US' },
    rates: calculatedRates
  });
});

// 3. Track Shipment
shippingRouter.get('/track/:trackingNumber', (req: Request, res: Response) => {
  const { trackingNumber } = req.params;
  const order = dbInstance.db.orders.find(o => o.trackingNumber === trackingNumber);
  const returnRecord = dbInstance.db.returnShipments.find(r => r.returnTrackingNumber === trackingNumber);

  if (!order && !returnRecord) {
    res.status(404).json({ success: false, error: 'Tracking number not found' });
    return;
  }

  if (order) {
    res.json({
      success: true,
      type: 'FORWARD_FULFILLMENT',
      trackingNumber,
      orderId: order.id,
      status: order.status,
      estimatedDeliveryDate: order.estimatedDeliveryDate,
      carrier: 'FastLogistics Express',
      events: [
        { status: 'LABEL_CREATED', timestamp: order.createdAt, location: 'Central Warehouse' },
        { status: order.status, timestamp: order.updatedAt, location: 'In Transit' }
      ]
    });
    return;
  }

  if (returnRecord) {
    res.json({
      success: true,
      type: 'RETURN_LOGISTICS',
      trackingNumber,
      orderId: returnRecord.orderId,
      status: returnRecord.status,
      carrier: 'Return Logistics Partner',
      events: [
        { status: 'RETURN_LABEL_GENERATED', timestamp: returnRecord.createdAt, location: 'Customer Dropoff Point' },
        { status: returnRecord.status, timestamp: new Date().toISOString(), location: 'Fulfillment Hub' }
      ]
    });
  }
});

// 4. Return Shipment Management
shippingRouter.post('/returns', optionalAuthenticate, (req: Request, res: Response) => {
  const { orderId, reason } = req.body;
  if (!orderId) {
    res.status(400).json({ success: false, error: 'orderId is required' });
    return;
  }

  const order = dbInstance.db.orders.find(o => o.id === orderId);
  if (!order) {
    res.status(404).json({ success: false, error: 'Order not found' });
    return;
  }

  const returnShipment: ReturnShipment = {
    id: uuidv4(),
    orderId,
    userId: order.userId,
    reason: reason || 'Customer requested return',
    status: 'LABEL_GENERATED',
    returnTrackingNumber: `RET-${uuidv4().substring(0, 8).toUpperCase()}`,
    createdAt: new Date().toISOString()
  };

  dbInstance.db.returnShipments.push(returnShipment);
  order.status = 'RETURN_REQUESTED';
  order.updatedAt = new Date().toISOString();

  dbInstance.save();

  res.status(201).json({
    success: true,
    message: 'Return shipment initiated and label created',
    data: returnShipment
  });
});
