"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import type {
  AppState, Medicine, Batch, Supplier, Customer, Sale, SaleItem, PaymentMethod, SplitPaymentPart,
  Purchase, PurchaseItem, Receiving, Issuance, StockTransfer, SalesReturn, PurchaseReturn,
  SupplierPayment, CustomerPayment, Expense, InventoryMovement, StaffUser, PharmacySettings, ActivityLogEntry,
} from "./types";
import { buildSeedData } from "./seed";
import { docNo, todayISO, uid } from "./utils";
import { allocateFefo, liveBatches } from "./stock";

const STORAGE_KEY = "medicore-pharmacy-v1";

function freshState(): Omit<AppState, "_hydrated"> {
  return buildSeedData();
}

// ── Custom IndexedDB storage so data survives refresh & browser restarts ──
// Guarded for SSR/prerender: on the server (no indexedDB) reads return null and writes are no-ops.
const hasIDB = () => typeof indexedDB !== "undefined";

const idbStorage = {
  getItem: async (name: string) => {
    if (!hasIDB()) return null;
    try {
      return (await idbGet(name)) ?? null;
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string) => {
    if (!hasIDB()) return;
    try {
      await idbSet(name, value);
    } catch {
      /* storage unavailable — demo continues in-memory */
    }
  },
  removeItem: async (name: string) => {
    if (!hasIDB()) return;
    try {
      await idbDel(name);
    } catch {
      /* noop */
    }
  },
};

export interface CartLine {
  key: string;
  medicineId: string;
  medicineName: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  taxRate: number;
  batchId?: string; // optional manual batch override
}

interface Actions {
  // session
  login(username: string): boolean;
  logout(): void;
  logActivity(action: string, detail: string): void;
  // medicines
  addMedicine(m: Omit<Medicine, "id" | "createdAt" | "batches">, firstBatch?: Omit<Batch, "id" | "receivedDate">): Medicine;
  updateMedicine(id: string, patch: Partial<Medicine>): void;
  deleteMedicine(id: string): void;
  addBatch(medicineId: string, b: Omit<Batch, "id" | "receivedDate">): Batch;
  adjustBatch(medicineId: string, batchId: string, newQty: number, reason: string): void;
  removeExpiredBatch(medicineId: string, batchId: string, reason: string): void;
  // suppliers & customers
  addSupplier(s: Omit<Supplier, "id" | "createdAt">): Supplier;
  updateSupplier(id: string, patch: Partial<Supplier>): void;
  deleteSupplier(id: string): void;
  paySupplier(supplierId: string, amount: number, method: PaymentMethod, reference?: string, note?: string): SupplierPayment;
  addCustomer(c: Omit<Customer, "id" | "createdAt" | "openingBalance"> & { openingBalance?: number }): Customer;
  updateCustomer(id: string, patch: Partial<Customer>): void;
  deleteCustomer(id: string): void;
  payCustomer(customerId: string, amount: number, method: PaymentMethod, reference?: string, note?: string): CustomerPayment;
  // pos
  createSale(input: {
    lines: CartLine[];
    customerId: string;
    invoiceDiscount: number;
    paidAmount: number;
    method: PaymentMethod;
    splitParts?: SplitPaymentPart[];
    prescriptionNote?: string;
  }): Sale | { error: string };
  // purchases
  createPurchase(input: { supplierId: string; items: Omit<PurchaseItem, "id" | "receivedQty">[]; discount: number; tax: number; paidAmount: number; notes?: string; receiveNow: boolean }): Purchase;
  receivePurchase(purchaseId: string, lines: { itemId: string; quantity: number; batchNo: string; expiryDate: string; mfgDate: string; unitCost: number }[], receivedBy: string): Receiving | { error: string };
  cancelPurchase(purchaseId: string): void;
  // returns
  createSalesReturn(input: { saleId: string; items: { saleItemId: string; quantity: number; restock: boolean }[]; reason: string; restockMethod: SalesReturn["restockMethod"] }): SalesReturn | { error: string };
  createPurchaseReturn(input: { purchaseId: string; items: { itemId: string; quantity: number; batchId: string }[]; reason: string }): PurchaseReturn | { error: string };
  // issuance & transfer
  createIssuance(input: { destination: string; reason: Issuance["reason"]; authorizedBy: string; notes?: string; items: { medicineId: string; batchId: string; quantity: number }[] }): Issuance | { error: string };
  createTransfer(input: { fromLocation: string; toLocation: string; authorizedBy: string; notes?: string; items: { medicineId: string; batchId: string; quantity: number }[] }): StockTransfer | { error: string };
  // finance
  addExpense(e: Omit<Expense, "id" | "expenseNo" | "recordedBy">): Expense;
  deleteExpense(id: string): void;
  // staff & settings
  addUser(u: Omit<StaffUser, "id" | "createdAt">): void;
  updateUser(id: string, patch: Partial<StaffUser>): void;
  deleteUser(id: string): void;
  updateSettings(patch: Partial<PharmacySettings>): void;
  resetDemoData(): void;
  clearAllData(): void;
}

export type AppStore = Actions & AppState;

export const useStore = create<AppStore>()(
  persist(
    (set, get) => {
      /** push a movement ledger entry */
      const move = (m: Omit<InventoryMovement, "id">) =>
        set((s) => ({ movements: [{ id: uid("mv"), ...m }, ...s.movements] }));
      const cash = (c: Omit<import("./types").CashEntry, "id">) =>
        set((s) => ({ cashEntries: [{ id: uid("cash"), ...c }, ...s.cashEntries] }));

      const nextNo = (prefix: keyof AppState & string) => {
        void prefix;
        return null;
      };
      void nextNo;

      const logAct = (action: string, detail: string) => {
        const u = get().currentUser;
        const entry: ActivityLogEntry = {
          id: uid("log"), userId: u?.id ?? "guest", userName: u?.name ?? "Guest",
          action, detail, date: new Date().toISOString(),
        };
        set((s) => ({ activityLog: [entry, ...s.activityLog].slice(0, 500) }));
      };

      return {
        ...freshState(),
        demoCleared: false,
        _hydrated: false,

        // ── session ──
        login(username) {
          const u = get().users.find((x) => x.username.toLowerCase() === username.trim().toLowerCase() && x.active);
          if (!u) return false;
          set({ currentUser: u });
          logAct("login", `${u.name} signed in (${u.role})`);
          return true;
        },
        logout() {
          set({ currentUser: null });
        },
        logActivity(action, detail) {
          logAct(action, detail);
        },

        // ── medicines ──
        addMedicine(m, firstBatch) {
          const med: Medicine = { ...m, id: uid("med"), createdAt: new Date().toISOString(), batches: [] };
          if (firstBatch) {
            const b: Batch = { ...firstBatch, id: uid("bt"), receivedDate: todayISO() };
            med.batches.push(b);
            move({
              date: todayISO(), type: "purchase_receive", medicineId: med.id, medicineName: med.name,
              batchId: b.id, batchNo: b.batchNo, qtyIn: b.quantity, qtyOut: 0, unitCost: b.purchasePrice,
              refNo: "MANUAL", note: "Initial batch on medicine creation", userName: get().currentUser?.name ?? "System",
            });
          }
          set((s) => ({ medicines: [med, ...s.medicines] }));
          logAct("medicine_create", `Added medicine ${med.name}`);
          return med;
        },
        updateMedicine(id, patch) {
          set((s) => ({ medicines: s.medicines.map((m) => (m.id === id ? { ...m, ...patch, id: m.id } : m)) }));
          logAct("medicine_update", `Updated medicine ${patch.name ?? id}`);
        },
        deleteMedicine(id) {
          const med = get().medicines.find((m) => m.id === id);
          set((s) => ({ medicines: s.medicines.filter((m) => m.id !== id) }));
          logAct("medicine_delete", `Deleted medicine ${med?.name ?? id}`);
        },
        addBatch(medicineId, b) {
          const batch: Batch = { ...b, id: uid("bt"), receivedDate: todayISO() };
          set((s) => ({
            medicines: s.medicines.map((m) => (m.id === medicineId ? { ...m, batches: [...m.batches, batch] } : m)),
          }));
          const med = get().medicines.find((m) => m.id === medicineId);
          move({
            date: todayISO(), type: "purchase_receive", medicineId, medicineName: med?.name ?? "",
            batchId: batch.id, batchNo: batch.batchNo, qtyIn: batch.quantity, qtyOut: 0,
            unitCost: batch.purchasePrice, refNo: "MANUAL", note: "Manual batch addition", userName: get().currentUser?.name ?? "System",
          });
          logAct("batch_add", `Added batch ${batch.batchNo} to ${med?.name}`);
          return batch;
        },
        adjustBatch(medicineId, batchId, newQty, reason) {
          const med = get().medicines.find((m) => m.id === medicineId);
          const batch = med?.batches.find((b) => b.id === batchId);
          if (!med || !batch) return;
          const diff = newQty - batch.quantity;
          set((s) => ({
            medicines: s.medicines.map((m) =>
              m.id === medicineId ? { ...m, batches: m.batches.map((b) => (b.id === batchId ? { ...b, quantity: newQty } : b)) } : m,
            ),
          }));
          move({
            date: todayISO(), type: "adjustment", medicineId, medicineName: med.name, batchId, batchNo: batch.batchNo,
            qtyIn: diff > 0 ? diff : 0, qtyOut: diff < 0 ? -diff : 0, unitCost: batch.purchasePrice,
            refNo: "ADJ", note: reason || "Manual stock adjustment", userName: get().currentUser?.name ?? "System",
          });
          logAct("stock_adjust", `${med.name} batch ${batch.batchNo} adjusted to ${newQty} (${reason})`);
        },
        removeExpiredBatch(medicineId, batchId, reason) {
          const med = get().medicines.find((m) => m.id === medicineId);
          const batch = med?.batches.find((b) => b.id === batchId);
          if (!med || !batch || batch.quantity <= 0) return;
          const qty = batch.quantity;
          set((s) => ({
            medicines: s.medicines.map((m) =>
              m.id === medicineId ? { ...m, batches: m.batches.map((b) => (b.id === batchId ? { ...b, quantity: 0 } : b)) } : m,
            ),
          }));
          move({
            date: todayISO(), type: "expiry_removal", medicineId, medicineName: med.name, batchId, batchNo: batch.batchNo,
            qtyIn: 0, qtyOut: qty, unitCost: batch.purchasePrice, refNo: "EXP-REMOVE", note: reason || "Expired stock removal",
            userName: get().currentUser?.name ?? "System",
          });
          logAct("expiry_removal", `Removed ${qty} units of ${med.name} batch ${batch.batchNo}`);
        },

        // ── suppliers ──
        addSupplier(s) {
          const sup: Supplier = { ...s, id: uid("sup"), createdAt: new Date().toISOString() };
          set((st) => ({ suppliers: [sup, ...st.suppliers] }));
          logAct("supplier_create", `Added supplier ${sup.name}`);
          return sup;
        },
        updateSupplier(id, patch) {
          set((st) => ({ suppliers: st.suppliers.map((s) => (s.id === id ? { ...s, ...patch, id: s.id } : s)) }));
          logAct("supplier_update", `Updated supplier ${patch.name ?? id}`);
        },
        deleteSupplier(id) {
          set((st) => ({ suppliers: st.suppliers.filter((s) => s.id !== id) }));
          logAct("supplier_delete", `Deleted supplier ${id}`);
        },
        paySupplier(supplierId, amount, method, reference, note) {
          const sup = get().suppliers.find((s) => s.id === supplierId);
          const payment: SupplierPayment = {
            id: uid("pay"), paymentNo: docNo("PAY-S", get().supplierPayments.length + 1),
            date: todayISO(), supplierId, supplierName: sup?.name ?? "", amount, method, reference, note,
          };
          set((st) => ({ supplierPayments: [payment, ...st.supplierPayments] }));
          cash({ date: todayISO(), direction: "out", category: "supplier_payment", refNo: payment.paymentNo, description: `Payment to ${sup?.name}`, amount, method });
          logAct("supplier_payment", `Paid ${amount} to ${sup?.name}`);
          return payment;
        },

        // ── customers ──
        addCustomer(c) {
          const cus: Customer = { openingBalance: 0, ...c, id: uid("cus"), createdAt: new Date().toISOString() };
          set((st) => ({ customers: [cus, ...st.customers] }));
          logAct("customer_create", `Added customer ${cus.name}`);
          return cus;
        },
        updateCustomer(id, patch) {
          set((st) => ({ customers: st.customers.map((c) => (c.id === id ? { ...c, ...patch, id: c.id } : c)) }));
          logAct("customer_update", `Updated customer ${patch.name ?? id}`);
        },
        deleteCustomer(id) {
          set((st) => ({ customers: st.customers.filter((c) => c.id !== id) }));
          logAct("customer_delete", `Deleted customer ${id}`);
        },
        payCustomer(customerId, amount, method, reference, note) {
          const cus = get().customers.find((c) => c.id === customerId);
          const payment: CustomerPayment = {
            id: uid("pay"), paymentNo: docNo("PAY-C", get().customerPayments.length + 1),
            date: todayISO(), customerId, customerName: cus?.name ?? "", amount, method, reference, note,
          };
          set((st) => ({ customerPayments: [payment, ...st.customerPayments] }));
          cash({ date: todayISO(), direction: "in", category: "customer_payment", refNo: payment.paymentNo, description: `Payment from ${cus?.name}`, amount, method });
          logAct("customer_payment", `Received ${amount} from ${cus?.name}`);
          return payment;
        },

        // ── POS ──
        createSale(input) {
          const { medicines, customers, settings } = get();
          const cashier = get().currentUser?.name ?? "Cashier";
          const customer = customers.find((c) => c.id === input.customerId);
          const items: SaleItem[] = [];
          const batchUpdates: { medicineId: string; batchId: string; qty: number }[] = [];

          for (const line of input.lines) {
            const med = medicines.find((m) => m.id === line.medicineId);
            if (!med) return { error: `Medicine not found: ${line.medicineId}` };
            if (line.quantity <= 0) return { error: `Invalid quantity for ${med.name}` };
            let allocations;
            if (line.batchId) {
              const b = med.batches.find((x) => x.id === line.batchId);
              if (!b) return { error: `Batch not found for ${med.name}` };
              if (b.expiryDate < todayISO()) return { error: `${med.name} batch ${b.batchNo} is expired and cannot be sold` };
              if (b.quantity < line.quantity) return { error: `Insufficient stock for ${med.name} batch ${b.batchNo} (available ${b.quantity})` };
              allocations = [{ batchId: b.id, batchNo: b.batchNo, expiryDate: b.expiryDate, quantity: line.quantity, unitCost: b.purchasePrice }];
            } else {
              const res = allocateFefo(med, line.quantity, todayISO());
              if (res.shortfall > 0) {
                return { error: `Insufficient sellable stock for ${med.name}: short by ${res.shortfall} ${med.unitType}. Check batch expiry dates.` };
              }
              allocations = res.allocations;
            }
            for (const a of allocations) {
              const gross = a.quantity * line.unitPrice;
              const tax = Math.round(((gross - line.discount) * line.taxRate) / 100);
              items.push({
                id: uid("si"), medicineId: med.id, medicineName: med.name, batchId: a.batchId, batchNo: a.batchNo,
                expiryDate: a.expiryDate, quantity: a.quantity, unitPrice: line.unitPrice, costPrice: a.unitCost,
                discount: line.discount, taxRate: line.taxRate, total: gross - line.discount + tax,
              });
              batchUpdates.push({ medicineId: med.id, batchId: a.batchId, qty: a.quantity });
            }
          }

          const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
          const itemDiscountTotal = items.reduce((s, it) => s + it.discount, 0);
          const taxTotal = Math.round(items.reduce((s, it) => s + ((it.quantity * it.unitPrice - it.discount) * it.taxRate) / 100, 0));
          const total = Math.max(0, subtotal - itemDiscountTotal - input.invoiceDiscount + taxTotal);
          if (input.paidAmount < total && customer && customer.creditLimit > 0) {
            const outstanding = getCustomerBalance(customers, input.customerId, get().sales, get().customerPayments) + (total - input.paidAmount);
            if (outstanding > customer.creditLimit) {
              return { error: `Credit limit exceeded for ${customer.name} (limit ${customer.creditLimit})` };
            }
          }
          const sale: Sale = {
            id: uid("sale"),
            invoiceNo: docNo("INV", get().sales.length + 1),
            date: new Date().toISOString(),
            customerId: customer?.id ?? "walkin",
            customerName: customer?.name ?? "Walk-in Customer",
            items, itemDiscountTotal, invoiceDiscount: input.invoiceDiscount, taxTotal, subtotal, total,
            paidAmount: input.paidAmount,
            changeReturned: Math.max(0, input.paidAmount - total),
            paymentMethod: input.method,
            splitParts: input.splitParts,
            status: "completed",
            cashierName: cashier,
            prescriptionNote: input.prescriptionNote,
          };

          // Deduct batches
          set((s) => ({
            sales: [sale, ...s.sales],
            medicines: s.medicines.map((m) => {
              const updates = batchUpdates.filter((u) => u.medicineId === m.id);
              if (!updates.length) return m;
              return {
                ...m,
                batches: m.batches.map((b) => {
                  const u = updates.find((x) => x.batchId === b.id);
                  return u ? { ...b, quantity: b.quantity - u.qty } : b;
                }),
              };
            }),
          }));

          for (const it of items) {
            move({
              date: sale.date.slice(0, 10), type: "sale", medicineId: it.medicineId, medicineName: it.medicineName,
              batchId: it.batchId, batchNo: it.batchNo, qtyIn: 0, qtyOut: it.quantity, unitCost: it.costPrice,
              refNo: sale.invoiceNo, note: `Sold to ${sale.customerName}`, userName: cashier,
            });
          }
          if (input.method === "cash") {
            cash({ date: todayISO(), direction: "in", category: "sale", refNo: sale.invoiceNo, description: `Sale ${sale.invoiceNo} — ${sale.customerName}`, amount: input.paidAmount, method: "cash" });
          }
          logAct("sale", `Invoice ${sale.invoiceNo} — ${sale.customerName} — total ${total}`);
          return sale;
        },

        // ── purchases ──
        createPurchase(input) {
          const supplier = get().suppliers.find((s) => s.id === input.supplierId);
          const items: PurchaseItem[] = input.items.map((it) => ({ ...it, id: uid("pi"), receivedQty: 0 }));
          const subtotal = items.reduce((s, it) => s + it.orderedQty * it.unitCost, 0);
          const total = subtotal - input.discount + input.tax;
          const purchase: Purchase = {
            id: uid("po"), refNo: docNo("PO", get().purchases.length + 1),
            date: new Date().toISOString(), supplierId: input.supplierId, supplierName: supplier?.name ?? "",
            items, subtotal, discount: input.discount, tax: input.tax, total,
            paidAmount: input.paidAmount, status: input.receiveNow ? "received" : "ordered",
            notes: input.notes, createdAt: new Date().toISOString(),
          };
          set((s) => ({ purchases: [purchase, ...s.purchases] }));
          if (input.receiveNow) {
            const res = get().receivePurchase(purchase.id, items.map((it) => ({
              itemId: it.id, quantity: it.orderedQty, batchNo: it.batchNo, expiryDate: it.expiryDate,
              mfgDate: it.mfgDate, unitCost: it.unitCost,
            })), get().currentUser?.name ?? "Store");
            if ("error" in res) purchase.status = "ordered";
            else {
              purchase.paidAmount = input.paidAmount;
              if (input.paidAmount > 0) {
                cash({ date: todayISO(), direction: "out", category: "supplier_payment", refNo: purchase.refNo, description: `Payment to ${supplier?.name} (${purchase.refNo})`, amount: input.paidAmount, method: "cash" });
              }
            }
          }
          logAct("purchase_create", `${purchase.refNo} — ${supplier?.name} — ${items.length} items${input.receiveNow ? " (received immediately)" : ""}`);
          return purchase;
        },
        receivePurchase(purchaseId, lines, receivedBy) {
          const purchase = get().purchases.find((p) => p.id === purchaseId);
          if (!purchase) return { error: "Purchase order not found" };
          if (purchase.status === "received" || purchase.status === "cancelled") return { error: "This order is already fully received or cancelled" };
          const items = lines.filter((l) => l.quantity > 0);
          if (!items.length) return { error: "Enter at least one received quantity" };
          const today = todayISO();
          const recItems: Receiving["items"] = [];
          const batchAdds: { medicineId: string; batch: Batch }[] = [];
          for (const l of items) {
            const pitem = purchase.items.find((i) => i.id === l.itemId);
            if (!pitem) continue;
            const remain = pitem.orderedQty - pitem.receivedQty;
            if (l.quantity > remain) return { error: `${pitem.medicineName}: cannot receive more than ordered (remaining ${remain})` };
            if (l.expiryDate < today) return { error: `${pitem.medicineName}: batch expiry ${l.expiryDate} is already past` };
            const med = get().medicines.find((m) => m.id === pitem.medicineId);
            if (!med) return { error: `Medicine missing: ${pitem.medicineName}` };
            const batch: Batch = {
              id: uid("bt"), batchNo: l.batchNo || `B${Math.floor(Math.random() * 9000 + 1000)}`,
              mfgDate: l.mfgDate, expiryDate: l.expiryDate, purchasePrice: l.unitCost,
              quantity: l.quantity, receivedDate: today,
            };
            batchAdds.push({ medicineId: med.id, batch });
            recItems.push({ id: uid("ri"), medicineId: med.id, medicineName: med.name, batchId: batch.id, batchNo: batch.batchNo, expiryDate: batch.expiryDate, mfgDate: batch.mfgDate, quantity: batch.quantity, unitCost: batch.purchasePrice });
          }

          const receiving: Receiving = {
            id: uid("rcv"), receiveNo: docNo("GRN", get().receivings.length + 1),
            purchaseId, refNo: purchase.refNo, supplierId: purchase.supplierId, supplierName: purchase.supplierName,
            date: new Date().toISOString(), items: recItems,
            total: recItems.reduce((s, it) => s + it.quantity * it.unitCost, 0), receivedBy,
          };

          set((s) => ({
            receivings: [receiving, ...s.receivings],
            medicines: s.medicines.map((m) => {
              const adds = batchAdds.filter((a) => a.medicineId === m.id);
              if (!adds.length) return m;
              return { ...m, batches: [...m.batches, ...adds.map((a) => a.batch)] };
            }),
            purchases: s.purchases.map((p) =>
              p.id === purchaseId
                ? {
                    ...p,
                    items: p.items.map((it) => {
                      const l = lines.find((x) => x.itemId === it.id);
                      return l && l.quantity > 0 ? { ...it, receivedQty: it.receivedQty + l.quantity } : it;
                    }),
                    status:
                      p.items.every((it) => {
                        const l = lines.find((x) => x.itemId === it.id);
                        return it.receivedQty + (l?.quantity ?? 0) >= it.orderedQty;
                      })
                        ? "received"
                        : "partially_received",
                  }
                : p,
            ),
          }));

          for (const it of recItems) {
            move({
              date: receiving.date.slice(0, 10), type: "purchase_receive", medicineId: it.medicineId, medicineName: it.medicineName,
              batchId: it.batchId, batchNo: it.batchNo, qtyIn: it.quantity, qtyOut: 0, unitCost: it.unitCost,
              refNo: purchase.refNo, note: `Received from ${purchase.supplierName}`, userName: receivedBy,
            });
          }
          // Supplier payable increases by received value
          set((s) => ({
            suppliers: s.suppliers.map((sup) => (sup.id === purchase.supplierId ? { ...sup, openingBalance: sup.openingBalance + receiving.total } : sup)),
          }));
          logAct("purchase_receive", `${receiving.receiveNo} — ${purchase.refNo} — ${recItems.length} items received`);
          return receiving;
        },
        cancelPurchase(purchaseId) {
          set((s) => ({
            purchases: s.purchases.map((p) => (p.id === purchaseId ? { ...p, status: "cancelled" as const } : p)),
          }));
          logAct("purchase_cancel", `Cancelled purchase ${purchaseId}`);
        },

        // ── returns ──
        createSalesReturn(input) {
          const sale = get().sales.find((s) => s.id === input.saleId);
          if (!sale) return { error: "Invoice not found" };
          const items: SalesReturn["items"] = [];
          for (const l of input.items) {
            const si = sale.items.find((x) => x.id === l.saleItemId);
            if (!si || l.quantity <= 0) continue;
            const already = get()
              .salesReturns.filter((r) => r.saleId === sale.id)
              .flatMap((r) => r.items.filter((i) => i.saleItemId === si.id))
              .reduce((s, i) => s + i.quantity, 0);
            if (already + l.quantity > si.quantity) return { error: `Cannot return more than sold for ${si.medicineName} (sold ${si.quantity}, already returned ${already})` };
            const refund = Math.round((si.total / si.quantity) * l.quantity);
            items.push({
              id: uid("sri"), saleItemId: si.id, medicineId: si.medicineId, medicineName: si.medicineName,
              batchId: si.batchId, batchNo: si.batchNo, quantity: l.quantity, unitPrice: si.unitPrice,
              refundAmount: refund, restock: l.restock,
            });
          }
          if (!items.length) return { error: "Select at least one item to return" };
          const st: SalesReturn = {
            id: uid("sr"), returnNo: docNo("SR", get().salesReturns.length + 1),
            date: new Date().toISOString(), saleId: sale.id, invoiceNo: sale.invoiceNo,
            customerId: sale.customerId, customerName: sale.customerName,
            items, reason: input.reason, totalRefund: items.reduce((s, i) => s + i.refundAmount, 0),
            restockMethod: input.restockMethod,
          };
          set((s) => ({
            salesReturns: [st, ...s.salesReturns],
            sales: s.sales.map((sa) =>
              sa.id === sale.id
                ? {
                    ...sa,
                    status:
                      sa.items.every((si) => {
                        const returned = st.items.filter((i) => i.saleItemId === si.id).reduce((x, i) => x + i.quantity, 0);
                        return returned >= si.quantity;
                      })
                        ? "returned"
                        : "partially_returned",
                  }
                : sa,
            ),
          }));
          // Restock eligible batches
          for (const it of items) {
            if (it.restock) {
              set((s) => ({
                medicines: s.medicines.map((m) =>
                  m.id === it.medicineId
                    ? { ...m, batches: m.batches.map((b) => (b.id === it.batchId ? { ...b, quantity: b.quantity + it.quantity } : b)) }
                    : m,
                ),
              }));
              move({
                date: todayISO(), type: "sale_return", medicineId: it.medicineId, medicineName: it.medicineName,
                batchId: it.batchId, batchNo: it.batchNo, qtyIn: it.quantity, qtyOut: 0, unitCost: it.refundAmount / it.quantity,
                refNo: st.returnNo, note: `Restocked (return of ${sale.invoiceNo})`, userName: get().currentUser?.name ?? "System",
              });
            }
          }
          if (input.restockMethod === "cash_refund") {
            cash({ date: todayISO(), direction: "out", category: "sales_return", refNo: st.returnNo, description: `Refund for ${sale.invoiceNo}`, amount: st.totalRefund, method: "cash" });
          }
          logAct("sales_return", `${st.returnNo} — ${sale.invoiceNo} — refund ${st.totalRefund}`);
          return st;
        },
        createPurchaseReturn(input) {
          const purchase = get().purchases.find((p) => p.id === input.purchaseId);
          if (!purchase) return { error: "Purchase not found" };
          const items: PurchaseReturn["items"] = [];
          for (const l of input.items) {
            const pitem = purchase.items.find((x) => x.id === l.itemId);
            if (!pitem || l.quantity <= 0) continue;
            const already = get()
              .purchaseReturns.filter((r) => r.purchaseId === purchase.id)
              .flatMap((r) => r.items.filter((i) => i.batchId === l.batchId))
              .reduce((s, i) => s + i.quantity, 0);
            const batch = get().medicines.find((m) => m.id === pitem.medicineId)?.batches.find((b) => b.id === l.batchId);
            if (!batch) return { error: `Batch not found for ${pitem.medicineName}` };
            if (already + l.quantity > batch.quantity) {
              return { error: `Cannot return more than available in stock for ${pitem.medicineName} (batch ${batch.batchNo}, available ${batch.quantity})` };
            }
            items.push({
              id: uid("pri"), medicineId: pitem.medicineId, medicineName: pitem.medicineName, batchId: l.batchId,
              batchNo: batch.batchNo, quantity: l.quantity, unitCost: batch.purchasePrice,
              refundAmount: l.quantity * batch.purchasePrice,
            });
          }
          if (!items.length) return { error: "Select at least one item to return" };
          const pr: PurchaseReturn = {
            id: uid("pr"), returnNo: docNo("PR", get().purchaseReturns.length + 1),
            date: new Date().toISOString(), purchaseId: purchase.id, refNo: purchase.refNo,
            supplierId: purchase.supplierId, supplierName: purchase.supplierName,
            items, reason: input.reason, totalRefund: items.reduce((s, i) => s + i.refundAmount, 0),
          };
          set((s) => ({
            purchaseReturns: [pr, ...s.purchaseReturns],
            medicines: s.medicines.map((m) => {
              const updates = items.filter((i) => i.medicineId === m.id);
              if (!updates.length) return m;
              return {
                ...m,
                batches: m.batches.map((b) => {
                  const u = updates.find((x) => x.batchId === b.id);
                  return u ? { ...b, quantity: b.quantity - u.quantity } : b;
                }),
              };
            }),
            suppliers: s.suppliers.map((sup) => (sup.id === purchase.supplierId ? { ...sup, openingBalance: sup.openingBalance - pr.totalRefund } : sup)),
          }));
          for (const it of items) {
            move({
              date: todayISO(), type: "purchase_return", medicineId: it.medicineId, medicineName: it.medicineName,
              batchId: it.batchId, batchNo: it.batchNo, qtyIn: 0, qtyOut: it.quantity, unitCost: it.unitCost,
              refNo: pr.returnNo, note: `Returned to ${purchase.supplierName}`, userName: get().currentUser?.name ?? "System",
            });
          }
          logAct("purchase_return", `${pr.returnNo} — ${purchase.refNo} — value ${pr.totalRefund}`);
          return pr;
        },

        // ── issuance & transfer ──
        createIssuance(input) {
          const items: Issuance["items"] = [];
          for (const l of input.items) {
            const med = get().medicines.find((m) => m.id === l.medicineId);
            if (!med) return { error: "Medicine not found" };
            const batch = med.batches.find((b) => b.id === l.batchId);
            if (!batch) return { error: `Batch not found for ${med.name}` };
            if (l.quantity <= 0) continue;
            if (batch.quantity < l.quantity) return { error: `Insufficient stock for ${med.name} batch ${batch.batchNo} (available ${batch.quantity})` };
            items.push({
              id: uid("ii"), medicineId: med.id, medicineName: med.name, batchId: batch.id, batchNo: batch.batchNo,
              quantity: l.quantity, unitCost: batch.purchasePrice,
            });
          }
          if (!items.length) return { error: "Add at least one item to issue" };
          const iss: Issuance = {
            id: uid("iss"), voucherNo: docNo("ISS", get().issuances.length + 1), date: new Date().toISOString(),
            destination: input.destination, reason: input.reason, authorizedBy: input.authorizedBy,
            items, totalValue: items.reduce((s, i) => s + i.quantity * i.unitCost, 0), notes: input.notes,
          };
          set((s) => ({
            issuances: [iss, ...s.issuances],
            medicines: s.medicines.map((m) => {
              const updates = items.filter((i) => i.medicineId === m.id);
              if (!updates.length) return m;
              return {
                ...m,
                batches: m.batches.map((b) => {
                  const u = updates.find((x) => x.batchId === b.id);
                  return u ? { ...b, quantity: b.quantity - u.quantity } : b;
                }),
              };
            }),
          }));
          for (const it of items) {
            move({
              date: todayISO(), type: input.reason === "expired" ? "expiry_removal" : "issuance", medicineId: it.medicineId,
              medicineName: it.medicineName, batchId: it.batchId, batchNo: it.batchNo, qtyIn: 0, qtyOut: it.quantity,
              unitCost: it.unitCost, refNo: iss.voucherNo, note: input.reason.replace("_", " "), userName: get().currentUser?.name ?? "System",
            });
          }
          logAct("issuance", `${iss.voucherNo} — ${iss.reason} — value ${iss.totalValue}`);
          return iss;
        },
        createTransfer(input) {
          const items: StockTransfer["items"] = [];
          for (const l of input.items) {
            const med = get().medicines.find((m) => m.id === l.medicineId);
            if (!med) return { error: "Medicine not found" };
            const batch = med.batches.find((b) => b.id === l.batchId);
            if (!batch) return { error: `Batch not found for ${med.name}` };
            if (batch.quantity < l.quantity) return { error: `Insufficient stock for ${med.name} batch ${batch.batchNo}` };
            items.push({ id: uid("ti"), medicineId: med.id, medicineName: med.name, batchId: batch.id, batchNo: batch.batchNo, quantity: l.quantity });
          }
          if (!items.length) return { error: "Add at least one item to transfer" };
          const tr: StockTransfer = {
            id: uid("tr"), transferNo: docNo("TRF", get().transfers.length + 1), date: new Date().toISOString(),
            fromLocation: input.fromLocation, toLocation: input.toLocation, authorizedBy: input.authorizedBy,
            items, notes: input.notes,
          };
          set((s) => ({ transfers: [tr, ...s.transfers] }));
          for (const it of items) {
            move({
              date: todayISO(), type: "transfer", medicineId: it.medicineId, medicineName: it.medicineName,
              batchId: it.batchId, batchNo: it.batchNo, qtyIn: it.quantity, qtyOut: 0, unitCost: 0,
              refNo: tr.transferNo, note: `${input.fromLocation} → ${input.toLocation}`, userName: get().currentUser?.name ?? "System",
            });
          }
          logAct("transfer", `${tr.transferNo} — ${input.fromLocation} → ${input.toLocation}`);
          return tr;
        },

        // ── finance ──
        addExpense(e) {
          const exp: Expense = {
            ...e, id: uid("exp"), expenseNo: docNo("EXP", get().expenses.length + 1),
            recordedBy: get().currentUser?.name ?? "System",
          };
          set((s) => ({ expenses: [exp, ...s.expenses] }));
          cash({ date: exp.date, direction: "out", category: "expense", refNo: exp.expenseNo, description: exp.description, amount: exp.amount, method: exp.method });
          logAct("expense_add", `${exp.expenseNo} — ${exp.category} — ${exp.amount}`);
          return exp;
        },
        deleteExpense(id) {
          const exp = get().expenses.find((e) => e.id === id);
          set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));
          if (exp) {
            set((s) => ({ cashEntries: s.cashEntries.filter((c) => c.refNo !== exp.expenseNo) }));
          }
        },

        // ── staff & settings ──
        addUser(u) {
          const user: StaffUser = { ...u, id: uid("usr"), createdAt: new Date().toISOString() };
          set((s) => ({ users: [...s.users, user] }));
          logAct("staff_add", `Added user ${user.name} (${user.role})`);
        },
        updateUser(id, patch) {
          set((s) => ({
            users: s.users.map((u) => (u.id === id ? { ...u, ...patch, id: u.id } : u)),
            currentUser: s.currentUser && s.currentUser.id === id ? { ...s.currentUser, ...patch, id: s.currentUser.id } : s.currentUser,
          }));
          logAct("staff_update", `Updated user ${patch.name ?? id}`);
        },
        deleteUser(id) {
          set((s) => ({ users: s.users.filter((u) => u.id !== id) }));
          logAct("staff_delete", `Deleted user ${id}`);
        },
        updateSettings(patch) {
          set((s) => ({ settings: { ...s.settings, ...patch } }));
          logAct("settings_update", `Updated settings: ${Object.keys(patch).join(", ")}`);
        },
        resetDemoData() {
          const fresh = freshState();
          set({ ...fresh, demoCleared: false, _hydrated: true });
        },
        clearAllData() {
          set({
            medicines: [], suppliers: [], customers: [], sales: [], purchases: [], receivings: [],
            issuances: [], transfers: [], salesReturns: [], purchaseReturns: [], supplierPayments: [],
            customerPayments: [], expenses: [], movements: [], cashEntries: [], activityLog: [],
            demoCleared: true,
            _hydrated: true,
          });
        },
      };
    },
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => {
        const { _hydrated, ...rest } = s;
        void _hydrated;
        return rest as AppStore;
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) console.warn("Store rehydrate error", error);
        ensureSeeded();
      },
    }
  )
);

/** Called after (re)hydration: repair missing demo data sections, mark hydrated.
 *  If the user explicitly cleared all data (demoCleared), we respect that and
 *  never reseed. Otherwise any empty core section (e.g. medicines wiped by an
 *  interrupted save) is topped up from the seed so pages are never empty. */
export function ensureSeeded() {
  const s = useStore.getState();
  if (s.demoCleared) {
    useStore.setState({ _hydrated: true });
    return;
  }
  if (
    s.medicines.length === 0 || s.users.length === 0 || s.suppliers.length === 0 ||
    s.customers.length === 0
  ) {
    const fresh = freshState();
    useStore.setState({
      ...(s.medicines.length === 0 ? { medicines: fresh.medicines } : null),
      ...(s.users.length === 0 ? { users: fresh.users } : null),
      ...(s.suppliers.length === 0 ? { suppliers: fresh.suppliers } : null),
      ...(s.customers.length === 0 ? { customers: fresh.customers } : null),
      ...(s.expenses.length === 0 ? { expenses: fresh.expenses } : null),
      _hydrated: true,
    } as Partial<AppStore>);
  } else {
    useStore.setState({ _hydrated: true });
  }
}

// ─── Derived helpers ─────────────────────────────────────────────────────────

export function getCustomerBalance(
  customers: Customer[], customerId: string, sales: Sale[], payments: CustomerPayment[]
) {
  const cus = customers.find((c) => c.id === customerId);
  if (!cus) return 0;
  const billed = sales
    .filter((s) => s.customerId === customerId && s.status !== "returned")
    .reduce((sum, s) => sum + (s.total - s.paidAmount), 0);
  const paid = payments.filter((p) => p.customerId === customerId).reduce((sum, p) => sum + p.amount, 0);
  const returnedRefunds = 0;
  void returnedRefunds;
  return Math.round(cus.openingBalance + billed - paid);
}

export function getSupplierBalance(suppliers: Supplier[], supplierId: string, purchases: Purchase[], payments: SupplierPayment[]) {
  const sup = suppliers.find((c) => c.id === supplierId);
  if (!sup) return 0;
  const received = purchases
    .filter((p) => p.supplierId === supplierId && p.status !== "cancelled")
    .reduce((sum, p) => sum + (p.status === "ordered" ? 0 : p.items.reduce((s, it) => s + it.receivedQty * it.unitCost, 0)), 0);
  const paid = payments.filter((p) => p.supplierId === supplierId).reduce((sum, p) => sum + p.amount, 0);
  return Math.round(sup.openingBalance + received - paid);
}

/** All stock movements for a medicine, newest first */
export function medicineMovements(movements: InventoryMovement[], medicineId: string) {
  return movements.filter((m) => m.medicineId === medicineId);
}

/** Batches including zero-qty (for inventory detail views) */
export function allBatches(m: Medicine) {
  return [...m.batches].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

export { liveBatches };
