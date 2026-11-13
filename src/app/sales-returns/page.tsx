"use client";

import { useMemo, useState } from "react";
import { Search, Undo2, Printer, PackageOpen, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, Button, Input, Select, Badge, Modal, Field, EmptyState, PageHeader, TableWrap, Th, Td, StatCard, Alert } from "@/components/ui";
import { toast } from "@/components/toast";
import { formatCurrency, formatDate, formatDateTime, cn } from "@/lib/utils";
import { printSalesReturnNote } from "@/components/prints";
import { printModuleReport } from "@/components/module-print";
import type { Sale } from "@/lib/types";

interface RetLine { saleItemId: string; quantity: number; restock: boolean; maxQty: number; already: number }

export default function SalesReturnsPage() {
  const store = useStore();
  const sales = useStore((s) => s.sales);
  const returns = useStore((s) => s.salesReturns);
  const medicines = useStore((s) => s.medicines);
  const settings = useStore((s) => s.settings);

  const [step, setStep] = useState<"search" | "items" | "done">("search");
  const [q, setQ] = useState("");
  const [sale, setSale] = useState<Sale | null>(null);
  const [lines, setLines] = useState<RetLine[]>([]);
  const [reason, setReason] = useState("Customer returned unopened item");
  const [restockMethod, setRestockMethod] = useState<"cash_refund" | "store_credit" | "balance_adjustment">("cash_refund");
  const [done, setDone] = useState<{ no: string; total: number } | null>(null);

  const cur = settings.currency;
  const fmt = (n: number) => formatCurrency(n, cur);
  const today = new Date().toISOString().slice(0, 10);

  const matches = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (query.length < 2) return [];
    return sales.filter((s) => s.invoiceNo.toLowerCase().includes(query) || s.customerName.toLowerCase().includes(query)).slice(0, 8);
  }, [q, sales]);

  const totalRefund = lines.reduce((s, l) => {
    const item = sale?.items.find((i) => i.id === l.saleItemId);
    return s + (item ? Math.round((item.total / item.quantity) * l.quantity) : 0);
  }, 0);

  function pickSale(s: Sale) {
    if (s.status === "returned") { toast.error("Invoice fully returned already"); return; }
    setSale(s);
    setLines(s.items.map((it) => {
      const already = returns.filter((r) => r.saleId === s.id).flatMap((r) => r.items.filter((i) => i.saleItemId === it.id)).reduce((x, i) => x + i.quantity, 0);
      return { saleItemId: it.id, quantity: 0, restock: true, maxQty: it.quantity - already, already };
    }));
    setStep("items");
  }

  function submit() {
    if (!sale) return;
    if (!lines.some((l) => l.quantity > 0)) { toast.error("Enter quantity to return"); return; }
    const res = store.createSalesReturn({
      saleId: sale.id,
      items: lines.filter((l) => l.quantity > 0).map((l) => ({ saleItemId: l.saleItemId, quantity: l.quantity, restock: l.restock })),
      reason, restockMethod,
    });
    if ("error" in res) { toast.error("Return failed", res.error); return; }
    toast.success("Return processed", `${res.returnNo} — refund ${fmt(res.totalRefund)}`);
    printSalesReturnNote(res, settings);
    setDone({ no: res.returnNo, total: res.totalRefund });
    setStep("done");
  }

  const startOver = () => { setStep("search"); setSale(null); setLines([]); setQ(""); setDone(null); };

  function printSummary() {
    printModuleReport({
      title: "Sales Returns",
      pharmacyName: settings.pharmacyName,
      address: settings.address,
      branchName: settings.branchName,
      kpis: [
        ["Returns", String(returns.length)],
        ["Total Refunded", fmt(returns.reduce((s, r) => s + r.totalRefund, 0))],
        ["Units Restocked", String(returns.reduce((s, r) => s + r.items.filter((i) => i.restock).reduce((x, i) => x + i.quantity, 0), 0))],
      ],
      sections: [{
        heading: "Return Notes",
        columns: ["Return #", "Date", "Invoice", "Customer", "Items", "Refund", "Restock"],
        right: [4, 5],
        rows: returns.slice(0, 60).map((r) => [
          r.returnNo, formatDate(r.date.slice(0, 10)), r.invoiceNo, r.customerName,
          String(r.items.length), fmt(r.totalRefund),
          r.items.every((i) => i.restock) ? "Full" : r.items.some((i) => i.restock) ? "Partial" : "None",
        ]),
      }],
      note: `Showing ${Math.min(returns.length, 60)} of ${returns.length} returns.`,
    });
  }

  return (
    <div>
      <PageHeader title="Sales Returns" subtitle="Search invoice → select items → refund & restock eligible batches"
        actions={<Button variant="outline" size="sm" onClick={printSummary}><Printer className="h-4 w-4" /> Print Summary</Button>} />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Returns" value={String(returns.length)} icon={<Undo2 className="h-5 w-5" />} tone="navy" />
        <StatCard label="Total Refunded" value={fmt(returns.reduce((s, r) => s + r.totalRefund, 0))} icon={<Undo2 className="h-5 w-5" />} tone="amber" />
        <StatCard label="Units Restocked" value={String(returns.reduce((s, r) => s + r.items.filter((i) => i.restock).reduce((x, i) => x + i.quantity, 0), 0))} icon={<PackageOpen className="h-5 w-5" />} tone="green" />
      </div>

      {step === "search" && (
        <Card className="mx-auto max-w-xl p-5">
          <div className="mb-1 text-sm font-semibold text-slate-700">Find the original invoice</div>
          <p className="mb-3 text-xs text-slate-500">Search by invoice number or customer name. Returned invoices are marked in history.</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. INV-00004 or customer name" className="pl-9" />
          </div>
          <div className="mt-2 space-y-1">
            {matches.map((s) => (
              <button key={s.id} onClick={() => pickSale(s)} className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-left transition-colors hover:border-navy-400 hover:bg-slate-50">
                <div>
                  <div className="text-[13px] font-semibold text-slate-800">{s.invoiceNo} · {s.customerName}</div>
                  <div className="text-[11px] text-slate-400">{formatDateTime(s.date)} · {s.items.length} items</div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-bold text-navy-700">{fmt(s.total)}</div>
                  <Badge tone={s.status === "completed" ? "green" : "amber"}>{s.status.replace("_", " ")}</Badge>
                </div>
              </button>
            ))}
            {q.trim().length >= 2 && !matches.length && <EmptyState title="No invoice matches" />}
          </div>
        </Card>
      )}

      {step === "items" && sale && (
        <Card className="mx-auto max-w-3xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-slate-800">{sale.invoiceNo} — {sale.customerName}</div>
              <div className="text-xs text-slate-500">{formatDateTime(sale.date)} · {fmt(sale.total)}</div>
            </div>
            <Button variant="secondary" size="sm" onClick={startOver}>Change invoice</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead><tr><Th>Medicine</Th><Th>Batch</Th><Th className="text-right">Sold</Th><Th className="text-right">Returned</Th><Th className="text-right">Return Qty</Th><Th className="text-center">Restock</Th></tr></thead>
              <tbody>
                {sale.items.map((it, i) => {
                  const l = lines[i];
                  const med = medicines.find((m) => m.id === it.medicineId);
                  const batch = med?.batches.find((b) => b.id === it.batchId);
                  const expired = batch ? batch.expiryDate < today : true;
                  return (
                    <tr key={it.id}>
                      <Td className="font-medium">{it.medicineName}</Td>
                      <Td><div className="font-mono text-[11px]">{it.batchNo}</div><div className={cn("text-[10px]", expired ? "text-rose-500" : "text-slate-400")}>exp {formatDate(it.expiryDate)}{expired ? " (expired)" : ""}</div></Td>
                      <Td className="text-right">{it.quantity}</Td>
                      <Td className="text-right text-slate-400">{l.already}</Td>
                      <Td className="text-right">
                        <Input type="number" value={l.quantity || ""} min={0} max={l.maxQty}
                          onChange={(e) => {
                            const v = Math.max(0, Math.min(l.maxQty, Number(e.target.value) || 0));
                            setLines((p) => p.map((x, j) => j === i ? { ...x, quantity: v } : x));
                          }}
                          className="h-8 w-20" disabled={l.maxQty <= 0} />
                      </Td>
                      <Td className="text-center">
                        <input type="checkbox" checked={l.restock && !expired} disabled={expired}
                          onChange={(e) => setLines((p) => p.map((x, j) => j === i ? { ...x, restock: e.target.checked } : x))}
                          className="h-4 w-4 rounded accent-navy-700" />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Alert tone="blue" title="Restocking rule">Expired batches are never restocked — quantity stays deducted. Non-expired batches return the units to the same batch.</Alert>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Return Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            <Field label="Refund Method">
              <Select value={restockMethod} onChange={(e) => setRestockMethod(e.target.value as typeof restockMethod)}>
                <option value="cash_refund">Cash Refund</option>
                <option value="store_credit">Store Credit</option>
                <option value="balance_adjustment">Adjust Customer Balance</option>
              </Select>
            </Field>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="text-lg font-bold text-slate-800">Refund: {fmt(totalRefund)}</div>
            <Button variant="danger" onClick={submit}><Undo2 className="h-4 w-4" /> Process Return</Button>
          </div>
        </Card>
      )}

      {step === "done" && done && (
        <Card className="mx-auto max-w-md p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><Undo2 className="h-7 w-7" /></div>
          <h3 className="mt-3 text-base font-bold text-slate-800">Return {done.no} processed</h3>
          <p className="mt-1 text-sm text-slate-500">Refund {fmt(done.total)} · inventory and customer accounts updated</p>
          <Button className="mt-4" onClick={startOver}>Process Another Return</Button>
        </Card>
      )}

      <Card className="mt-6">
        <div className="px-5 pt-4 pb-2 text-[15px] font-semibold text-slate-800">Return History</div>
        <TableWrap>
          <table className="w-full min-w-[820px]">
            <thead><tr><Th>Return #</Th><Th>Date</Th><Th>Invoice</Th><Th>Customer</Th><Th className="text-right">Items</Th><Th className="text-right">Refund</Th><Th>Reason</Th><Th className="text-right">Doc</Th></tr></thead>
            <tbody>
              {returns.map((r) => (
                <tr key={r.id}>
                  <Td className="font-mono text-[12px] font-semibold">{r.returnNo}</Td>
                  <Td>{formatDate(r.date.slice(0, 10))}</Td>
                  <Td className="font-mono text-[12px]">{r.invoiceNo}</Td>
                  <Td>{r.customerName}</Td>
                  <Td className="text-right">{r.items.reduce((s, i) => s + i.quantity, 0)}</Td>
                  <Td className="text-right font-semibold">{fmt(r.totalRefund)}</Td>
                  <Td className="max-w-[200px] truncate text-slate-500">{r.reason}</Td>
                  <Td className="text-right"><Button size="sm" variant="outline" onClick={() => printSalesReturnNote(r, settings)}><Printer className="h-3.5 w-3.5" /></Button></Td>
                </tr>
              ))}
              {!returns.length && <tr><Td colSpan={8}><EmptyState title="No sales returns yet" message="Processed returns will appear here with full inventory & financial records." /></Td></tr>}
            </tbody>
          </table>
        </TableWrap>
      </Card>
    </div>
  );
}
