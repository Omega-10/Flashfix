import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Store as StoreIcon,
} from "lucide-react";
import { InventoryRecord } from "../types";
import { STORES } from "../api";

interface InventoryViewProps {
  inventory: InventoryRecord[];
  selectedStore: string;
  onStoreChange: (storeId: string) => void;
}

export default function InventoryView({
  inventory,
  selectedStore,
  onStoreChange,
}: InventoryViewProps) {
  const [search, setSearch] = useState("");

  const filteredItems = inventory.filter((item) => {
    if (selectedStore !== "ALL" && item.storeId !== selectedStore) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = item.partName.toLowerCase().includes(q);
      const matchSku = item.sku.toLowerCase().includes(q);
      const matchCompat = item.compatibleWith.some((c) => c.toLowerCase().includes(q));
      if (!matchName && !matchSku && !matchCompat) return false;
    }
    return true;
  });

  const lowStockCount = filteredItems.filter((i) => i.quantity <= i.minThreshold).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-[#f5f0eb]">
            OEM Parts & Inventory Overview
          </h1>
          <p className="text-xs text-[#807a75]">
            Hardware component stock levels, SKUs, and reorder alerts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-[#a8a09a]">
            Total SKUs: <strong className="text-[#f5f0eb]">{filteredItems.length}</strong>
          </span>
        </div>
      </div>

      {/* Low Stock Warning Banner */}
      {lowStockCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="text-xs">
            <span className="font-bold text-[#f5f0eb] mr-1">
              Low Stock Alert:
            </span>
            <span className="text-[#a8a09a]">
              {lowStockCount} part SKU{lowStockCount > 1 ? "s are" : " is"} at or below minimum threshold. Please trigger replenishment with authorized suppliers.
            </span>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-[#141414] border border-[rgba(255,255,255,0.08)] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
          <StoreIcon className="w-4 h-4 text-[#ef8f0b]" />
          <span className="text-[#807a75]">Hub:</span>
          <select
            value={selectedStore}
            onChange={(e) => onStoreChange(e.target.value)}
            className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-lg px-2.5 py-1 text-xs text-[#f5f0eb] outline-none cursor-pointer"
          >
            <option value="ALL">All Hubs</option>
            {STORES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by part name, SKU, or device model..."
          className="w-full sm:w-80 bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-1.5 text-xs text-[#f5f0eb] outline-none focus:border-[#ef8f0b]"
        />
      </div>

      {/* Inventory Table */}
      <div className="bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1a1a1a] text-[#807a75] font-mono text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Component / Part Name</th>
                <th className="px-5 py-3.5">SKU Code</th>
                <th className="px-5 py-3.5">Compatible Models</th>
                <th className="px-5 py-3.5">Stock Level</th>
                <th className="px-5 py-3.5">Min Threshold</th>
                <th className="px-5 py-3.5">Unit Cost</th>
                <th className="px-5 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.06)] text-[#f5f0eb]">
              {filteredItems.map((item) => {
                const isLow = item.quantity <= item.minThreshold;
                return (
                  <tr key={item.id} className="hover:bg-[#1a1a1a]/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-[#f5f0eb]">{item.partName}</div>
                      <div className="font-mono text-[10px] text-[#807a75]">{item.id}</div>
                    </td>
                    <td className="px-5 py-4 font-mono font-medium text-[#ef8f0b]">
                      {item.sku}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {item.compatibleWith.map((model) => (
                          <span
                            key={model}
                            className="text-[10px] bg-[#1e1e1e] text-[#a8a09a] px-2 py-0.5 rounded border border-[rgba(255,255,255,0.06)]"
                          >
                            {model}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-sm">
                      <span className={isLow ? "text-amber-400" : "text-[#f5f0eb]"}>
                        {item.quantity} units
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-[#807a75]">
                      {item.minThreshold} units
                    </td>
                    <td className="px-5 py-4 font-mono text-[#a8a09a]">
                      ₹{(item.unitCostPaise / 100).toLocaleString("en-IN")}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                          <AlertTriangle className="w-3 h-3" />
                          Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          Optimal
                        </span>
                      )}
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
