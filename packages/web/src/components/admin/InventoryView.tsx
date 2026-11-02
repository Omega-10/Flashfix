import { useState } from "react";
import {
  AlertTriangle,
  Search,
  Store as StoreIcon,
  Plus,
  Minus,
  RefreshCw,
} from "lucide-react";
import { InventoryRecord } from "./types";
import { STORES, updateInventoryStock } from "./api";

interface InventoryViewProps {
  inventory: InventoryRecord[];
  selectedStore: string;
  onStoreChange: (storeId: string) => void;
  onRefreshData?: () => void;
}

export default function InventoryView({
  inventory,
  selectedStore,
  onStoreChange,
  onRefreshData,
}: InventoryViewProps) {
  const [search, setSearch] = useState("");
  const [localInventory, setLocalInventory] = useState<InventoryRecord[]>(inventory);
  const [isRefreshing, setIsRefreshing] = useState(false);

  function handleRefresh() {
    if (!onRefreshData) return;
    setIsRefreshing(true);
    onRefreshData();
    setTimeout(() => setIsRefreshing(false), 600);
  }

  const filteredItems = (localInventory.length ? localInventory : inventory).filter((item) => {
    if (selectedStore !== "ALL" && item.storeId !== selectedStore) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchName = item.partName.toLowerCase().includes(q);
      const matchSku = item.sku.toLowerCase().includes(q);
      const matchCompat = item.compatibleWith.some((c) => c.toLowerCase().includes(q));
      if (!matchName && !matchSku && !matchCompat) return false;
    }
    return true;
  });

  const lowStockItems = filteredItems.filter((i) => i.quantity <= i.minThreshold);

  async function handleStockChange(itemId: string, delta: number) {
    const item = localInventory.find((i) => i.id === itemId);
    if (!item) return;
    const newQty = Math.max(0, item.quantity + delta);
    setLocalInventory((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, quantity: newQty } : i))
    );
    await updateInventoryStock(itemId, newQty);
  }

  function formatPrice(paise: number) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(paise / 100);
  }

  return (
    <div className="space-y-6 max-w-full">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-[var(--ink)]">
            OEM Hardware Parts Inventory
          </h1>
          <p className="text-xs text-[var(--ink-muted)]">
            Certified Grade-A replacement panels, batteries, lenses, and sub-boards
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onRefreshData && (
            <button
              onClick={handleRefresh}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border border-[var(--hairline-strong)] text-xs font-semibold text-[var(--ink)] transition-all"
              title="Refresh inventory stock"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#ef8f0b] ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          )}
          <div className="flex items-center gap-2 bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl px-3 py-2 text-xs">
            <StoreIcon className="w-3.5 h-3.5 text-[#ef8f0b]" />
            <select
              value={selectedStore}
              onChange={(e) => onStoreChange(e.target.value)}
              className="bg-transparent text-[var(--ink)] outline-none text-xs cursor-pointer"
            >
              <option value="ALL" className="bg-[var(--surface-1)]">All Stores</option>
              {STORES.map((s) => (
                <option key={s.id} value={s.id} className="bg-[var(--surface-1)]">{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Low-Stock Warning Alert */}
      {lowStockItems.length > 0 && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-400">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div className="text-xs">
            <span className="font-bold block sm:inline">Critical Stock Warning: </span>
            <span>
              {lowStockItems.length} hardware part{lowStockItems.length > 1 ? "s are" : " is"} currently at or below minimum buffer threshold. Restock recommended.
            </span>
          </div>
        </div>
      )}

      {/* Search Toolbar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-muted)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by part name, OEM SKU, or compatible phone model..."
          className="min-h-[44px] w-full bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[var(--ink)] placeholder-[var(--ink-muted)] outline-none focus:border-[#ef8f0b] transition-colors"
        />
      </div>

      {/* Inventory Table / Cards */}
      <div className="bg-[var(--surface-1)] border border-[var(--hairline)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-2)] text-[var(--ink-muted)] font-mono text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Part & SKU</th>
                <th className="px-5 py-3.5">Compatible Models</th>
                <th className="px-5 py-3.5">Store Hub</th>
                <th className="px-5 py-3.5">Stock Level</th>
                <th className="px-5 py-3.5">Unit Cost</th>
                <th className="px-5 py-3.5 text-right">Quick Stock Adjustment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hairline)] text-[var(--ink)]">
              {filteredItems.map((item) => {
                const isLow = item.quantity <= item.minThreshold;
                const store = STORES.find((s) => s.id === item.storeId);
                return (
                  <tr key={item.id} className="hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-[var(--ink)]">{item.partName}</div>
                      <div className="font-mono text-[11px] text-[#ef8f0b] mt-0.5">{item.sku}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {item.compatibleWith.map((c) => (
                          <span
                            key={c}
                            className="px-1.5 py-0.5 rounded bg-[var(--surface-3)] border border-[var(--hairline)] text-[10px] text-[var(--ink-secondary)]"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[var(--ink-muted)] text-[11px]">
                      {(store?.name || item.storeId || "All Stores").split(" ")[0]}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono font-bold text-sm ${
                            isLow ? "text-red-400" : "text-emerald-400"
                          }`}
                        >
                          {item.quantity} units
                        </span>
                        {isLow && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-red-500/10 text-red-400 border border-red-500/20">
                            MIN {item.minThreshold}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-[var(--ink)]">
                      {formatPrice(item.unitCostPaise)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-1.5 bg-[var(--surface-2)] border border-[var(--hairline)] rounded-xl p-1">
                        <button
                          onClick={() => handleStockChange(item.id, -1)}
                          className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg hover:bg-[var(--surface-3)] text-[var(--ink-muted)] hover:text-[var(--ink)] flex items-center justify-center transition-colors"
                          title="Deduct 1 unit"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono text-xs font-bold px-2">{item.quantity}</span>
                        <button
                          onClick={() => handleStockChange(item.id, 1)}
                          className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg hover:bg-[var(--surface-3)] text-[var(--ink-muted)] hover:text-[var(--ink)] flex items-center justify-center transition-colors"
                          title="Add 1 unit"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
