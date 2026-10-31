import crypto from 'node:crypto';

export interface InventoryItemEntity {
  id: string;
  storeId: string;
  partName: string;
  sku?: string | null;
  compatibleWith: string[];
  quantity: number;
  minThreshold: number;
  unitCostPaise?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryRepository {
  listItems(storeId?: string): Promise<InventoryItemEntity[]>;
  findItemById(id: string): Promise<InventoryItemEntity | null>;
  createItem(item: Omit<InventoryItemEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<InventoryItemEntity>;
  updateItem(id: string, updates: Partial<InventoryItemEntity>): Promise<InventoryItemEntity | null>;
  adjustStock(id: string, delta: number): Promise<InventoryItemEntity | null>;
  reset?(): void;
}

export class InMemoryInventoryRepository implements InventoryRepository {
  private items = new Map<string, InventoryItemEntity>();

  constructor() {
    this.seed();
  }

  public reset(): void {
    this.items.clear();
    this.seed();
  }

  private seed(): void {
    const seedItems: InventoryItemEntity[] = [
      {
        id: 'inv-001',
        storeId: 'store-blr-01',
        partName: 'OLED Display Panel',
        sku: 'DISP-IP15P-01',
        compatibleWith: ['iPhone 15 Pro'],
        quantity: 12,
        minThreshold: 5,
        unitCostPaise: 850000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'inv-002',
        storeId: 'store-blr-01',
        partName: 'High Capacity Battery 4400mAh',
        sku: 'BATT-GS24-01',
        compatibleWith: ['Galaxy S24', 'Galaxy S24+'],
        quantity: 8,
        minThreshold: 4,
        unitCostPaise: 250000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'inv-003',
        storeId: 'store-blr-02',
        partName: 'USB-C Charging Flex Cable',
        sku: 'CHG-OP12-01',
        compatibleWith: ['OnePlus 12', 'OnePlus 12R'],
        quantity: 15,
        minThreshold: 3,
        unitCostPaise: 120000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const item of seedItems) {
      this.items.set(item.id, item);
    }
  }

  async listItems(storeId?: string): Promise<InventoryItemEntity[]> {
    let list = Array.from(this.items.values());
    if (storeId) {
      list = list.filter((i) => i.storeId === storeId);
    }
    return list;
  }

  async findItemById(id: string): Promise<InventoryItemEntity | null> {
    return this.items.get(id) || null;
  }

  async createItem(item: Omit<InventoryItemEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<InventoryItemEntity> {
    const record: InventoryItemEntity = {
      id: crypto.randomUUID(),
      ...item,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.items.set(record.id, record);
    return record;
  }

  async updateItem(id: string, updates: Partial<InventoryItemEntity>): Promise<InventoryItemEntity | null> {
    const existing = this.items.get(id);
    if (!existing) return null;
    const updated: InventoryItemEntity = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.items.set(id, updated);
    return updated;
  }

  async adjustStock(id: string, delta: number): Promise<InventoryItemEntity | null> {
    const existing = this.items.get(id);
    if (!existing) return null;
    const newQty = Math.max(0, existing.quantity + delta);
    const updated: InventoryItemEntity = {
      ...existing,
      quantity: newQty,
      updatedAt: new Date(),
    };
    this.items.set(id, updated);
    return updated;
  }
}

export const inMemoryInventoryRepo = new InMemoryInventoryRepository();

export function getInventoryRepository(): InventoryRepository {
  return inMemoryInventoryRepo;
}
