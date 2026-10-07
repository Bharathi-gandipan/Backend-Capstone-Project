import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { JsonDB, User, Address } from '../db';
import { authenticate, JWT_SECRET, AuthUserPayload } from '../middleware/auth';

export const memberRouter = Router();
const dbInstance = JsonDB.getInstance();

// 1. Register
memberRouter.post('/register', (req: Request, res: Response) => {
  const { email, password, fullName, entitlementTier } = req.body;
  if (!email || !password || !fullName) {
    res.status(400).json({ success: false, error: 'Email, password, and fullName are required' });
    return;
  }

  const existing = dbInstance.db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    res.status(409).json({ success: false, error: 'User with this email already exists' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const newUser: User = {
    id: uuidv4(),
    email: email.toLowerCase(),
    passwordHash,
    fullName,
    role: 'CUSTOMER',
    entitlementTier: entitlementTier || 'STANDARD',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  dbInstance.db.users.push(newUser);

  // Initialize wallet for new user
  dbInstance.db.wallets.push({
    userId: newUser.id,
    balance: 50.0, // Welcome credit
    giftPoints: 100, // Welcome points
    currency: 'USD',
    updatedAt: new Date().toISOString()
  });

  dbInstance.save();

  const payload: AuthUserPayload = {
    userId: newUser.id,
    email: newUser.email,
    role: newUser.role,
    entitlementTier: newUser.entitlementTier
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
        entitlementTier: newUser.entitlementTier
      }
    }
  });
});

// 2. Login
memberRouter.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ success: false, error: 'Email and password are required' });
    return;
  }

  const user = dbInstance.db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    res.status(401).json({ success: false, error: 'Invalid email or password' });
    return;
  }

  const payload: AuthUserPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    entitlementTier: user.entitlementTier
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        entitlementTier: user.entitlementTier
      }
    }
  });
});

// 3. Get Current Profile
memberRouter.get('/profile', authenticate, (req: Request, res: Response) => {
  const user = dbInstance.db.users.find(u => u.id === req.user!.userId);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  const addresses = dbInstance.db.addresses.filter(a => a.userId === user.id);
  const wallet = dbInstance.db.wallets.find(w => w.userId === user.id);

  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      entitlementTier: user.entitlementTier,
      addresses,
      wallet: wallet || { balance: 0, giftPoints: 0, currency: 'USD' }
    }
  });
});

// 4. Update Profile
memberRouter.put('/profile', authenticate, (req: Request, res: Response) => {
  const user = dbInstance.db.users.find(u => u.id === req.user!.userId);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  const { fullName, entitlementTier } = req.body;
  if (fullName) user.fullName = fullName;
  if (entitlementTier) user.entitlementTier = entitlementTier;
  user.updatedAt = new Date().toISOString();

  dbInstance.save();

  res.json({
    success: true,
    message: 'Profile updated',
    data: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      entitlementTier: user.entitlementTier
    }
  });
});

// 5. Add Address
memberRouter.post('/addresses', authenticate, (req: Request, res: Response) => {
  const { type, fullName, street, city, state, postalCode, country, phone, isDefault } = req.body;
  if (!street || !city || !postalCode || !country) {
    res.status(400).json({ success: false, error: 'Street, city, postalCode, and country are required' });
    return;
  }

  if (isDefault) {
    dbInstance.db.addresses
      .filter(a => a.userId === req.user!.userId && a.type === type)
      .forEach(a => a.isDefault = false);
  }

  const newAddress: Address = {
    id: uuidv4(),
    userId: req.user!.userId,
    type: type || 'SHIPPING',
    fullName: fullName || req.user!.email,
    street,
    city,
    state: state || '',
    postalCode,
    country,
    phone: phone || '',
    isDefault: !!isDefault
  };

  dbInstance.db.addresses.push(newAddress);
  dbInstance.save();

  res.status(201).json({ success: true, message: 'Address added', data: newAddress });
});

// 6. Get Addresses
memberRouter.get('/addresses', authenticate, (req: Request, res: Response) => {
  const addresses = dbInstance.db.addresses.filter(a => a.userId === req.user!.userId);
  res.json({ success: true, data: addresses });
});
