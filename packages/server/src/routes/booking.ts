import { Router } from "express";

const router = Router();

// POST /api/booking — demo only, in-memory store
const bookings: unknown[] = [];

router.post("/", (req, res): any => {
  const { storeId, service, name, phone, date, time } = req.body as {
    storeId?: string;
    service?: string;
    name?: string;
    phone?: string;
    date?: string;
    time?: string;
  };

  // Manual validation (ponytail-style)
  if (!storeId || !service || !name || !phone || !date || !time) {
    return res.status(400).json({ error: "storeId, service, name, phone, date, time are required" });
  }

  const cleanPhone = phone.replace(/[\s-]/g, '');
  if (!/^\+?\d{10,15}$/.test(cleanPhone)) {
    return res.status(400).json({ error: "Invalid phone number format" });
  }

  const booking = {
    id: `FF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    storeId,
    service,
    name,
    phone: cleanPhone,
    date,
    time,
    status: "CONFIRMED",
    createdAt: new Date().toISOString(),
  };

  bookings.push(booking);
  res.status(201).json({ booking, message: "Booking confirmed! You'll receive an SMS shortly." });
});

export default router;
