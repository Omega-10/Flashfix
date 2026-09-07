import { useCallback } from "react";
import { useAppStore } from "@/store/appStore";

export interface NearbyStore {
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
  distanceKm: number;
  tier: "flash" | "next-day" | "out-of-range";
  isFlashHero: boolean;
}

export function useGeolocation() {
  const setUserLocation = useAppStore((s) => s.setUserLocation);
  const setPermission = useAppStore((s) => s.setLocationPermission);

  const requestLocation = useCallback((): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setPermission("granted");
          resolve(pos);
        },
        (err) => {
          setPermission("denied");
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }, [setUserLocation, setPermission]);

  const fetchNearbyStores = useCallback(
    async (lat: number, lng: number): Promise<NearbyStore[]> => {
      // Fallback mock stores for Vercel deployment (Hyderabad Metro lane)
      const fallbackStores: NearbyStore[] = [
        {
          id: "store-jntu",
          name: "Flashfix - JNTU Metro",
          address: "JNTU Metro Station, KPHB 9th Phase",
          city: "Hyderabad",
          lat: 17.4968,
          lng: 78.3888,
          phone: "+91 98765 43210",
          hours: "9 AM - 9 PM",
          services: ["Screen Replacement", "Battery Replacement", "Water Damage", "Charging Port"],
          rating: 4.8,
          reviews: 342,
          distanceKm: 0.5,
          tier: "flash",
          isFlashHero: true
        },
        {
          id: "store-kphb",
          name: "Flashfix - KPHB Metro",
          address: "KPHB Colony Metro Station, Kukatpally",
          city: "Hyderabad",
          lat: 17.4876,
          lng: 78.3989,
          phone: "+91 98765 43211",
          hours: "9 AM - 9 PM",
          services: ["Screen Replacement", "Battery Replacement", "Back Glass"],
          rating: 4.9,
          reviews: 504,
          distanceKm: 2.1,
          tier: "flash",
          isFlashHero: false
        },
        {
          id: "store-miyapur",
          name: "Flashfix - Miyapur Metro",
          address: "Miyapur Metro Terminal, Miyapur",
          city: "Hyderabad",
          lat: 17.4961,
          lng: 78.3614,
          phone: "+91 98765 43212",
          hours: "9 AM - 8 PM",
          services: ["Screen Replacement", "Battery Replacement", "Software Fix"],
          rating: 4.7,
          reviews: 289,
          distanceKm: 3.8,
          tier: "next-day",
          isFlashHero: false
        }
      ];

      try {
        const res = await fetch(`/api/stores/nearby?lat=${lat}&lng=${lng}`);
        if (!res.ok) throw new Error("API not available");
        return await res.json() as NearbyStore[];
      } catch (err) {
        // Simple client-side distance calculation for the fallback demo
        const toRad = (value: number) => (value * Math.PI) / 180;
        const calcDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          const R = 6371; // km
          const dLat = toRad(lat2 - lat1);
          const dLon = toRad(lon2 - lon1);
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return Number((R * c).toFixed(1));
        };

        // Map and sort fallback stores based on actual browser location
        const sortedStores = fallbackStores.map(store => {
          const dist = calcDist(lat, lng, store.lat, store.lng);
          return {
            ...store,
            distanceKm: dist,
            tier: (dist <= 3 ? "flash" : dist <= 10 ? "next-day" : "out-of-range") as "flash" | "next-day" | "out-of-range",
            isFlashHero: false
          };
        }).sort((a, b) => a.distanceKm - b.distanceKm);

        if (sortedStores.length > 0) {
          sortedStores[0].isFlashHero = sortedStores[0].tier === "flash";
        }

        return sortedStores;
      }
    },
    []
  );

  return { requestLocation, fetchNearbyStores };
}
