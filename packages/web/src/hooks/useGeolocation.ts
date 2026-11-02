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
  rating?: number;
  reviews?: number;
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
      try {
        const res = await fetch(`/api/stores/nearby?lat=${lat}&lng=${lng}`);
        if (!res.ok) return [];
        const body = await res.json();
        const list = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
        return list as NearbyStore[];
      } catch {
        return [];
      }
    },
    []
  );

  return { requestLocation, fetchNearbyStores };
}
