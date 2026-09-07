// Mock store data — replace with DB query in production
export interface Store {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  phone: string;
  hours: string;
  services: string[];
  rating: number;
  reviews: number;
}

export const stores: Store[] = [
  {
    id: "store-001",
    name: "Flashfix — Koramangala",
    address: "12th Main, 4th Block, Koramangala",
    city: "Bengaluru",
    lat: 12.9352,
    lng: 77.6245,
    phone: "+91 98765 43210",
    hours: "9 AM – 9 PM",
    services: ["Screen Replacement", "Battery Replacement", "Water Damage", "Charging Port", "Camera Fix", "Back Glass"],
    rating: 4.8,
    reviews: 342,
  },
  {
    id: "store-002",
    name: "Flashfix — Indiranagar",
    address: "100 Feet Road, CMH Road, Indiranagar",
    city: "Bengaluru",
    lat: 12.9784,
    lng: 77.6408,
    phone: "+91 98765 43211",
    hours: "10 AM – 8 PM",
    services: ["Screen Replacement", "Battery Replacement", "Charging Port", "Software Fix"],
    rating: 4.7,
    reviews: 218,
  },
  {
    id: "store-003",
    name: "Flashfix — HSR Layout",
    address: "Sector 2, HSR Layout",
    city: "Bengaluru",
    lat: 12.9116,
    lng: 77.6389,
    phone: "+91 98765 43212",
    hours: "9 AM – 9 PM",
    services: ["Screen Replacement", "Battery Replacement", "Water Damage", "Back Glass", "Speaker Fix"],
    rating: 4.9,
    reviews: 504,
  },
  {
    id: "store-004",
    name: "Flashfix — Whitefield",
    address: "EPIP Zone, Whitefield",
    city: "Bengaluru",
    lat: 12.9698,
    lng: 77.7499,
    phone: "+91 98765 43213",
    hours: "10 AM – 8 PM",
    services: ["Screen Replacement", "Battery Replacement", "Charging Port"],
    rating: 4.6,
    reviews: 167,
  },
  {
    id: "store-005",
    name: "Flashfix — Jayanagar",
    address: "4th Block, Jayanagar",
    city: "Bengaluru",
    lat: 12.9254,
    lng: 77.5822,
    phone: "+91 98765 43214",
    hours: "9 AM – 8 PM",
    services: ["Screen Replacement", "Battery Replacement", "Water Damage", "Camera Fix"],
    rating: 4.7,
    reviews: 289,
  },
];
