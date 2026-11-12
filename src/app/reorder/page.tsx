"use client";

import { useMemo, useState } from "react";
import { Lightbulb, Download, Printer, ShoppingCart, CheckSquare, Square, TrendingDown, AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/store";
import { sellableStock } from "@/lib/stock";
import { Card, Button, Select, Badge, EmptyState, PageHeader, TableWrap, Th, Td, StatCard, Modal } from "@/components/ui";
import { toast } from "@/components/toast";
import { formatCurrency, formatDate, addDays, downloadCSV, printArea, todayISO, cn } from "@/lib/utils";

const LEAD_DAYS = 7;   // supplier lead time
const SAFETY_DAYS = 3; // safety buffer
const TARGET_DAYS = 14; // restock target cover

interface Advice {
  medicineId: string;
  name: string;
  generic: string;
  sku: string;
  category: string;
  stock: number;
  minStock: number;
  avgDaily: number;
  reorderPoint: number;
  daysCover: number | null; // null = no recent sales
  suggestedQty: number;
  unitCost: number;
  estCost: number;
  supplierId: string;
  supplierName: string;
  urgent: boolean;
}

export default function ReorderPage() {
  const store = useStore();
  const medicines = useStore((s) => s.medicines);
  const sales = useStore((s) => s.sales);
  const suppliers = useStore((s) => s.suppliers);
  const settings = useStore((s) => s.settings);

  const [onlyNeeded, setOnlyNeeded] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [poSupplier, setPoSupplier] = useState("");
  const [poOpen, setPoOpen] = useState(false);
  const [poAdvice, setPoAdvice] = useState<Advice[]>([]);

  const cur = settings.currency;
  const fmt = (n: number) => formatCurrency(n, cur);

  const adviceList = useMemo<Advice[]>(() => {
    const cutoff = addDays(todayISO(), -30);
    // units sold per medicine in the last 30 days
    const sold = new Map<string, number>();
    for (const sale of sales) {
      if (sale.date.slice(0, 10) < cutoff) continue;
      if (sale.status === "returned") continue;
      for (const it of sale.items) sold.set(it.medicineId, (sold.get(it.medicineId) ?? 0) + it.quantity);
    }
    const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));

    const list = medicines.map((m): Advice => {
      const stock = sellableStock(m);
      const avgDaily = (sold.get(m.id) ?? 0) / 30;
      const lastCost = [...m.batches].sort((a, b) => b.receivedDate.localeCompare(a.receivedDate))[0]?.purchasePrice
        ?? Math.round(m.retailPrice * 0.75);
      const reorderPoint = Math.max(m.minStockLevel, Math.ceil(avgDaily * LEAD_DAYS + SAFETY_DAYS));
      const daysCover = avgDaily > 0 ? Math.floor(stock / avgDaily) : null;
      let suggestedQty = Math.max(0, reorderPoint - stock);
      if (avgDaily > 0) suggestedQty = Math.max(suggestedQty, Math.max(0, Math.ceil(avgDaily * TARGET_DAYS) - stock));
      return {
        medicineId: m.id,
        name: m.name,
        generic: m.genericName,
        sku: m.sku,
        category: m.category,
        stock,
        minStock: m.minStockLevel,
        avgDaily: Math.round(avgDaily * 100) / 100,
        reorderPoint,
        daysCover,
        suggestedQty,
        unitCost: lastCost,
        estCost: suggestedQty * lastCost,
        supplierId: m.supplierId,
        supplierName: supplierName.get(m.supplierId) ?? "—",
        urgent: stock <= Math.max(0, Math.round(m.minStockLevel * 0.5)) || (daysCover !== null && daysCover <= LEAD_DAYS),
      };
    });

    const needs = list.filter((a) => a.suggestedQty > 0 || a.stock <= a.minStock);
    return onlyNeeded ? needs.sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.stock - b.stock) : list.sort((a, b) => a.name.localeCompare(b.name));
  }, [medicines, sales, suppliers, onlyNeeded]);

  const totalEstCost = useMemo(() => adviceList.reduce((s, a) => s + a.estCost, 0), [adviceList]);
  const urgentCount = useMemo(() => adviceList.filter((a) => a.urgent && a.suggestedQty > 0).length, [adviceList]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function openPOModal() {
    const items = adviceList.filter((a) => selected.has(a.medicineId) && a.suggestedQty > 0);
    if (!items.length) { toast.error("Nothing selected", "Select medicines with a suggested quantity first."); return; }
    const sups = [...new Set(items.map((i) => i.supplierId))];
    if (sups.length === 1) setPoSupplier(sups[0]);
    else if (!poSupplier) setPoSupplier(sups[0] ?? "");
    setPoAdvice(items);
    setPoOpen(true);
  }

  function createPO() {
    if (!poSupplier) { toast.error("Select a supplier"); return; }
    const items = poAdvice.map((a) => ({
      medicineId: a.medicineId,
      medicineName: a.name,
      orderedQty: a.suggestedQty,
      unitCost: a.unitCost,
      batchNo: "",
      mfgDate: "",
      expiryDate: "",
    }));
    const p = store.createPurchase({ supplierId: poSupplier, items, discount: 0, tax: 0, paidAmount: 0, receiveNow: false, notes: "Auto-created from Reorder Advisor" });
    toast.success("Purchase order created", `${p.refNo} — ${items.length} items · ${fmt(p.total)}`);
    setSelected(new Set());
    setPoOpen(false);
    setPoAdvice([]);
  }

  function exportCSV() {
    downloadCSV("reorder-advice", adviceList.map((a) => ({
      Medicine: a.name, Generic: a.generic, SKU: a.sku, Category: a.category,
      "Live Stock": a.stock, "Min Level": a.minStock, "Avg Daily Sales": a.avgDaily,
      "Reorder Point": a.reorderPoint, "Days Cover": a.daysCover ?? "—",
      "Suggested Qty": a.suggestedQty, "Unit Cost": a.unitCost, "Est. Cost": a.estCost,
      Supplier: a.supplierName, Urgent: a.urgent ? "yes" : "no",
    })));
    toast.success("Exported", `${adviceList.length} reorder suggestions`);
  }

  function printAdvice() {
    const head = `<th>Medicine</th><th>Stock</th><th>Min</th><th>Avg/Day</th><th>Cover</th><th>Suggested</th><th class="num">Est. Cost</th><th>Supplier</th>`;
    const body = adviceList.map((a) =>
      `<tr><td>${a.name}<br/><span style="font-size:10px;color:#777">${a.generic}</span></td><td>${a.stock}</td><td>${a.minStock}</td><td>${a.avgDaily}</td><td>${a.daysCover === null ? "—" : a.daysCover + " d"}</td><td><b>${a.suggestedQty}</b></td><td class="num">${fmt(a.estCost)}</td><td>${a.supplierName}</td></tr>`
    ).join("");
    printArea(`<div class="invoice"><div class="inv-head"><div><div class="inv-logo">${settings.pharmacyName}</div><div class="muted" style="font-size:11px">${settings.address}</div></div>
      <div style="text-align:right"><div style="font-size:16px;font-weight:700">REORDER ADVISORY</div>
      <div class="muted" style="font-size:12px">Generated ${formatDate(todayISO())} · ${adviceList.length} items</div></div></div>
      <table class="mt16"><thead><tr>${head}</tr></thead><tbody>${body || '<tr><td colspan="8" class="center muted">Nothing to reorder</td></tr>'}</tbody></table>
      <div style="display:flex;justify-content:flex-end;margin-top:10px"><table class="totals"><tr><td style="font-weight:700">Total Estimated Cost</td><td class="num" style="font-weight:700">${fmt(totalEstCost)}</td></tr></table></div>
      <div class="mt8 muted" style="font-size:10px;text-align:center">Demonstration document</div></div>`, "Reorder Advisory");
  }

  const allSelected = adviceList.length > 0 && adviceList.every((a) => selected.has(a.medicineId));

  return (
    <div>
      <PageHeader title="Reorder Advisor" subtitle="Smart purchase suggestions from sales velocity, stock levels and lead time"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={printAdvice}><Printer className="h-4 w-4" /> Print</Button>
            <Button size="sm" onClick={openPOModal}><ShoppingCart className="h-4 w-4" /> Create PO ({selected.size})</Button>
          </>
        } />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Items to Reorder" value={String(adviceList.filter((a) => a.suggestedQty > 0).length)} icon={<Lightbulb className="h-5 w-5" />} tone="navy" />
        <StatCard label="Urgent (cover ≤ lead time)" value={String(urgentCount)} icon={<AlertTriangle className="h-5 w-5" />} tone="red" />
        <StatCard label="Estimated Order Cost" value={fmt(totalEstCost)} icon={<ShoppingCart className="h-5 w-5" />} tone="amber" />
        <StatCard label="Suppliers Involved" value={String(new Set(adviceList.map((a) => a.supplierId)).size)} icon={<TrendingDown className="h-5 w-5" />} tone="green" />
      </div>

      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setOnlyNeeded(!onlyNeeded)} className="flex items-center gap-2 text-[13px] text-slate-600 hover:text-slate-800">
            {onlyNeeded ? <CheckSquare className="h-4 w-4 text-emerald-500" /> : <Square className="h-4 w-4 text-slate-300" />}
            Only show medicines that need reordering
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setSelected(new Set(adviceList.map((a) => a.medicineId)))}>Select all</Button>
            <Button size="sm" variant="secondary" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </div>
      </Card>

      <Card>
        <TableWrap>
          <table className="w-full min-w-[900px]">
            <thead>
              <tr>
                <Th className="w-10"><button onClick={() => setSelected(allSelected ? new Set() : new Set(adviceList.map((a) => a.medicineId)))}>
                  {allSelected ? <CheckSquare className="h-4 w-4 text-emerald-500" /> : <Square className="h-4 w-4 text-slate-300" />}
                </button></Th>
                <Th>Medicine</Th><Th>Status</Th><Th className="text-right">Live Stock</Th><Th className="text-right">Min Level</Th>
                <Th className="text-right">Avg/Day</Th><Th className="text-right">Days Cover</Th>
                <Th className="text-right">Suggested Qty</Th><Th className="text-right">Est. Cost</Th><Th>Supplier</Th>
              </tr>
            </thead>
            <tbody>
              {adviceList.map((a) => (
                <tr key={a.medicineId} className={cn(selected.has(a.medicineId) && "bg-navy-50/60")}>
                  <Td><button onClick={() => toggle(a.medicineId)}>
                    {selected.has(a.medicineId) ? <CheckSquare className="h-4 w-4 text-emerald-500" /> : <Square className="h-4 w-4 text-slate-300" />}
                  </button></Td>
                  <Td>
                    <div className="font-medium text-slate-800">{a.name}</div>
                    <div className="text-[11px] text-slate-400">{a.generic} · {a.sku}</div>
                  </Td>
                  <Td>
                    {a.urgent && a.suggestedQty > 0 ? <Badge tone="red">Urgent</Badge> :
                      a.suggestedQty > 0 ? <Badge tone="amber">Reorder</Badge> :
                        <Badge tone="green">Healthy</Badge>}
                  </Td>
                  <Td className={cn("text-right font-semibold", a.stock <= a.minStock ? "text-rose-600" : "text-slate-700")}>{a.stock}</Td>
                  <Td className="text-right">{a.minStock}</Td>
                  <Td className="text-right">{a.avgDaily}</Td>
                  <Td className="text-right">{a.daysCover === null ? <span className="text-slate-300">—</span> : <span className={cn(a.daysCover <= LEAD_DAYS && "font-bold text-rose-600")}>{a.daysCover} d</span>}</Td>
                  <Td className="text-right font-bold text-navy-800">{a.suggestedQty > 0 ? a.suggestedQty : "—"}</Td>
                  <Td className="text-right">{a.suggestedQty > 0 ? fmt(a.estCost) : "—"}</Td>
                  <Td><span className="text-[12px] text-slate-500">{a.supplierName}</span></Td>
                </tr>
              ))}
              {!adviceList.length && (
                <tr><Td colSpan={10}><EmptyState icon={<Lightbulb className="h-7 w-7" />} title="Nothing to reorder" message="All medicines are above their reorder points. Try turning off the filter to review the full catalogue." /></Td></tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <p className="mt-3 text-[11px] text-slate-400">
        Logic: reorder point = max(min stock level, avg daily sales × {LEAD_DAYS}-day supplier lead time + {SAFETY_DAYS}-day safety buffer). Suggested quantity tops stock up to {TARGET_DAYS} days of cover. Costs use the latest batch purchase price.
      </p>

      <Modal
        open={poOpen} onClose={() => setPoOpen(false)}
        title="Create Purchase Order from Advice"
        subtitle={`${poAdvice.length} items · estimated ${fmt(poAdvice.reduce((s, a) => s + a.estCost, 0))}`} size="md"
        footer={<div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPoOpen(false)}>Cancel</Button>
          <Button onClick={createPO}><ShoppingCart className="h-4 w-4" /> Create PO</Button>
        </div>}>
        <div className="space-y-3">
          <Select value={poSupplier} onChange={(e) => setPoSupplier(e.target.value)}>
            <option value="">Select supplier…</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.companyName})</option>)}
          </Select>
          <TableWrap>
            <table className="w-full">
              <thead><tr><Th>Item</Th><Th className="text-right">Qty</Th><Th className="text-right">Unit Cost</Th><Th className="text-right">Total</Th></tr></thead>
              <tbody>
                {poAdvice.map((a) => (
                  <tr key={a.medicineId}>
                    <Td>{a.name}</Td>
                    <Td className="text-right font-semibold">{a.suggestedQty}</Td>
                    <Td className="text-right">{fmt(a.unitCost)}</Td>
                    <Td className="text-right">{fmt(a.suggestedQty * a.unitCost)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <p className="text-[11px] text-slate-400">The PO is created with status “ordered”. Receive it later from the Receiving module to add batches into stock.</p>
        </div>
      </Modal>
    </div>
  );
}
