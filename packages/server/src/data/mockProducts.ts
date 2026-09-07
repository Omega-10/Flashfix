export interface Product {
  id: string;
  name: string;
  brand: "Apple" | "Samsung" | "OnePlus" | "Google" | "Universal";
  category: "Case" | "Screen Guard" | "Charger" | "Cable" | "Stand" | "Earbud Case" | "Watch Band";
  compatibleWith: string[];
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  badge?: "New" | "Bestseller" | "Limited";
  description: string;
  color: string; // for 3D tint
  image: string; // placeholder slug
}

export const products: Product[] = [
  {
    id: "p001",
    name: "MagSafe Compatible Case — Frosted Obsidian",
    brand: "Apple",
    category: "Case",
    compatibleWith: ["iPhone 16 Pro", "iPhone 16 Pro Max"],
    price: 2499,
    originalPrice: 3299,
    rating: 4.9,
    reviews: 1203,
    badge: "Bestseller",
    description: "Military-grade drop protection with MagSafe precision. Frosted finish eliminates fingerprints.",
    color: "#1A1A1A",
    image: "case-obsidian",
  },
  {
    id: "p002",
    name: "Ceramic Shield Screen Guard",
    brand: "Apple",
    category: "Screen Guard",
    compatibleWith: ["iPhone 16", "iPhone 16 Plus", "iPhone 16 Pro", "iPhone 16 Pro Max"],
    price: 999,
    rating: 4.7,
    reviews: 892,
    badge: "New",
    description: "10x drop resistance, anti-scratch ceramic layer. Edge-to-edge coverage with case cutout precision.",
    color: "#E8E0D5",
    image: "screen-guard-ceramic",
  },
  {
    id: "p003",
    name: "S Series Armor Case — Midnight",
    brand: "Samsung",
    category: "Case",
    compatibleWith: ["Galaxy S25 Ultra", "Galaxy S25+"],
    price: 1999,
    originalPrice: 2799,
    rating: 4.8,
    reviews: 678,
    badge: "Bestseller",
    description: "Precision S-Pen slot preserved. Dual-layer TPU + polycarbonate shell with matte grip texture.",
    color: "#0D0D0D",
    image: "case-s-armor",
  },
  {
    id: "p004",
    name: "45W GaN Fast Charger",
    brand: "Universal",
    category: "Charger",
    compatibleWith: ["iPhone 16 series", "Galaxy S25 series", "All USB-C devices"],
    price: 1799,
    rating: 4.6,
    reviews: 2341,
    badge: "Bestseller",
    description: "GaN III technology. Charges iPhone 16 to 50% in 25 min. Compact — 40% smaller than Apple 30W.",
    color: "#F5F0EB",
    image: "charger-gan-45w",
  },
  {
    id: "p005",
    name: "AirPods Pro Case — Woven Amber",
    brand: "Apple",
    category: "Earbud Case",
    compatibleWith: ["AirPods Pro 2", "AirPods Pro 3"],
    price: 899,
    rating: 4.5,
    reviews: 445,
    badge: "New",
    description: "Premium woven microfiber exterior. Precise cutouts. Carabiner loop included.",
    color: "#F59E0B",
    image: "airpods-case-woven",
  },
  {
    id: "p006",
    name: "Galaxy Watch Band — Milanese Loop",
    brand: "Samsung",
    category: "Watch Band",
    compatibleWith: ["Galaxy Watch 7", "Galaxy Watch Ultra"],
    price: 1299,
    rating: 4.7,
    reviews: 312,
    description: "316L stainless steel mesh. Infinitely adjustable magnetic clasp. Brushed finish.",
    color: "#6B6460",
    image: "watch-band-milanese",
  },
  {
    id: "p007",
    name: "Braided USB-C to Lightning — 2m",
    brand: "Apple",
    category: "Cable",
    compatibleWith: ["All iPhone models", "MagSafe"],
    price: 699,
    rating: 4.4,
    reviews: 1890,
    description: "Nylon braided 2m. 60W fast charge. MFi certified. Tangle-resistant.",
    color: "#EA580C",
    image: "cable-braided",
  },
  {
    id: "p008",
    name: "Pixel 9 Pro Clear Case",
    brand: "Google",
    category: "Case",
    compatibleWith: ["Pixel 9 Pro", "Pixel 9 Pro XL"],
    price: 1599,
    rating: 4.6,
    reviews: 203,
    badge: "New",
    description: "Crystal clear to showcase Hazel/Obsidian finish. Anti-yellowing UV coating.",
    color: "#E8E0D5",
    image: "case-pixel-clear",
  },
];
