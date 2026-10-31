import { Router, Request, Response, NextFunction } from 'express';
import {
  NearbyStoresQuerySchema,
  haversineKm,
  getRadiusTier,
  calculateEstimatedMinutes,
  StoreSchema,
} from '@flashfix/shared';
import { getStoreRepository } from '../db/index.js';

const router = Router();

// 1. Nearby Stores Query (GET /stores/nearby?lat=...&lng=...)
router.get('/nearby', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = NearbyStoresQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid lat and lng query parameters required', details: parsed.error.format() },
      });
    }

    const userLat = parsed.data.lat;
    const userLng = parsed.data.lng;

    const repo = getStoreRepository();
    const allStores = await repo.listActiveStores();

    const nearbyStores = allStores.map((store) => {
      // Parse numeric coordinates with parseFloat() to handle Postgres numeric string representation
      const storeLat = typeof store.lat === 'string' ? parseFloat(store.lat) : store.lat;
      const storeLng = typeof store.lng === 'string' ? parseFloat(store.lng) : store.lng;

      const distanceKm = haversineKm(userLat, userLng, storeLat, storeLng);
      const tier = getRadiusTier(distanceKm);
      const isFlashHero = tier === 'flash';
      const estimatedPickupMinutes =
        tier === 'flash'
          ? Math.round(15 + distanceKm * 3) // ~15-24 minutes
          : tier === 'next-day'
          ? 120
          : null;

      return {
        ...store,
        lat: storeLat,
        lng: storeLng,
        distanceKm,
        tier,
        isFlashHero,
        estimatedPickupMinutes,
      };
    });

    // Sort ascending by distance
    nearbyStores.sort((a, b) => a.distanceKm - b.distanceKm);

    return res.json({
      success: true,
      data: nearbyStores,
    });
  } catch (err) {
    next(err);
  }
});

// 2. List All Active Stores (GET /stores)
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getStoreRepository();
    const stores = await repo.listActiveStores();
    const sanitized = stores.map((s) => ({
      ...s,
      lat: typeof s.lat === 'string' ? parseFloat(s.lat) : s.lat,
      lng: typeof s.lng === 'string' ? parseFloat(s.lng) : s.lng,
    }));

    return res.json({
      success: true,
      data: sanitized,
    });
  } catch (err) {
    next(err);
  }
});

// 3. Get Store Details (GET /stores/:id)
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getStoreRepository();
    const store = await repo.findStoreById(req.params.id);
    if (!store) {
      return res.status(404).json({
        success: false,
        error: { code: 'STORE_NOT_FOUND', message: 'Store not found' },
      });
    }

    return res.json({
      success: true,
      data: {
        ...store,
        lat: typeof store.lat === 'string' ? parseFloat(store.lat) : store.lat,
        lng: typeof store.lng === 'string' ? parseFloat(store.lng) : store.lng,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 4. Create Store (POST /stores)
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = StoreSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid store payload', details: parsed.error.format() },
      });
    }

    const repo = getStoreRepository();
    const store = await repo.createStore(parsed.data as any);

    return res.status(201).json({
      success: true,
      data: store,
    });
  } catch (err) {
    next(err);
  }
});

// 5. Update Store (PATCH /stores/:id)
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getStoreRepository();
    const updated = await repo.updateStore(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { code: 'STORE_NOT_FOUND', message: 'Store not found' },
      });
    }

    return res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
