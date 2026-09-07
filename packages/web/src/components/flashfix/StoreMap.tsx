import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAppStore } from "@/store/appStore";
import type { NearbyStore } from "@/hooks/useGeolocation";

interface StoreMapProps {
  stores: NearbyStore[];
}

// Custom amber marker
function makeMarker(isFlash: boolean, isUser = false) {
  const color = isUser ? "#F5F0EB" : isFlash ? "#F59E0B" : "#6B6460";
  const size = isUser ? 12 : isFlash ? 14 : 10;
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:${size}px; height:${size}px;
        background:${color};
        border-radius:50%;
        border: 2px solid ${isFlash ? "#EA580C" : "rgba(255,255,255,0.2)"};
        box-shadow: 0 0 ${isFlash ? "12px 4px rgba(245,158,11,0.5)" : "4px 2px rgba(0,0,0,0.4)"};
        ${isFlash ? "animation: flashPinPulse 2s ease-in-out infinite;" : ""}
      "></div>
      <style>
        @keyframes flashPinPulse {
          0%,100%{box-shadow:0 0 12px 4px rgba(245,158,11,0.5);}
          50%{box-shadow:0 0 20px 8px rgba(234,88,12,0.6);}
        }
      </style>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function StoreMap({ stores }: StoreMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const userLocation = useAppStore((s) => s.userLocation);

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    const center: [number, number] = userLocation
      ? [userLocation.lat, userLocation.lng]
      : [12.9352, 77.6245];

    leafletMap.current = L.map(mapRef.current, {
      center,
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(leafletMap.current);

    L.control.zoom({ position: "bottomright" }).addTo(leafletMap.current);

    // User location marker
    if (userLocation) {
      L.marker([userLocation.lat, userLocation.lng], { icon: makeMarker(false, true) })
        .addTo(leafletMap.current)
        .bindPopup("<strong style='color:#F5F0EB'>Your location</strong>", {
          className: "custom-popup",
        });
    }

    // Store markers
    stores.forEach((store) => {
      const popupContent = `
        <div style="font-family:Inter,sans-serif;padding:4px">
          <p style="font-weight:600;font-size:13px;margin:0 0 4px">${store.name}</p>
          <p style="font-size:11px;color:#A8A09A;margin:0 0 4px">${store.address}</p>
          <p style="font-size:11px;color:#A8A09A;margin:0 0 6px">${store.hours}</p>
          <p style="font-size:11px;color:${store.tier === "flash" ? "#F59E0B" : "#6B6460"};font-weight:600;margin:0">
            ${store.tier === "flash" ? "⚡ Flash eligible" : store.tier === "next-day" ? "📦 Next-Day" : "🔜 Out of range"}
            · ${store.distanceKm}km
          </p>
        </div>
      `;
      L.marker([store.lat, store.lng], { icon: makeMarker(store.tier === "flash") })
        .addTo(leafletMap.current!)
        .bindPopup(popupContent);
    });

    return () => {
      leafletMap.current?.remove();
      leafletMap.current = null;
    };
  }, []);

  return (
    <div
      ref={mapRef}
      className="w-full rounded-2xl overflow-hidden border border-[var(--surface-border)]"
      style={{ height: "360px" }}
    />
  );
}
