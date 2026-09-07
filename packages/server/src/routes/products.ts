import { Router } from "express";
import { products } from "../data/mockProducts.js";

const router = Router();

// GET /api/products?brand=Apple&category=Case
router.get("/", (req, res) => {
  const { brand, category } = req.query as Record<string, string>;
  let result = products;
  if (brand) result = result.filter((p) => p.brand === brand);
  if (category) result = result.filter((p) => p.category === category);
  res.json(result);
});

// GET /api/products/:id
router.get("/:id", (req, res) => {
  const product = products.find((p) => p.id === req.params.id);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(product);
});

export default router;
