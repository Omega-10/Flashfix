import type { Store } from '@flashfix/shared';

export interface StoreEntity {
  id: string;
  slug?: string;
  name: string;
  address: string;
  city: string;
  lat: number | string;
  lng: number | string;
  phone?: string | null;
  openTime?: string;
  closeTime?: string;
  hours?: string;
  services: string[];
  rating: number;
  reviewCount: number;
  isActive: boolean;
  adminId?: string | null;
  createdAt?: Date;
}

export interface StoreRepository {
  listActiveStores(): Promise<StoreEntity[]>;
  findStoreById(id: string): Promise<StoreEntity | null>;
  createStore(data: StoreEntity): Promise<StoreEntity>;
  updateStore(id: string, updates: Partial<StoreEntity>): Promise<StoreEntity | null>;
  reset?(): void;
}

export class InMemoryStoreRepository implements StoreRepository {
  private stores = new Map<string, StoreEntity>();

  constructor() {
    this.seed();
  }

  public reset(): void {
    this.stores.clear();
    this.seed();
  }

  private seed(): void {
    const seedStores: StoreEntity[] = [
      {
        id: 'store-blr-01',
        slug: 'koramangala-hub',
        name: 'Flashfix Koramangala Hub',
        address: '80 Feet Rd, 4th Block, Koramangala, Bengaluru',
        city: 'Bengaluru',
        lat: 12.9352,
        lng: 77.6245,
        phone: '+91 80 4001 0001',
        hours: '09:00 - 21:00',
        services: ['Screen Replacement', 'Battery Service', 'Water Damage', 'Camera Repair'],
        rating: 4.85,
        reviewCount: 342,
        isActive: true,
        adminId: '00000000-0000-4000-a000-000000000002',
      },
      {
        id: 'store-blr-02',
        slug: 'indiranagar',
        name: 'Flashfix Indiranagar',
        address: '100 Feet Rd, Indiranagar, Bengaluru',
        city: 'Bengaluru',
        lat: 12.9784,
        lng: 77.6408,
        phone: '+91 80 4001 0002',
        hours: '09:00 - 21:00',
        services: ['Screen Replacement', 'Battery Service', 'Charging Port', 'Back Glass'],
        rating: 4.9,
        reviewCount: 512,
        isActive: true,
      },
      {
        id: 'store-blr-03',
        slug: 'whitefield',
        name: 'Flashfix Whitefield',
        address: 'ITPL Main Rd, Whitefield, Bengaluru',
        city: 'Bengaluru',
        lat: 12.9698,
        lng: 77.7499,
        phone: '+91 80 4001 0003',
        hours: '09:00 - 21:00',
        services: ['Screen Replacement', 'Battery Service', 'Logic Board Repair'],
        rating: 4.75,
        reviewCount: 220,
        isActive: true,
      },
      {
        id: 'store-blr-04',
        slug: 'jayanagar',
        name: 'Flashfix Jayanagar',
        address: '11th Main, 4th Block, Jayanagar, Bengaluru',
        city: 'Bengaluru',
        lat: 12.925,
        lng: 77.5938,
        phone: '+91 80 4001 0004',
        hours: '09:00 - 21:00',
        services: ['Screen Replacement', 'Battery Service', 'Speaker & Mic'],
        rating: 4.8,
        reviewCount: 189,
        isActive: true,
      },
      {
        id: 'store-blr-05',
        slug: 'malleshwaram',
        name: 'Flashfix Malleshwaram',
        address: 'Sampige Rd, Malleshwaram, Bengaluru',
        city: 'Bengaluru',
        lat: 13.0031,
        lng: 77.5643,
        phone: '+91 80 4001 0005',
        hours: '09:00 - 21:00',
        services: ['Screen Replacement', 'Battery Service', 'Diagnostic Check'],
        rating: 4.7,
        reviewCount: 145,
        isActive: true,
      },
    ];

    for (const s of seedStores) {
      this.stores.set(s.id, s);
    }
  }

  async listActiveStores(): Promise<StoreEntity[]> {
    return Array.from(this.stores.values()).filter((s) => s.isActive);
  }

  async findStoreById(id: string): Promise<StoreEntity | null> {
    return this.stores.get(id) || null;
  }

  async createStore(data: StoreEntity): Promise<StoreEntity> {
    this.stores.set(data.id, data);
    return data;
  }

  async updateStore(id: string, updates: Partial<StoreEntity>): Promise<StoreEntity | null> {
    const existing = this.stores.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.stores.set(id, updated);
    return updated;
  }
}

export const inMemoryStoreRepo = new InMemoryStoreRepository();

export function getStoreRepository(): StoreRepository {
  return inMemoryStoreRepo;
}
