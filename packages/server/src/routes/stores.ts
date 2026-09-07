import { Router } from "express";
import { stores } from "../data/mockStores.js";
import { haversineKm, getRadiusTier } from "../utils/geo.js";

const router = Router();

// GET /api/stores — all stores
router.get("/", (_req, res) => {
  res.json(stores);
});

// GET /api/stores/nearby?lat=12.9352&lng=77.6245
router.get("/nearby", (req, res) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: "lat and lng query params required" });
    return;
  }

  const enriched = stores
    .map((store) => {
      const distanceKm = haversineKm(lat, lng, store.lat, store.lng);
      return {
        ...store,
        distanceKm: Math.round(distanceKm * 10) / 10,
        tier: getRadiusTier(distanceKm),
        // ≤3km gets the flash hero badge (primary USP)
        isFlashHero: distanceKm <= 3,
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  res.json(enriched);
});

export default router;
