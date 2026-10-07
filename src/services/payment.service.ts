import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { JsonDB, PaymentTransaction, Refund, WalletTransaction } from '../db';
import { authenticate, optionalAuthenticate } from '../middleware/auth';

export const paymentRouter = Router();
const dbInstance = JsonDB.getInstance();

// 1. Process Payment / Capture
paymentRouter.post('/process', optionalAuthenticate, (req: Request, res: Response) => {
  const { orderId, paymentMethod, cardDetails } = req.body;
  if (!orderId || !paymentMethod) {
    res.status(400).json({ success: false, error: 'orderId and paymentMethod are required' });
    return;
  }

  const order = dbInstance.db.orders.find(o => o.id === orderId);
  if (!order) {
    res.status(404).json({ success: false, error: 'Order not found' });
    return;
  }

  if (order.status !== 'PENDING_PAYMENT') {
    res.status(400).json({ success: false, error: `Order is not in pending payment state. Current: ${order.status}` });
    return;
  }

  // Handle Wallet Payment method
  if (paymentMethod === 'WALLET') {
    if (!req.user) {
      res.status(400).json({ success: false, error: 'Authentication required for wallet payment' });
      return;
    }
    const wallet = dbInstance.db.wallets.find(w => w.userId === req.user!.userId);
    if (!wallet || wallet.balance < order.totalAmount) {
      res.status(400).json({ success: false, error: 'Insufficient wallet balance' });
      return;
    }

    wallet.balance -= order.totalAmount;
    wallet.updatedAt = new Date().toISOString();

    const walletTx: WalletTransaction = {
      id: uuidv4(),
      userId: req.user.userId,
      type: 'DEBIT',
      amount: order.totalAmount,
      balanceAfter: wallet.balance,
      referenceId: order.id,
      description: `Payment for Order ${order.id}`,
      createdAt: new Date().toISOString()
    };
    dbInstance.db.walletTransactions.push(walletTx);
  }

  // Create Payment Transaction Record
  const gatewayTxId = `GTW-${uuidv4().substring(0, 12).toUpperCase()}`;
  const paymentTx: PaymentTransaction = {
    id: uuidv4(),
    orderId: order.id,
    userId: req.user?.userId,
    amount: order.totalAmount,
    currency: 'USD',
    paymentMethod,
    gatewayTransactionId: gatewayTxId,
    status: 'CAPTURED',
    createdAt: new Date().toISOString()
  };

  dbInstance.db.paymentTransactions.push(paymentTx);

  // Update order status
  order.status = 'CONFIRMED';
  order.paymentId = paymentTx.id;
  order.updatedAt = new Date().toISOString();

  // If registered user, earn loyalty points (1 point per dollar spent)
  if (req.user) {
    const wallet = dbInstance.db.wallets.find(w => w.userId === req.user!.userId);
    if (wallet) {
      const earnedPoints = Math.floor(order.totalAmount);
      wallet.giftPoints += earnedPoints;
      wallet.updatedAt = new Date().toISOString();

      dbInstance.db.walletTransactions.push({
        id: uuidv4(),
        userId: req.user.userId,
        type: 'POINTS_EARNED',
        amount: earnedPoints,
        balanceAfter: wallet.balance,
        referenceId: order.id,
        description: `Earned ${earnedPoints} gift points on Order ${order.id}`,
        createdAt: new Date().toISOString()
      });
    }
  }

  dbInstance.save();

  res.json({
    success: true,
    message: 'Payment processed and order confirmed',
    data: {
      transaction: paymentTx,
      orderStatus: order.status
    }
  });
});

// 2. Process Refund
paymentRouter.post('/refund', optionalAuthenticate, (req: Request, res: Response) => {
  const { orderId, amount, reason, refundMethod } = req.body;
  if (!orderId) {
    res.status(400).json({ success: false, error: 'orderId is required' });
    return;
  }

  const order = dbInstance.db.orders.find(o => o.id === orderId);
  if (!order) {
    res.status(404).json({ success: false, error: 'Order not found' });
    return;
  }

  const paymentTx = dbInstance.db.paymentTransactions.find(p => p.orderId === orderId && p.status === 'CAPTURED');
  if (!paymentTx) {
    res.status(400).json({ success: false, error: 'No captured payment found for this order' });
    return;
  }

  const refundAmount = amount ? Number(amount) : order.totalAmount;
  const method = refundMethod || (order.userId ? 'WALLET' : 'ORIGINAL_PAYMENT');

  // If refund to wallet
  if (method === 'WALLET' && order.userId) {
    const wallet = dbInstance.db.wallets.find(w => w.userId === order.userId);
    if (wallet) {
      wallet.balance += refundAmount;
      wallet.updatedAt = new Date().toISOString();

      dbInstance.db.walletTransactions.push({
        id: uuidv4(),
        userId: order.userId,
        type: 'REFUND',
        amount: refundAmount,
        balanceAfter: wallet.balance,
        referenceId: order.id,
        description: `Refund for Order ${order.id}`,
        createdAt: new Date().toISOString()
      });
    }
  }

  const refundRecord: Refund = {
    id: uuidv4(),
    orderId: order.id,
    paymentTransactionId: paymentTx.id,
    amount: refundAmount,
    reason: reason || 'Customer requested refund',
    refundMethod: method,
    status: 'PROCESSED',
    createdAt: new Date().toISOString()
  };

  paymentTx.status = 'REFUNDED';
  dbInstance.db.refunds.push(refundRecord);

  order.status = 'CANCELLED';
  order.updatedAt = new Date().toISOString();

  dbInstance.save();

  res.json({
    success: true,
    message: 'Refund processed successfully',
    data: refundRecord
  });
});

// 3. Get Wallet Balance & Ledger History
paymentRouter.get('/wallet', authenticate, (req: Request, res: Response) => {
  const wallet = dbInstance.db.wallets.find(w => w.userId === req.user!.userId);
  const transactions = dbInstance.db.walletTransactions.filter(t => t.userId === req.user!.userId);

  res.json({
    success: true,
    data: {
      wallet: wallet || { userId: req.user!.userId, balance: 0, giftPoints: 0, currency: 'USD' },
      transactions: transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
  });
});

// 4. Top-up Wallet Balance
paymentRouter.post('/wallet/topup', authenticate, (req: Request, res: Response) => {
  const { amount } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    res.status(400).json({ success: false, error: 'Valid positive topup amount is required' });
    return;
  }

  let wallet = dbInstance.db.wallets.find(w => w.userId === req.user!.userId);
  if (!wallet) {
    wallet = {
      userId: req.user!.userId,
      balance: 0,
      giftPoints: 0,
      currency: 'USD',
      updatedAt: new Date().toISOString()
    };
    dbInstance.db.wallets.push(wallet);
  }

  wallet.balance += numAmount;
  wallet.updatedAt = new Date().toISOString();

  const tx: WalletTransaction = {
    id: uuidv4(),
    userId: req.user!.userId,
    type: 'CREDIT',
    amount: numAmount,
    balanceAfter: wallet.balance,
    referenceId: `TOPUP-${Date.now()}`,
    description: `Wallet top-up of $${numAmount}`,
    createdAt: new Date().toISOString()
  };
  dbInstance.db.walletTransactions.push(tx);
  dbInstance.save();

  res.json({
    success: true,
    message: 'Wallet topped up successfully',
    data: {
      wallet,
      transaction: tx
    }
  });
});
