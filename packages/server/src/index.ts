import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import storesRouter from "./routes/stores.js";
import productsRouter from "./routes/products.js";
import bookingRouter from "./routes/booking.js";

const app = express();

// Security Middlewares (Pentagi guidelines)
app.use(helmet());

// CORS configuration - locking it down to frontend origins
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:5173', 'http://127.0.0.1:4173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Rate limiting - basic protection
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Routes
app.use("/api/stores", storesRouter);
app.use("/api/products", productsRouter);
app.use("/api/booking", bookingRouter);

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Centralized error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Error]', err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`[server] Flashfix API running → http://localhost:${PORT}`);
});
