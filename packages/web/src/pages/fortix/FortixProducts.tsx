import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Product } from "@/types/product";

const BRANDS = ["All", "Apple", "Samsung", "Google", "Universal"];
const CATEGORIES = ["All", "Case", "Screen Guard", "Charger", "Cable", "Watch Band", "Earbud Case"];

export default function FortixProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [brand, setBrand] = useState("All");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (brand !== "All") params.set("brand", brand);
    if (category !== "All") params.set("category", category);
    setLoading(true);
    fetch(`/api/products?${params}`)
      .then((r) => r.json())
      .then((data) => { setProducts(data as Product[]); setLoading(false); })
      .catch(() => setLoading(false));
  }, [brand, category]);

  return (
    <div className="pt-24 pb-20">
      <div className="section-container">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <span className="platform-badge mb-4 inline-flex">◆ Accessories</span>
          <h1 className="heading-fortix text-[clamp(40px,5vw,64px)] mt-3">
            The Collection
          </h1>
          <p className="text-[var(--text-muted)] mt-2 max-w-md">
            Premium accessories, precisely made for the devices you care about.
          </p>
        </motion.div>

        {/* Filters */}
        <div className="space-y-3 mb-10">
          {/* Brand filter */}
          <div className="flex gap-2 flex-wrap">
            {BRANDS.map((b) => (
              <button
                key={b}
                onClick={() => setBrand(b)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  brand === b
                    ? "bg-amber-gradient text-[#0D0D0D]"
                    : "bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[rgba(245,158,11,0.3)]"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
          {/* Category filter */}
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  category === c
                    ? "border border-[var(--accent-amber)] text-[var(--accent-amber)] bg-[rgba(245,158,11,0.08)]"
                    : "bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Product grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="card aspect-[3/4] animate-pulse" />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.div
              layout
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
            >
              {products.map((p, i) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.04, duration: 0.4 }}
                >
                  <ProductCard product={p} />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {!loading && products.length === 0 && (
          <div className="text-center py-24">
            <p className="text-[var(--text-muted)] text-sm">No products match these filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <motion.div
      className="card group cursor-pointer overflow-hidden"
      whileHover={{ y: -6, boxShadow: "0 12px 40px rgba(245,158,11,0.12)" }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Product color swatch hero */}
      <div
        className="aspect-square flex items-center justify-center relative overflow-hidden"
        style={{ background: `${product.color}18` }}
      >
        <div
          className="w-20 h-20 rounded-2xl transition-transform duration-500 group-hover:scale-110"
          style={{
            background: `linear-gradient(135deg, ${product.color}40, ${product.color}80)`,
            boxShadow: `0 8px 30px ${product.color}30`,
          }}
        />
        {product.badge && (
          <div className="absolute top-3 left-3">
            <span className={`text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-full ${
              product.badge === "Bestseller"
                ? "bg-amber-gradient text-[#0D0D0D]"
                : product.badge === "New"
                ? "bg-[var(--surface-elevated)] text-[var(--accent-amber)] border border-[rgba(245,158,11,0.3)]"
                : "bg-[var(--surface-elevated)] text-[var(--text-muted)] border border-[var(--surface-border)]"
            }`}>
              {product.badge}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">
          {product.brand} · {product.category}
        </div>
        <h3 className="text-sm font-medium text-[var(--text-primary)] leading-tight mb-1 line-clamp-2">
          {product.name}
        </h3>
        <div className="flex items-center gap-1 mb-3">
          <span className="text-[10px] text-[var(--accent-amber)]">★ {product.rating}</span>
          <span className="text-[10px] text-[var(--text-muted)]">({product.reviews})</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-[var(--text-primary)] font-mono">
            ₹{product.price.toLocaleString("en-IN")}
          </span>
          {product.originalPrice && (
            <span className="text-[var(--text-muted)] text-xs line-through font-mono">
              ₹{product.originalPrice.toLocaleString("en-IN")}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
