// Shared product type — matches server mock
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
  color: string;
  image: string;
}
