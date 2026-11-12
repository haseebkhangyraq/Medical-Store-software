import type { Batch, Medicine } from "./types";
import { todayISO } from "./utils";

/** Batches available for sale: in-stock, not expired, FEFO order (earliest expiry first). */
export function liveBatches(m: Medicine, today = todayISO()): Batch[] {
  return m.batches
    .filter((b) => b.quantity > 0 && b.expiryDate >= today)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.batchNo.localeCompare(b.batchNo));
}

export function totalStock(m: Medicine) {
  return m.batches.reduce((s, b) => s + b.quantity, 0);
}

export function sellableStock(m: Medicine, today = todayISO()) {
  return liveBatches(m, today).reduce((s, b) => s + b.quantity, 0);
}

export function stockValue(m: Medicine) {
  return m.batches.reduce((s, b) => s + b.quantity * b.purchasePrice, 0);
}

export interface BatchAllocation {
  batchId: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  unitCost: number;
}

/** FEFO allocation across live batches. Returns allocations + unmet shortfall. */
export function allocateFefo(m: Medicine, qty: number, today = todayISO()): { allocations: BatchAllocation[]; shortfall: number } {
  let remaining = qty;
  const allocations: BatchAllocation[] = [];
  for (const b of liveBatches(m, today)) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, b.quantity);
    if (take > 0) {
      allocations.push({ batchId: b.id, batchNo: b.batchNo, expiryDate: b.expiryDate, quantity: take, unitCost: b.purchasePrice });
      remaining -= take;
    }
  }
  return { allocations, shortfall: remaining };
}

export function stockValueAll(medicines: Medicine[]) {
  return medicines.reduce((s, m) => s + stockValue(m), 0);
}

export type ExpiryStatus = "expired" | "critical" | "warning" | "notice" | "ok";

export function expiryStatus(expiryDate: string, warnDays = 90, today = todayISO()): ExpiryStatus {
  const days = Math.round((new Date(expiryDate + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
  if (days < 0) return "expired";
  if (days <= Math.min(30, warnDays)) return "critical";
  if (days <= Math.min(60, warnDays)) return "warning";
  if (days <= warnDays) return "notice";
  return "ok";
}

export function isLowStock(m: Medicine, threshold: number) {
  return sellableStock(m) <= Math.max(m.minStockLevel, threshold);
}
