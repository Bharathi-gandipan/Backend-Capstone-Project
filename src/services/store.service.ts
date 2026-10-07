import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { JsonDB, Store, StorePolicy, StoreCatalogMapping } from '../db';
import { authenticate, authorizeRoles } from '../middleware/auth';

export const storeRouter = Router();
const dbInstance = JsonDB.getInstance();

// 1. Get All Stores
storeRouter.get('/', (_req: Request, res: Response) => {
  res.json({ success: true, data: dbInstance.db.stores });
});

// 2. Get Store by ID with its Policies and Catalogs
storeRouter.get('/:id', (req: Request, res: Response) => {
  const store = dbInstance.db.stores.find(s => s.id === req.params.id);
  if (!store) {
    res.status(404).json({ success: false, error: 'Store not found' });
    return;
  }

  const policies = dbInstance.db.storePolicies.find(p => p.storeId === store.id);
  const catalogMappings = dbInstance.db.storeCatalogMappings.filter(m => m.storeId === store.id);

  res.json({
    success: true,
    data: {
      ...store,
      policies: policies || {
        returnWindowDays: 14,
        cancellationWindowHours: 24,
        freeShippingThreshold: 50,
        taxRatePercent: 8,
        allowGuestCheckout: true
      },
      catalogMappings
    }
  });
});

// 3. Create Store (Admin only)
storeRouter.post('/', authenticate, authorizeRoles('STORE_ADMIN'), (req: Request, res: Response) => {
  const { name, code, currency, locale, supportEmail } = req.body;
  if (!name || !code) {
    res.status(400).json({ success: false, error: 'Store name and code are required' });
    return;
  }

  const newStore: Store = {
    id: uuidv4(),
    name,
    code: code.toUpperCase(),
    currency: currency || 'USD',
    locale: locale || 'en-US',
    supportEmail: supportEmail || `support@${code.toLowerCase()}.com`,
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  };

  dbInstance.db.stores.push(newStore);

  // Default policy
  const policy: StorePolicy = {
    id: uuidv4(),
    storeId: newStore.id,
    returnWindowDays: 14,
    cancellationWindowHours: 24,
    freeShippingThreshold: 50,
    taxRatePercent: 8,
    allowGuestCheckout: true
  };
  dbInstance.db.storePolicies.push(policy);

  dbInstance.save();

  res.status(201).json({ success: true, message: 'Store created successfully', data: newStore });
});

// 4. Update Store Policies (Admin only)
storeRouter.put('/:id/policies', authenticate, authorizeRoles('STORE_ADMIN'), (req: Request, res: Response) => {
  let policy = dbInstance.db.storePolicies.find(p => p.storeId === req.params.id);
  const { returnWindowDays, cancellationWindowHours, freeShippingThreshold, taxRatePercent, allowGuestCheckout } = req.body;

  if (!policy) {
    policy = {
      id: uuidv4(),
      storeId: req.params.id,
      returnWindowDays: returnWindowDays ?? 14,
      cancellationWindowHours: cancellationWindowHours ?? 24,
      freeShippingThreshold: freeShippingThreshold ?? 50,
      taxRatePercent: taxRatePercent ?? 8,
      allowGuestCheckout: allowGuestCheckout ?? true
    };
    dbInstance.db.storePolicies.push(policy);
  } else {
    if (returnWindowDays !== undefined) policy.returnWindowDays = returnWindowDays;
    if (cancellationWindowHours !== undefined) policy.cancellationWindowHours = cancellationWindowHours;
    if (freeShippingThreshold !== undefined) policy.freeShippingThreshold = freeShippingThreshold;
    if (taxRatePercent !== undefined) policy.taxRatePercent = taxRatePercent;
    if (allowGuestCheckout !== undefined) policy.allowGuestCheckout = allowGuestCheckout;
  }

  dbInstance.save();
  res.json({ success: true, message: 'Store policies updated', data: policy });
});

// 5. Map Catalog to Store (Admin only)
storeRouter.post('/:id/catalogs', authenticate, authorizeRoles('STORE_ADMIN'), (req: Request, res: Response) => {
  const { catalogId, isPrimary } = req.body;
  if (!catalogId) {
    res.status(400).json({ success: false, error: 'catalogId is required' });
    return;
  }

  const mapping: StoreCatalogMapping = {
    id: uuidv4(),
    storeId: req.params.id,
    catalogId,
    isPrimary: !!isPrimary
  };

  dbInstance.db.storeCatalogMappings.push(mapping);
  dbInstance.save();

  res.status(201).json({ success: true, message: 'Catalog mapped to store', data: mapping });
});
