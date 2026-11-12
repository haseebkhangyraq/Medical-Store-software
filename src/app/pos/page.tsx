"use client";

import { useMemo, useState } from "react";
import {
  Search, Plus, Minus, Trash2, ShoppingCart, Barcode, TriangleAlert, CreditCard,
  Banknote, Landmark, Smartphone, Layers, UserPlus, CheckCircle2, ReceiptText, Printer, FileDown,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, Button, Input, Select, Badge, Modal, Field, EmptyState, Alert, Tabs } from "@/components/ui";
import { toast } from "@/components/toast";
import { formatCurrency, cn } from "@/lib/utils";
import { sellableStock, liveBatches } from "@/lib/stock";
import { printReceipt, printInvoice } from "@/components/prints";
import type { PaymentMethod, Sale, SplitPaymentPart, Customer } from "@/lib/types";

const METHODS: { id: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { id: "cash", label: "Cash", icon: <Banknote className="h-4 w-4" /> },
  { id: "card", label: "Card", icon: <CreditCard className="h-4 w-4" /> },
  { id: "bank_transfer", label: "Bank Transfer", icon: <Landmark className="h-4 w-4" /> },
  { id: "mobile_wallet", label: "Mobile Wallet", icon: <Smartphone className="h-4 w-4" /> },
  { id: "split", label: "Split", icon: <Layers className="h-4 w-4" /> },
];

interface Line {
  key: string;
  medicineId: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  batchId: string | null; // null = FEFO auto
}

export default function POSPage() {
  const store = useStore();
  const medicines = useStore((s) => s.medicines);
  const customers = useStore((s) => s.customers);
  const settings = useStore((s) => s.settings);
  const createSale = useStore((s) => s.createSale);
  const addCustomer = useStore((s) => s.addCustomer);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [lines, setLines] = useState<Line[]>([]);
  const [customerId, setCustomerId] = useState("walkin");
  const [discMode, setDiscMode] = useState<"amount" | "percent">("amount");
  const [discValue, setDiscValue] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [paidInput, setPaidInput] = useState("");
  const [splitParts, setSplitParts] = useState<SplitPaymentPart[]>([]);
  const [rxNote, setRxNote] = useState("");
  const [completed, setCompleted] = useState<Sale | null>(null);
  const [newCusOpen, setNewCusOpen] = useState(false);
  const [newCus, setNewCus] = useState({ name: "", phone: "", address: "" });
  const [mobileTab, setMobileTab] = useState<"products" | "cart">("products");
  const barcodeField = (
    <input
      placeholder="Barcode/SKU"
      className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-8 pr-1 text-sm text-slate-800 placeholder:text-slate-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/20 sm:pl-9"
      onKeyDown={(e) => { if (e.key === "Enter") { handleBarcode((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ""; } }}
    />
  );

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return medicines
      .filter((m) => (category === "all" ? true : m.category === category))
      .filter((m) =>
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.genericName.toLowerCase().includes(q) ||
        m.sku.toLowerCase().includes(q) ||
        m.barcode.includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [medicines, query, category]);

  const categories = useMemo(() => [...new Set(medicines.map((m) => m.category))].sort(), [medicines]);

  const addLine = (medicineId: string) => {
    const med = medicines.find((m) => m.id === medicineId);
    if (!med) return;
    const available = sellableStock(med, today);
    if (available <= 0) {
      toast.error("Out of stock", `${med.name} has no sellable (non-expired) stock.`);
      return;
    }
    setLines((prev) => {
      const existing = prev.find((l) => l.medicineId === medicineId);
      if (existing) {
        if (existing.quantity + 1 > available) {
          toast.error("Stock limit", `Only ${available} units of ${med.name} available for sale.`);
          return prev;
        }
        return prev.map((l) => (l.key === existing.key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        { key: `${medicineId}`, medicineId, unitPrice: med.retailPrice, quantity: 1, discount: 0, batchId: null },
      ];
    });
    setMobileTab("cart");
  };

  const handleBarcode = (value: string) => {
    const v = value.trim().toLowerCase();
    if (!v) return;
    const med = medicines.find((m) => m.barcode.toLowerCase() === v || m.sku.toLowerCase() === v);
    if (med) {
      addLine(med.id);
      setQuery("");
    } else {
      toast.error("Not found", `No medicine matches barcode/SKU "${value}"`);
    }
  };

  const cartDetails = useMemo(() => {
    let subtotal = 0, itemDiscountTotal = 0, taxTotal = 0, itemCount = 0;
    const rows = lines.map((l) => {
      const med = medicines.find((m) => m.id === l.medicineId)!;
      const tax = Math.round(((l.quantity * l.unitPrice - l.discount) * med.taxRate) / 100);
      const total = l.quantity * l.unitPrice - l.discount + tax;
      subtotal += l.quantity * l.unitPrice;
      itemDiscountTotal += l.discount;
      taxTotal += tax;
      itemCount += l.quantity;
      return { line: l, med, tax, total };
    });
    // Invoice discount supports Rs. (amount) or % (of net-of-item-discount subtotal)
    const raw = discMode === "percent"
      ? Math.round(((subtotal - itemDiscountTotal) * discValue) / 100)
      : Math.max(0, discValue);
    const invoiceDiscount = Math.min(Math.max(0, raw), Math.max(0, subtotal - itemDiscountTotal));
    const total = Math.max(0, subtotal - itemDiscountTotal - invoiceDiscount + taxTotal);
    const paid = paidInput === "" ? total : Number(paidInput) || 0;
    return { rows, subtotal, itemDiscountTotal, taxTotal: Math.round(taxTotal), total, paid, itemCount, invoiceDiscount };
  }, [lines, medicines, discValue, discMode, paidInput]);

  const hasRx = cartDetails.rows.some((r) => r.med.prescriptionRequired);

  const change = Math.max(0, cartDetails.paid - cartDetails.total);
  const balanceDue = Math.max(0, cartDetails.total - cartDetails.paid);
  const splitSum = splitParts.reduce((s, p) => s + p.amount, 0);

  const validate = (): string | null => {
    if (!lines.length) return "Cart is empty";
    if (method === "split") {
      if (!splitParts.length) return "Add at least one split payment part";
      if (Math.abs(splitSum - cartDetails.total) > 1) return `Split payments total ${splitSum} but invoice is ${cartDetails.total}`;
    } else if (cartDetails.paid < cartDetails.total) {
      const cus = customers.find((c) => c.id === customerId);
      if (!cus || cus.id === "walkin") return "Unpaid balance requires a registered customer (walk-in must pay in full)";
      if (cus.creditLimit <= 0) return `${cus.name} has no credit limit — full payment required`;
    }
    if (hasRx && !rxNote.trim()) return "A prescription reference note is required for prescription-only medicines";
    return null;
  };

  const checkout = () => {
    const err = validate();
    if (err) { toast.error("Cannot complete sale", err); return; }
    const result = createSale({
      lines: lines.map((l) => ({
        key: l.key, medicineId: l.medicineId, medicineName: medicines.find((m) => m.id === l.medicineId)?.name ?? "",
        unitPrice: l.unitPrice, quantity: l.quantity, discount: l.discount,
        taxRate: medicines.find((m) => m.id === l.medicineId)?.taxRate ?? 0,
        batchId: l.batchId ?? undefined,
      })),
      customerId: customerId === "walkin" ? "walkin" : customerId,
      invoiceDiscount: cartDetails.invoiceDiscount, paidAmount: cartDetails.paid, method,
      splitParts: method === "split" ? splitParts : undefined,
      prescriptionNote: rxNote || undefined,
    });
    if ("error" in result) {
      toast.error("Sale failed", result.error);
      return;
    }
    setCompleted(result);
    setLines([]); setDiscValue(0); setPaidInput(""); setMethod("cash"); setSplitParts([]); setRxNote("");
    setMobileTab("products");
    toast.success("Sale completed", `${result.invoiceNo} — ${formatCurrency(result.total, settings.currency)}`);
  };

  const saveNewCustomer = () => {
    if (!newCus.name.trim()) { toast.error("Name required"); return; }
    const cus = addCustomer({ name: newCus.name.trim(), phone: newCus.phone, address: newCus.address, type: "regular", creditLimit: 0 });
    setCustomerId(cus.id);
    setNewCusOpen(false);
    setNewCus({ name: "", phone: "", address: "" });
    toast.success("Customer added", cus.name);
  };

  const cur = settings.currency;
  const fmt = (n: number) => formatCurrency(n, cur);

  // ── product browser ──
  const productBrowser = (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, generic, SKU…"
            className="pl-9"
          />
        </div>
        <div className="relative w-10 sm:w-44">
          <Barcode className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          {barcodeField}
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button onClick={() => setCategory("all")} className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors", category === "all" ? "bg-navy-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>All</button>
        {categories.map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors", category === c ? "bg-navy-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>{c}</button>
        ))}
      </div>
      <div className="grid max-h-[560px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((m) => {
          const stock = sellableStock(m, today);
          const disabled = stock <= 0;
          return (
            <button
              key={m.id}
              onClick={() => addLine(m.id)}
              disabled={disabled}
              className={cn(
                "group rounded-xl border p-3 text-left transition-all",
                disabled ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60" : "border-slate-200 bg-white hover:border-navy-400 hover:shadow-card active:scale-[.98]"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-slate-800">{m.name}</div>
                  <div className="truncate text-[11px] text-slate-400">{m.genericName} · {m.brandName}</div>
                </div>
                {m.prescriptionRequired && <Badge tone="violet" className="shrink-0">Rx</Badge>}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[13px] font-bold text-navy-700">{fmt(m.retailPrice)}</span>
                <Badge tone={stock === 0 ? "red" : stock <= Math.max(m.minStockLevel, settings.lowStockThreshold) ? "amber" : "green"}>
                  {stock === 0 ? "Out" : `${stock} left`}
                </Badge>
              </div>
            </button>
          );
        })}
        {!filtered.length && <div className="col-span-full"><EmptyState title="No medicines found" message="Try a different search or category." /></div>}
      </div>
    </div>
  );

  // ── cart ──
  const cart = (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-2">
        {cartDetails.rows.map(({ line, med, total }) => {
          const batches = liveBatches(med, today);
          return (
            <div key={line.key} className="rounded-xl border border-slate-200 bg-white p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-slate-800">{med.name}</div>
                  <div className="text-[11px] text-slate-400">{med.unitType}{med.prescriptionRequired ? " · Rx" : ""}</div>
                </div>
                <button onClick={() => setLines((p) => p.filter((x) => x.key !== line.key))} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <div className="flex items-center rounded-lg border border-slate-200">
                  <button onClick={() => setLines((p) => p.map((x) => x.key === line.key ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))} className="p-1.5 text-slate-500 hover:bg-slate-50"><Minus className="h-3 w-3" /></button>
                  <input
                    type="number" value={line.quantity} min={1}
                    onChange={(e) => {
                      const q = Math.max(1, Math.floor(Number(e.target.value) || 1));
                      const avail = line.batchId ? (med.batches.find((b) => b.id === line.batchId)?.quantity ?? 0) : sellableStock(med, today);
                      if (q > avail) { toast.error("Stock limit", `Only ${avail} available`); return; }
                      setLines((p) => p.map((x) => x.key === line.key ? { ...x, quantity: q } : x));
                    }}
                    className="w-10 border-none bg-transparent text-center text-[13px] font-semibold focus:outline-none"
                  />
                  <button onClick={() => {
                    const avail = line.batchId ? (med.batches.find((b) => b.id === line.batchId)?.quantity ?? 0) : sellableStock(med, today);
                    if (line.quantity + 1 > avail) { toast.error("Stock limit", `Only ${avail} available`); return; }
                    setLines((p) => p.map((x) => x.key === line.key ? { ...x, quantity: x.quantity + 1 } : x));
                  }} className="p-1.5 text-slate-500 hover:bg-slate-50"><Plus className="h-3 w-3" /></button>
                </div>
                <Input
                  type="number" value={line.unitPrice} onChange={(e) => setLines((p) => p.map((x) => x.key === line.key ? { ...x, unitPrice: Math.max(0, Number(e.target.value) || 0) } : x))}
                  className="h-8 w-20 text-[13px]" title="Unit price"
                />
                <Input
                  type="number" value={line.discount} onChange={(e) => setLines((p) => p.map((x) => x.key === line.key ? { ...x, discount: Math.max(0, Number(e.target.value) || 0) } : x))}
                  className="h-8 w-20 text-[13px]" title="Line discount"
                />
                {batches.length > 1 && (
                  <Select
                    value={line.batchId ?? ""}
                    onChange={(e) => {
                      const v = e.target.value || null;
                      const avail = v ? med.batches.find((b) => b.id === v)?.quantity ?? 0 : sellableStock(med, today);
                      if (line.quantity > avail) { toast.error("Batch stock", `Only ${avail} in this batch`); return; }
                      setLines((p) => p.map((x) => x.key === line.key ? { ...x, batchId: v } : x));
                    }}
                    className="h-8 w-32 text-[12px]"
                    title="Batch (FEFO auto by default)"
                  >
                    <option value="">Auto (FEFO)</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>{b.batchNo} · exp {b.expiryDate.slice(0, 10)} ({b.quantity})</option>
                    ))}
                  </Select>
                )}
                <span className="ml-auto text-[13px] font-bold text-navy-700">{fmt(total)}</span>
              </div>
            </div>
          );
        })}
        {!lines.length && (
          <EmptyState icon={<ShoppingCart className="h-7 w-7" />} title="Cart is empty" message="Search or tap a medicine to add it to the sale." />
        )}
      </div>

      {/* totals + payment */}
      <div className="space-y-3 border-t border-slate-100 pt-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Customer">
            <div className="flex gap-1.5">
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="h-9">
                <option value="walkin">Walk-in Customer</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}
              </Select>
              <Button size="icon" variant="outline" onClick={() => setNewCusOpen(true)} title="New customer"><UserPlus className="h-4 w-4" /></Button>
            </div>
          </Field>
          <Field label="Invoice Discount">
            <div className="flex gap-1.5">
              <div className="flex overflow-hidden rounded-lg border border-slate-300">
                <button
                  type="button" onClick={() => setDiscMode("amount")}
                  className={cn("px-2 text-[12px] font-semibold transition-colors", discMode === "amount" ? "bg-navy-800 text-white" : "bg-white text-slate-500 hover:bg-slate-50")}
                  title="Discount in Rupees"
                >Rs</button>
                <button
                  type="button" onClick={() => setDiscMode("percent")}
                  className={cn("px-2 text-[12px] font-semibold transition-colors", discMode === "percent" ? "bg-navy-800 text-white" : "bg-white text-slate-500 hover:bg-slate-50")}
                  title="Discount as % of subtotal"
                >%</button>
              </div>
              <div className="relative flex-1">
                <Input
                  type="number" min={0} max={discMode === "percent" ? 100 : undefined}
                  value={discValue || ""}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0);
                    setDiscValue(discMode === "percent" ? Math.min(100, v) : v);
                  }}
                  placeholder="0" className="h-9 pr-7"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] font-medium text-slate-400">
                  {discMode === "percent" ? "%" : "Rs."}
                </span>
              </div>
            </div>
          </Field>
        </div>

        <div className="space-y-0.5 text-[13px]">
          <Row label={`Subtotal (${cartDetails.itemCount} units)`} value={fmt(cartDetails.subtotal)} />
          {cartDetails.itemDiscountTotal > 0 && <Row label="Item discounts" value={`−${fmt(cartDetails.itemDiscountTotal)}`} />}
          {cartDetails.invoiceDiscount > 0 && (
            <Row label={`Invoice discount${discMode === "percent" ? ` (${discValue}%)` : ""}`} value={`−${fmt(cartDetails.invoiceDiscount)}`} />
          )}
          {cartDetails.taxTotal > 0 && <Row label="Tax" value={fmt(cartDetails.taxTotal)} />}
          <div className="flex items-center justify-between rounded-lg bg-navy-50 px-2.5 py-2 font-bold text-navy-900">
            <span>Grand Total</span><span>{fmt(cartDetails.total)}</span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-1">
          {METHODS.map((m) => (
            <button
              key={m.id}
              onClick={() => { setMethod(m.id); if (m.id !== "split") setPaidInput(""); }}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[10px] font-medium transition-all",
                method === m.id ? "border-navy-600 bg-navy-800 text-white shadow-sm" : "border-slate-200 bg-white text-slate-500 hover:border-navy-300"
              )}
            >
              {m.icon}<span className="truncate">{m.label}</span>
            </button>
          ))}
        </div>

        {method === "split" ? (
          <div className="space-y-2 rounded-xl border border-slate-200 p-2.5">
            {splitParts.map((p, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Select value={p.method} onChange={(e) => setSplitParts((sp) => sp.map((x, j) => j === i ? { ...x, method: e.target.value as SplitPaymentPart["method"] } : x))} className="h-8 text-xs">
                  <option value="cash">Cash</option><option value="card">Card</option><option value="bank_transfer">Bank</option><option value="mobile_wallet">Wallet</option>
                </Select>
                <Input type="number" value={p.amount || ""} onChange={(e) => setSplitParts((sp) => sp.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) || 0 } : x))} className="h-8 text-xs" placeholder="Amount" />
                <button onClick={() => setSplitParts((sp) => sp.filter((_, j) => j !== i))} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <div className="flex items-center justify-between text-xs">
              <Button size="sm" variant="secondary" onClick={() => setSplitParts((sp) => [...sp, { method: "cash", amount: Math.max(0, cartDetails.total - splitSum) }])}>
                <Plus className="h-3.5 w-3.5" /> Add part
              </Button>
              <span className={cn("font-semibold", Math.abs(splitSum - cartDetails.total) <= 1 ? "text-emerald-600" : "text-rose-600")}>
                {fmt(splitSum)} / {fmt(cartDetails.total)}
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <Field label="Paid Amount">
              <Input type="number" value={paidInput} onChange={(e) => setPaidInput(e.target.value)} placeholder={String(cartDetails.total)} className="h-9" />
            </Field>
            <Field label="Change">
              <div className="flex h-9 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-semibold text-emerald-700">{fmt(change)}</div>
            </Field>
            <Field label="Balance Due">
              <div className={cn("flex h-9 items-center rounded-xl border px-3 text-[13px] font-semibold", balanceDue > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-400")}>
                {fmt(balanceDue)}
              </div>
            </Field>
          </div>
        )}

        {hasRx && (
          <Alert tone="amber" title="Prescription-only item in cart">
            <input value={rxNote} onChange={(e) => setRxNote(e.target.value)} placeholder="Prescription reference / doctor name…" className="mt-1 w-full rounded-lg border border-amber-300 bg-white/70 px-2 py-1 text-xs focus:outline-none" />
          </Alert>
        )}

        <Button variant="success" size="lg" className="w-full" onClick={checkout}>
          <CheckCircle2 className="h-5 w-5" /> Complete Sale — {fmt(cartDetails.total)}
        </Button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">POS — New Sale</h1>
          <p className="text-[13px] text-slate-500">FEFO batch deduction · Barcode & generic search · {settings.currency} billing</p>
        </div>
        <Badge tone="green">DEMO</Badge>
      </div>

      {/* Mobile tabs */}
      <div className="mb-3 lg:hidden">
        <Tabs active={mobileTab} onChange={(id) => setMobileTab(id as typeof mobileTab)}
          tabs={[{ id: "products", label: "Products" }, { id: "cart", label: `Cart (${cartDetails.itemCount})` }]} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className={cn("lg:col-span-3 xl:col-span-3", mobileTab !== "products" && "hidden lg:block")}>
          <Card className="p-3 sm:p-4">{productBrowser}</Card>
        </div>
        <div className={cn("lg:col-span-2", mobileTab !== "cart" && "hidden lg:block")}>
          <Card className="p-3 sm:p-4">{cart}</Card>
        </div>
      </div>

      {/* New customer modal */}
      <Modal open={newCusOpen} onClose={() => setNewCusOpen(false)} title="Add New Customer" size="sm"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setNewCusOpen(false)}>Cancel</Button><Button onClick={saveNewCustomer}>Save Customer</Button></div>}>
        <div className="space-y-3">
          <Field label="Full Name" required><Input value={newCus.name} onChange={(e) => setNewCus({ ...newCus, name: e.target.value })} placeholder="e.g. Muhammad Ali" /></Field>
          <Field label="Phone"><Input value={newCus.phone} onChange={(e) => setNewCus({ ...newCus, phone: e.target.value })} placeholder="03xx-xxxxxxx" /></Field>
          <Field label="Address"><Input value={newCus.address} onChange={(e) => setNewCus({ ...newCus, address: e.target.value })} placeholder="Area, city" /></Field>
        </div>
      </Modal>

      {/* Sale success modal */}
      <Modal
        open={!!completed}
        onClose={() => setCompleted(null)}
        title="Sale Completed"
        subtitle={completed ? `${completed.invoiceNo} · ${completed.customerName}` : ""}
        size="sm"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => completed && printReceipt(completed, settings)}><Printer className="h-4 w-4" /> Thermal Receipt</Button>
            <Button variant="dark" onClick={() => completed && printInvoice(completed, settings)}><ReceiptText className="h-4 w-4" /> A4 Invoice</Button>
            <Button variant="outline" onClick={() => completed && printInvoice(completed, settings)}><FileDown className="h-4 w-4" /> Save as PDF</Button>
            <Button variant="success" onClick={() => setCompleted(null)}>New Sale</Button>
          </div>
        }
      >
        {completed && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <div>
                <div className="text-lg font-bold text-emerald-800">{fmt(completed.total)}</div>
                <div className="text-xs text-emerald-700">{completed.items.length} items · paid {fmt(completed.paidAmount)} {completed.paymentMethod.replace("_", " ")}</div>
              </div>
            </div>
            {completed.changeReturned > 0 && (
              <div className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <span className="text-slate-500">Change to return: </span>
                <span className="font-bold text-slate-800">{fmt(completed.changeReturned)}</span>
              </div>
            )}
            {completed.paidAmount < completed.total && (
              <Alert tone="amber" title={`Balance due ${fmt(completed.total - completed.paidAmount)} added to ${completed.customerName}'s account`} />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-2.5 py-1 text-slate-600">
      <span className="text-xs">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}
