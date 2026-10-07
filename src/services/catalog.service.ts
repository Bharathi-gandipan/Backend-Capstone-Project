import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { JsonDB, Product, Category } from '../db';
import { authenticate, authorizeRoles, optionalAuthenticate } from '../middleware/auth';

export const catalogRouter = Router();
const dbInstance = JsonDB.getInstance();

// 1. Get Categories
catalogRouter.get('/categories', (_req: Request, res: Response) => {
  res.json({ success: true, data: dbInstance.db.categories });
});

// 2. Add Category (Admin / Catalog Manager)
catalogRouter.post('/categories', authenticate, authorizeRoles('CATALOG_MANAGER', 'STORE_ADMIN'), (req: Request, res: Response) => {
  const { name, slug, description, parentId } = req.body;
  if (!name || !slug) {
    res.status(400).json({ success: false, error: 'Name and slug are required' });
    return;
  }

  const category: Category = {
    id: uuidv4(),
    name,
    slug,
    description: description || '',
    parentId
  };

  dbInstance.db.categories.push(category);
  dbInstance.save();

  res.status(201).json({ success: true, message: 'Category created', data: category });
});

// 3. Browse / Search Products with Entitlement, Category, Brand/Author, Price Faceting
catalogRouter.get('/products', optionalAuthenticate, (req: Request, res: Response) => {
  const {
    categoryId,
    author,
    publisher,
    format,
    minPrice,
    maxPrice,
    search,
    catalogId,
    sortBy
  } = req.query;

  const userTier = req.user?.entitlementTier || 'STANDARD';

  let products = dbInstance.db.products.filter(p => {
    // Entitlement filter
    if (p.entitlementAccess === 'VIP_ONLY' && userTier !== 'VIP') {
      return false;
    }
    if (p.entitlementAccess === 'STUDENT_ONLY' && userTier !== 'STUDENT') {
      return false;
    }

    if (catalogId && p.catalogId !== catalogId) return false;
    if (categoryId && p.categoryId !== categoryId) return false;
    if (author && !p.author.toLowerCase().includes(String(author).toLowerCase())) return false;
    if (publisher && !p.publisher.toLowerCase().includes(String(publisher).toLowerCase())) return false;
    if (format && p.format !== format) return false;
    if (minPrice && p.price < Number(minPrice)) return false;
    if (maxPrice && p.price > Number(maxPrice)) return false;
    if (search) {
      const q = String(search).toLowerCase();
      const match = p.title.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        p.isbn.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Sorting
  if (sortBy === 'price_asc') {
    products.sort((a, b) => a.price - b.price);
  } else if (sortBy === 'price_desc') {
    products.sort((a, b) => b.price - a.price);
  } else if (sortBy === 'rating') {
    products.sort((a, b) => b.rating - a.rating);
  } else {
    // Default newest
    products.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Calculate dynamic facets
  const authors = Array.from(new Set(products.map(p => p.author)));
  const formats = Array.from(new Set(products.map(p => p.format)));

  res.json({
    success: true,
    total: products.length,
    facets: { authors, formats },
    data: products
  });
});

// 4. Get Product Details with Cross-Sell & Up-Sell associations
catalogRouter.get('/products/:id', optionalAuthenticate, (req: Request, res: Response) => {
  const product = dbInstance.db.products.find(p => p.id === req.params.id);
  if (!product) {
    res.status(404).json({ success: false, error: 'Product not found' });
    return;
  }

  // Cross-sell & Up-sell products
  const relatedProducts = dbInstance.db.products.filter(p =>
    product.relatedProductIds?.includes(p.id) ||
    (p.categoryId === product.categoryId && p.id !== product.id)
  ).slice(0, 4);

  res.json({
    success: true,
    data: {
      ...product,
      crossSellAndUpSell: relatedProducts
    }
  });
});

// 5. Recommended Products based on User Order History & Preferences
catalogRouter.get('/recommendations', optionalAuthenticate, (req: Request, res: Response) => {
  const userId = req.user?.userId;
  let recommendedCategoryIds: string[] = [];

  if (userId) {
    const userOrders = dbInstance.db.orders.filter(o => o.userId === userId);
    const purchasedProductIds = userOrders.flatMap(o => o.items.map(i => i.productId));
    const purchasedProducts = dbInstance.db.products.filter(p => purchasedProductIds.includes(p.id));
    recommendedCategoryIds = Array.from(new Set(purchasedProducts.map(p => p.categoryId)));
  }

  let recommended = dbInstance.db.products.filter(p => {
    if (recommendedCategoryIds.length > 0) {
      return recommendedCategoryIds.includes(p.categoryId);
    }
    // Default fallback: highest rated products
    return p.rating >= 4.5;
  }).slice(0, 6);

  if (recommended.length === 0) {
    recommended = dbInstance.db.products.slice(0, 6);
  }

  res.json({
    success: true,
    context: userId ? 'PERSONALIZED_HISTORY' : 'TRENDING_TOP_RATED',
    data: recommended
  });
});

// 6. Create Product (Catalog Manager / Admin)
catalogRouter.post('/products', authenticate, authorizeRoles('CATALOG_MANAGER', 'STORE_ADMIN'), (req: Request, res: Response) => {
  const {
    title, isbn, author, publisher, publicationYear,
    format, categoryId, price, stockQuantity, rating,
    description, imageUrl, entitlementAccess, relatedProductIds, catalogId
  } = req.body;

  if (!title || !isbn || !author || price === undefined) {
    res.status(400).json({ success: false, error: 'Title, ISBN, Author, and Price are required' });
    return;
  }

  const newProduct: Product = {
    id: uuidv4(),
    catalogId: catalogId || 'cat_default',
    title,
    isbn,
    author,
    publisher: publisher || 'Global Publishing',
    publicationYear: publicationYear || new Date().getFullYear(),
    format: format || 'PAPERBACK',
    categoryId: categoryId || 'cat_general',
    price: Number(price),
    currency: 'USD',
    stockQuantity: stockQuantity !== undefined ? Number(stockQuantity) : 100,
    rating: rating !== undefined ? Number(rating) : 4.5,
    description: description || '',
    imageUrl: imageUrl || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f',
    entitlementAccess: entitlementAccess || 'ALL',
    relatedProductIds: relatedProductIds || [],
    createdAt: new Date().toISOString()
  };

  dbInstance.db.products.push(newProduct);
  dbInstance.save();

  res.status(201).json({ success: true, message: 'Product created successfully', data: newProduct });
});
