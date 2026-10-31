import { Router, Request, Response, NextFunction } from 'express';
import {
  CreateInventoryItemRequestSchema,
  UpdateInventoryItemRequestSchema,
} from '@flashfix/shared';
import { getInventoryRepository } from '../db/index.js';

const router = Router();

// 1. List inventory items (GET /inventory?storeId=...)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getInventoryRepository();
    const storeId = req.query.storeId as string | undefined;
    const items = await repo.listItems(storeId);

    return res.json({
      success: true,
      data: items,
    });
  } catch (err) {
    next(err);
  }
});

// 2. Get single inventory item (GET /inventory/:id)
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getInventoryRepository();
    const item = await repo.findItemById(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Inventory item not found' },
      });
    }

    return res.json({
      success: true,
      data: item,
    });
  } catch (err) {
    next(err);
  }
});

// 3. Create inventory item (POST /inventory)
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateInventoryItemRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid inventory item payload', details: parsed.error.format() },
      });
    }

    const repo = getInventoryRepository();
    const item = await repo.createItem({
      storeId: parsed.data.storeId,
      partName: parsed.data.partName,
      sku: parsed.data.sku || null,
      compatibleWith: parsed.data.compatibleWith,
      quantity: parsed.data.quantity,
      minThreshold: parsed.data.minThreshold,
      unitCostPaise: parsed.data.unitCostPaise || null,
    });

    return res.status(201).json({
      success: true,
      data: item,
    });
  } catch (err) {
    next(err);
  }
});

// 4. Update inventory item (PATCH /inventory/:id)
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = UpdateInventoryItemRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid update payload', details: parsed.error.format() },
      });
    }

    const repo = getInventoryRepository();
    const updated = await repo.updateItem(req.params.id, parsed.data);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Inventory item not found' },
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

// 5. Update stock quantity (PATCH /inventory/:id/stock)
router.patch('/:id/stock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { quantity, delta } = req.body;
    const repo = getInventoryRepository();

    let updated;
    if (typeof delta === 'number') {
      updated = await repo.adjustStock(req.params.id, delta);
    } else if (typeof quantity === 'number' && quantity >= 0) {
      updated = await repo.updateItem(req.params.id, { quantity });
    } else {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Either valid quantity or delta is required' },
      });
    }

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Inventory item not found' },
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

// 6. Deduct part quantity upon repair completion (POST /inventory/deduct)
router.post('/deduct', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemId, quantity } = req.body;
    const qtyToDeduct = typeof quantity === 'number' && quantity > 0 ? quantity : 1;

    if (!itemId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'itemId is required' },
      });
    }

    const repo = getInventoryRepository();
    const updated = await repo.adjustStock(itemId, -qtyToDeduct);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Inventory item not found' },
      });
    }

    return res.json({
      success: true,
      message: `Deducted ${qtyToDeduct} unit(s) from inventory`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
