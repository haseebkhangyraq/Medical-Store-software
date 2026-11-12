"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, Layers, Download, TrendingUp, TrendingDown, Activity, AlertTriangle, PackageOpen, PackageX, ArrowUpDown } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, Button, Badge, EmptyState, PageHeader, SearchInput, TableWrap, Th, Td, StatCard, Tabs, Select } from "@/components/ui";
import { toast } from "@/components/toast";
import { formatCurrency, formatDate, downloadCSV, cn, daysUntil } from "@/lib/utils";
import { sellableStock, totalStock, stockValue, stockValueAll, expiryStatus } from "@/lib/stock";

export default function InventoryPage() {
  const store = useStore();
  const medicines = useStore((s) => s.medicines);
  const settings = useStore((s) => s.settings);
  const [tab, setTab] = useState("overview");
  const [q, setQ] = useState("");
  const [batchFilter, setBatchFilter] = useState("all");
  const [ledgerType, setLedgerType] = useState("all");

  const cur = settings.currency;
  const fmt = (n: number) => formatCurrency(n, cur);
  const today = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => {
    let low = 0, zero = 0, over = 0;
    for (const m of medicines) {
      const s = sellableStock(m, today);
      if (s === 0) zero++;
      else if (s <= Math.max(m.minStockLevel, settings.lowStockThreshold)) low++;
      else if (s > m.minStockLevel * 8) over++;
    }
    return { low, zero, over, value: stockValueAll(medicines), units: medicines.reduce((s, m) => s + totalStock(m), 0) };
  }, [medicines, settings.lowStockThreshold, today]);

  const batches = useMemo(() => {
    const query = q.trim().toLowerCase();
    return medicines
      .flatMap((m) => m.batches.map((b) => ({ med: m, batch: b })))
      .filter(({ med, batch }) => {
        if (query && !(med.name.toLowerCase().includes(query) || batch.batchNo.toLowerCase().includes(query))) return false;
        if (batchFilter === "all") return true;
        if (batchFilter === "in_stock" && batch.quantity <= 0) return false;
        if (batchFilter === "zero" && batch.quantity > 0) return false;
        const st = expiryStatus(batch.expiryDate, settings.expiryWarnDays, today);
        if (batchFilter === "expired" && st !== "expired") return false;
        if (batchFilter === "critical" && st !== "critical") return false;
        if (batchFilter === "low_stock") {
          const s = sellableStock(med, today);
          if (s > Math.max(med.minStockLevel, settings.lowStockThreshold)) return false;
        }
        return true;
      })
      .sort((a, b) => a.batch.expiryDate.localeCompare(b.batch.expiryDate));
  }, [medicines, q, batchFilter, settings.expiryWarnDays, settings.lowStockThreshold, today]);

  const movements = useMemo(() =>
    store.movements
      .filter((m) => (ledgerType === "all" ? true : m.type === ledgerType))
      .slice(0, 120),
  [store.movements, ledgerType]);

  function exportValuation() {
    downloadCSV("inventory-valuation", medicines.map((m) => ({
      SKU: m.sku, Name: m.name, Category: m.category, "Sellable Stock": sellableStock(m, today),
      "Total Stock": totalStock(m), "Min Level": m.minStockLevel,
      "Avg Cost": m.batches.length ? Math.round(m.batches.reduce((s, b) => s + b.purchasePrice * b.quantity, 0) / Math.max(1, totalStock(m))) : 0,
      "Stock Value": Math.round(stockValue(m)), "Retail Value": sellableStock(m, today) * m.retailPrice,
    })));
    toast.success("Exported", "Inventory valuation CSV downloaded");
  }

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Stock positions, batch ledger and valuation"
        actions={<Button variant="outline" size="sm" onClick={exportValuation}><Download className="h-4 w-4" /> Valuation CSV</Button>} />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Inventory Value" value={fmt(stats.value)} icon={<Boxes className="h-5 w-5" />} tone="violet" />
        <StatCard label="Total Units" value={stats.units.toLocaleString()} icon={<Layers className="h-5 w-5" />} tone="navy" />
        <StatCard label="Low Stock" value={String(stats.low)} icon={<AlertTriangle className="h-5 w-5" />} tone="amber" />
        <StatCard label="Out of Stock" value={String(stats.zero)} icon={<PackageX className="h-5 w-5" />} tone="red" />
        <StatCard label="Overstocked" value={String(stats.over)} icon={<PackageOpen className="h-5 w-5" />} tone="blue" />
      </div>

      <Tabs active={tab} onChange={setTab} className="mb-4 max-w-md"
        tabs={[{ id: "overview", label: "Stock Overview" }, { id: "batches", label: "Batch Ledger", count: batches.length }, { id: "movements", label: "Movement History" }]} />

      {tab === "overview" && (
        <Card>
          <TableWrap>
            <table className="w-full min-w-[760px]">
              <thead><tr><Th>Medicine</Th><Th>Rack</Th><Th className="text-right">Sellable</Th><Th className="text-right">Total</Th><Th className="text-right">Min</Th><Th className="text-right">Value</Th><Th>Status</Th></tr></thead>
              <tbody>
                {[...medicines].sort((a, b) => sellableStock(a, today) - sellableStock(b, today)).map((m) => {
                  const s = sellableStock(m, today);
                  const st = s === 0 ? "out" : s <= Math.max(m.minStockLevel, settings.lowStockThreshold) ? "low" : s > m.minStockLevel * 8 ? "over" : "ok";
                  return (
                    <tr key={m.id}>
                      <Td className="font-medium">{m.name}<div className="text-[11px] text-slate-400">{m.genericName}</div></Td>
                      <Td>{m.rackLocation}</Td>
                      <Td className="text-right font-semibold">{s}</Td>
                      <Td className="text-right">{totalStock(m)}</Td>
                      <Td className="text-right">{m.minStockLevel}</Td>
                      <Td className="text-right font-semibold">{fmt(stockValue(m))}</Td>
                      <Td>
                        {st === "out" ? <Badge tone="red">Out of stock</Badge> :
                         st === "low" ? <Badge tone="amber">Low stock</Badge> :
                         st === "over" ? <Badge tone="blue">Overstock</Badge> :
                         <Badge tone="green">Healthy</Badge>}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}

      {tab === "batches" && (
        <Card className="p-3">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search medicine or batch #" className="sm:max-w-xs" />
            <Select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)} className="sm:w-52">
              <option value="all">All batches</option>
              <option value="in_stock">In stock</option>
              <option value="zero">Zero / depleted</option>
              <option value="expired">Expired</option>
              <option value="critical">Expiring ≤ 30 days</option>
              <option value="low_stock">Medicines low on stock</option>
            </Select>
          </div>
          <TableWrap>
            <table className="w-full min-w-[820px]">
              <thead><tr><Th>Medicine</Th><Th>Batch #</Th><Th>Received</Th><Th>Expiry</Th><Th className="text-right">Cost</Th><Th className="text-right">Qty</Th><Th>Status</Th></tr></thead>
              <tbody>
                {batches.map(({ med, batch }) => {
                  const st = expiryStatus(batch.expiryDate, settings.expiryWarnDays, today);
                  return (
                    <tr key={batch.id}>
                      <Td className="font-medium">{med.name}</Td>
                      <Td className="font-mono text-[12px]">{batch.batchNo}</Td>
                      <Td>{formatDate(batch.receivedDate)}</Td>
                      <Td>{formatDate(batch.expiryDate)}</Td>
                      <Td className="text-right">{fmt(batch.purchasePrice)}</Td>
                      <Td className="text-right font-semibold">{batch.quantity}</Td>
                      <Td>
                        {st === "expired" ? <Badge tone="red">Expired</Badge> :
                         st === "critical" ? <Badge tone="amber">{daysUntil(batch.expiryDate)}d</Badge> :
                         st === "warning" ? <Badge tone="blue">{daysUntil(batch.expiryDate)}d</Badge> :
                         st === "notice" ? <Badge tone="blue">{daysUntil(batch.expiryDate)}d</Badge> :
                         batch.quantity === 0 ? <Badge tone="slate">Depleted</Badge> :
                         <Badge tone="green">{daysUntil(batch.expiryDate)}d</Badge>}
                      </Td>
                    </tr>
                  );
                })}
                {!batches.length && <tr><Td colSpan={7}><EmptyState title="No batches match" /></Td></tr>}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}

      {tab === "movements" && (
        <Card className="p-3">
          <div className="mb-3">
            <Select value={ledgerType} onChange={(e) => setLedgerType(e.target.value)} className="sm:w-56">
              <option value="all">All movement types</option>
              <option value="sale">Sales</option>
              <option value="purchase_receive">Purchases received</option>
              <option value="sale_return">Sales returns</option>
              <option value="purchase_return">Purchase returns</option>
              <option value="issuance">Issuances</option>
              <option value="transfer">Transfers</option>
              <option value="adjustment">Adjustments</option>
              <option value="expiry_removal">Expiry removals</option>
              <option value="opening">Opening stock</option>
            </Select>
          </div>
          <div className="max-h-[600px] space-y-1 overflow-y-auto">
            {movements.map((mv) => (
              <div key={mv.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", mv.qtyIn > 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                    {mv.qtyIn > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium text-slate-700">{mv.medicineName} <span className="text-slate-400">· {mv.batchNo}</span></div>
                    <div className="text-[11px] text-slate-400">{mv.type.replace("_", " ")} · {mv.refNo} · {formatDate(mv.date)} · {mv.note} · {mv.userName}</div>
                  </div>
                </div>
                <span className={cn("text-sm font-bold tabular-nums", mv.qtyIn > 0 ? "text-emerald-600" : "text-rose-600")}>
                  {mv.qtyIn > 0 ? `+${mv.qtyIn}` : `−${mv.qtyOut}`}
                </span>
              </div>
            ))}
            {!movements.length && <EmptyState icon={<Activity className="h-7 w-7" />} title="No movements" />}
          </div>
        </Card>
      )}
    </div>
  );
}
