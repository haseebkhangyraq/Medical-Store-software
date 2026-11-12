"use client";

import { useMemo, useState } from "react";
import { CalendarClock, CalendarX2, Hourglass, PackageX, PackageOpen, Download, AlertTriangle, Printer, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, Button, Badge, EmptyState, PageHeader, TableWrap, Th, Td, StatCard, Tabs, Modal, Field, Input } from "@/components/ui";
import { toast } from "@/components/toast";
import { formatCurrency, formatDate, downloadCSV, printArea, daysUntil } from "@/lib/utils";
import { sellableStock, expiryStatus, totalStock } from "@/lib/stock";

export default function ExpiryPage() {
  const store = useStore();
  const medicines = useStore((s) => s.medicines);
  const settings = useStore((s) => s.settings);
  const [tab, setTab] = useState("expired");
  const [removeTarget, setRemoveTarget] = useState<{ medId: string; batchId: string; batchNo: string; qty: number; name: string } | null>(null);
  const [reason, setReason] = useState("Expired stock — quarantine for disposal");

  const cur = settings.currency;
  const fmt = (n: number) => formatCurrency(n, cur);
  const today = new Date().toISOString().slice(0, 10);

  const all = useMemo(() =>
    medicines.flatMap((m) => m.batches.map((b) => ({ med: m, batch: b, days: daysUntil(b.expiryDate), status: expiryStatus(b.expiryDate, settings.expiryWarnDays, today) }))),
  [medicines, settings.expiryWarnDays, today]);

  const filtered = useMemo(() => {
    const live = all.filter((x) => x.batch.quantity > 0);
    switch (tab) {
      case "expired": return all.filter((x) => x.status === "expired" && x.batch.quantity > 0);
      case "30": return live.filter((x) => x.days >= 0 && x.days <= 30);
      case "60": return live.filter((x) => x.days > 30 && x.days <= 60);
      case "90": return live.filter((x) => x.days > 60 && x.days <= 90);
      case "low": return medicines.filter((m) => sellableStock(m, today) > 0 && sellableStock(m, today) <= Math.max(m.minStockLevel, settings.lowStockThreshold));
      case "zero": return medicines.filter((m) => totalStock(m) === 0);
      case "over": return medicines.filter((m) => sellableStock(m, today) > m.minStockLevel * 8);
      default: return all;
    }
  }, [all, tab, medicines, settings.lowStockThreshold, today]);

  const stats = useMemo(() => ({
    expired: all.filter((x) => x.status === "expired" && x.batch.quantity > 0),
    d30: all.filter((x) => x.batch.quantity > 0 && x.days >= 0 && x.days <= 30),
    d60: all.filter((x) => x.batch.quantity > 0 && x.days > 30 && x.days <= 60),
    d90: all.filter((x) => x.batch.quantity > 0 && x.days > 60 && x.days <= 90),
  }), [all]);

  function removeExpired() {
    if (!removeTarget) return;
    store.removeExpiredBatch(removeTarget.medId, removeTarget.batchId, reason);
    toast.success("Expired stock removed", `${removeTarget.name} — batch ${removeTarget.batchNo} (${removeTarget.qty} units)`);
    setRemoveTarget(null);
  }

  function printReport() {
    const rows = filtered.map((x: any) => {
      if ("batch" in x) {
        return `<tr><td>${x.med.name}</td><td>${x.batch.batchNo}</td><td>${x.batch.quantity}</td><td>${formatDate(x.batch.expiryDate)}</td><td>${x.days < 0 ? "Expired" : x.days + " days"}</td><td>${Math.round(x.batch.quantity * x.batch.purchasePrice)}</td></tr>`;
      }
      return `<tr><td>${x.name}</td><td>—</td><td>${sellableStock(x, today)}</td><td>—</td><td>${sellableStock(x, today) === 0 ? "Out of stock" : "Low stock"}</td><td>${Math.round(stockValueSafe(x))}</td></tr>`;
    }).join("");
    printArea(`<div class="invoice"><div class="inv-head"><div><div class="inv-logo">${settings.pharmacyName}</div></div>
      <div style="text-align:right"><div style="font-size:16px;font-weight:700;color:#16223a">EXPIRY & STOCK CONTROL REPORT</div>
      <div class="muted" style="font-size:12px">Generated: ${new Date().toLocaleString()} · DEMO</div></div></div>
      <table class="mt16"><thead><tr><th>Medicine</th><th>Batch</th><th>Qty</th><th>Expiry</th><th>Status</th><th class="num">Value (${cur})</th></tr></thead><tbody>${rows}</tbody></table></div>`, "Expiry Report");
  }

  function stockValueSafe(m: any) {
    return m.batches.reduce((s: number, b: any) => s + b.quantity * b.purchasePrice, 0);
  }

  function exportCSV() {
    if (tab === "low" || tab === "zero" || tab === "over") {
      downloadCSV(`stock-control-${tab}`, (filtered as any[]).map((m) => ({
        Name: m.name, Category: m.category, Sellable: sellableStock(m, today), MinLevel: m.minStockLevel,
        Value: Math.round(stockValueSafe(m)),
      })));
    } else {
      downloadCSV(`expiry-${tab}`, (filtered as any[]).map((x) => ({
        Medicine: x.med.name, Batch: x.batch.batchNo, Qty: x.batch.quantity,
        Expiry: x.batch.expiryDate, Days: x.days, Cost: x.batch.purchasePrice,
        Value: Math.round(x.batch.quantity * x.batch.purchasePrice),
      })));
    }
    toast.success("Exported");
  }

  const tabDef = [
    { id: "expired", label: "Expired", count: stats.expired.length },
    { id: "30", label: "≤ 30 Days", count: stats.d30.length },
    { id: "60", label: "31–60 Days", count: stats.d60.length },
    { id: "90", label: "61–90 Days", count: stats.d90.length },
    { id: "low", label: "Low Stock" },
    { id: "zero", label: "Zero Stock" },
    { id: "over", label: "Overstock" },
  ];

  const isMedicineView = tab === "low" || tab === "zero" || tab === "over";

  return (
    <div>
      <PageHeader title="Expiry & Stock Control" subtitle="FEFO-protected: expired batches are never sellable"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={printReport}><Printer className="h-4 w-4" /> Print Report</Button>
          </>
        } />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Expired (in stock)" value={String(stats.expired.length)} sub={`value ${fmt(stats.expired.reduce((s, x) => s + x.batch.quantity * x.batch.purchasePrice, 0))}`} icon={<CalendarX2 className="h-5 w-5" />} tone="red" />
        <StatCard label="≤ 30 Days" value={String(stats.d30.length)} icon={<Hourglass className="h-5 w-5" />} tone="amber" />
        <StatCard label="31–60 Days" value={String(stats.d60.length)} icon={<Hourglass className="h-5 w-5" />} tone="blue" />
        <StatCard label="61–90 Days" value={String(stats.d90.length)} icon={<Hourglass className="h-5 w-5" />} tone="navy" />
      </div>

      <Tabs active={tab} onChange={setTab} className="mb-4" tabs={tabDef} />

      <Card>
        {isMedicineView ? (
          <TableWrap>
            <table className="w-full min-w-[700px]">
              <thead><tr><Th>Medicine</Th><Th>Category</Th><Th className="text-right">Sellable</Th><Th className="text-right">Min Level</Th><Th className="text-right">Value</Th><Th>Status</Th></tr></thead>
              <tbody>
                {(filtered as any[]).map((m) => {
                  const s = sellableStock(m, today);
                  return (
                    <tr key={m.id}>
                      <Td className="font-medium">{m.name}</Td>
                      <Td><Badge tone="slate">{m.category}</Badge></Td>
                      <Td className="text-right font-semibold">{s}</Td>
                      <Td className="text-right">{m.minStockLevel}</Td>
                      <Td className="text-right">{fmt(stockValueSafe(m))}</Td>
                      <Td>
                        {s === 0 ? <Badge tone="red">Out of stock</Badge> :
                         tab === "over" ? <Badge tone="blue">Overstock</Badge> :
                         <Badge tone="amber">Low stock</Badge>}
                      </Td>
                    </tr>
                  );
                })}
                {!filtered.length && <tr><Td colSpan={6}><EmptyState title="Nothing to show" /></Td></tr>}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[780px]">
              <thead><tr><Th>Medicine</Th><Th>Batch</Th><Th className="text-right">Qty</Th><Th>Expiry</Th><Th className="text-right">Cost Value</Th><Th>Status</Th><Th className="text-right">Action</Th></tr></thead>
              <tbody>
                {(filtered as any[]).map(({ med, batch, days, status }) => (
                  <tr key={batch.id}>
                    <Td className="font-medium">{med.name}</Td>
                    <Td className="font-mono text-[12px]">{batch.batchNo}</Td>
                    <Td className="text-right font-semibold">{batch.quantity}</Td>
                    <Td>{formatDate(batch.expiryDate)}</Td>
                    <Td className="text-right">{fmt(batch.quantity * batch.purchasePrice)}</Td>
                    <Td>
                      {status === "expired" ? <Badge tone="red">Expired {Math.abs(days)}d ago</Badge> :
                       <Badge tone={days <= 30 ? "amber" : "blue"}>{days} days left</Badge>}
                    </Td>
                    <Td className="text-right">
                      {status === "expired" ? (
                        <Button size="sm" variant="danger" onClick={() => setRemoveTarget({ medId: med.id, batchId: batch.id, batchNo: batch.batchNo, qty: batch.quantity, name: med.name })}>
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => {
                          store.createIssuance({
                            destination: "Damaged / Quarantine", reason: days <= 30 ? "expired" : "internal_use",
                            authorizedBy: store.currentUser?.name ?? "Manager",
                            notes: `Near-expiry withdrawal (${days} days left)`,
                            items: [{ medicineId: med.id, batchId: batch.id, quantity: batch.quantity }],
                          });
                          toast.success("Withdrawn from sale", `${med.name} batch ${batch.batchNo} issued to quarantine`);
                        }}>Withdraw</Button>
                      )}
                    </Td>
                  </tr>
                ))}
                {!filtered.length && <tr><Td colSpan={7}><EmptyState icon={<CalendarClock className="h-7 w-7" />} title="Nothing in this bucket" message="Inventory is clear for this window." /></Td></tr>}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <Modal open={!!removeTarget} onClose={() => setRemoveTarget(null)} title="Remove Expired Stock" size="sm"
        subtitle={removeTarget ? `${removeTarget.name} — batch ${removeTarget.batchNo} — ${removeTarget.qty} units` : ""}
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setRemoveTarget(null)}>Cancel</Button><Button variant="danger" onClick={removeExpired}><Trash2 className="h-4 w-4" /> Remove & Ledger</Button></div>}>
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Stock will be set to zero and recorded in the movement ledger as <b>expiry_removal</b>. This cannot be undone.
          </div>
          <Field label="Reason / Disposal Note"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}
