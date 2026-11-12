"use client";

import { useMemo, useState } from "react";
import { PackageMinus, Printer, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, Button, Input, Select, Badge, Modal, Field, EmptyState, PageHeader, TableWrap, Th, Td, StatCard, Alert } from "@/components/ui";
import { toast } from "@/components/toast";
import { formatCurrency, formatDate, formatDateTime, cn } from "@/lib/utils";
import { printPurchaseReturnNote } from "@/components/prints";
import type { Purchase } from "@/lib/types";

interface Line { itemId: string; medicineId: string; batchId: string; batchNo: string; available: number; quantity: number }

export default function PurchaseReturnsPage() {
  const store = useStore();
  const purchases = useStore((s) => s.purchases);
  const returns = useStore((s) => s.purchaseReturns);
  const medicines = useStore((s) => s.medicines);
  const settings = useStore((s) => s.settings);

  const [step, setStep] = useState<"select" | "items" | "done">("select");
  const [supplierF, setSupplierF] = useState("");
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [reason, setReason] = useState("Damaged / surplus stock returned to supplier");
  const [done, setDone] = useState<{ no: string; total: number } | null>(null);

  const cur = settings.currency;
  const fmt = (n: number) => formatCurrency(n, cur);
  const today = new Date().toISOString().slice(0, 10);

  const suppliers = useMemo(() => [...new Set(purchases.map((p) => p.supplierId))], [purchases]);
  const supplierPurchases = useMemo(() =>
    purchases.filter((p) => p.status !== "cancelled" && (supplierF ? p.supplierId === supplierF : true) && p.items.some((it) => it.receivedQty > 0)),
  [purchases, supplierF]);

  const credit = lines.reduce((s, l) => {
    const med = medicines.find((m) => m.id === l.medicineId);
    const batch = med?.batches.find((b) => b.id === l.batchId);
    return s + (batch ? batch.purchasePrice * l.quantity : 0);
  }, 0);

  function openPurchase(p: Purchase) {
    setPurchase(p);
    const ls: Line[] = [];
    for (const it of p.items) {
      const med = medicines.find((m) => m.id === it.medicineId);
      if (!med) continue;
      const batches = med.batches.filter((b) => b.batchNo === it.batchNo || b.quantity > 0);
      for (const b of batches.slice(0, 2)) {
        ls.push({ itemId: it.id, medicineId: med.id, batchId: b.id, batchNo: b.batchNo, available: b.quantity, quantity: 0 });
      }
    }
    setLines(ls);
    setStep("items");
  }

  function submit() {
    if (!purchase) return;
    if (!lines.some((l) => l.quantity > 0)) { toast.error("Enter quantity to return"); return; }
    const res = store.createPurchaseReturn({
      purchaseId: purchase.id,
      items: lines.filter((l) => l.quantity > 0).map((l) => ({ itemId: l.itemId, quantity: l.quantity, batchId: l.batchId })),
      reason,
    });
    if ("error" in res) { toast.error("Return failed", res.error); return; }
    toast.success("Purchase return processed", `${res.returnNo} — supplier credit ${fmt(res.totalRefund)}`);
    printPurchaseReturnNote(res, settings);
    setDone({ no: res.returnNo, total: res.totalRefund });
    setStep("done");
  }

  const startOver = () => { setStep("select"); setPurchase(null); setLines([]); setDone(null); };

  return (
    <div>
      <PageHeader title="Purchase Returns" subtitle="Return stock to suppliers — stock decreases, supplier balance is credited" />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Purchase Returns" value={String(returns.length)} icon={<PackageMinus className="h-5 w-5" />} tone="navy" />
        <StatCard label="Total Supplier Credit" value={fmt(returns.reduce((s, r) => s + r.totalRefund, 0))} icon={<PackageMinus className="h-5 w-5" />} tone="amber" />
        <StatCard label="Units Returned" value={String(returns.reduce((s, r) => s + r.items.reduce((x, i) => x + i.quantity, 0), 0))} icon={<PackageMinus className="h-5 w-5" />} tone="blue" />
      </div>

      {step === "select" && (
        <Card className="mx-auto max-w-xl p-5">
          <div className="mb-1 text-sm font-semibold text-slate-700">Select the original purchase</div>
          <p className="mb-3 text-xs text-slate-500">Only received quantities can be returned to the supplier.</p>
          <Select value={supplierF} onChange={(e) => setSupplierF(e.target.value)} className="mb-3">
            <option value="">All suppliers</option>
            {suppliers.map((id) => <option key={id} value={id}>{purchases.find((p) => p.supplierId === id)?.supplierName}</option>)}
          </Select>
          <div className="space-y-1">
            {supplierPurchases.map((p) => (
              <button key={p.id} onClick={() => openPurchase(p)} className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-left hover:border-navy-400 hover:bg-slate-50">
                <div>
                  <div className="text-[13px] font-semibold text-slate-800">{p.refNo} · {p.supplierName}</div>
                  <div className="text-[11px] text-slate-400">{formatDate(p.date.slice(0, 10))} · {p.items.filter((i) => i.receivedQty > 0).length} received lines</div>
                </div>
                <span className="text-[13px] font-bold text-navy-700">{fmt(p.total)}</span>
              </button>
            ))}
            {!supplierPurchases.length && <EmptyState title="No received purchases found" />}
          </div>
        </Card>
      )}

      {step === "items" && purchase && (
        <Card className="mx-auto max-w-3xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-slate-800">{purchase.refNo} — {purchase.supplierName}</div>
              <div className="text-xs text-slate-500">{formatDateTime(purchase.date)}</div>
            </div>
            <Button variant="secondary" size="sm" onClick={startOver}>Change purchase</Button>
          </div>
          <TableWrap>
            <table className="w-full min-w-[620px]">
              <thead><tr><Th>Medicine</Th><Th>Batch</Th><Th className="text-right">In Stock</Th><Th className="text-right">Return Qty</Th><Th className="text-right">Cost</Th><Th className="text-right">Credit</Th></tr></thead>
              <tbody>
                {lines.map((l, i) => {
                  const med = medicines.find((m) => m.id === l.medicineId)!;
                  const batch = med.batches.find((b) => b.id === l.batchId)!;
                  const expired = batch.expiryDate < today;
                  return (
                    <tr key={`${l.itemId}_${l.batchId}`}>
                      <Td className="font-medium">{med.name}</Td>
                      <Td><div className="font-mono text-[11px]">{batch.batchNo}</div><div className={cn("text-[10px]", expired ? "text-rose-500" : "text-slate-400")}>exp {formatDate(batch.expiryDate)}</div></Td>
                      <Td className="text-right">{batch.quantity}</Td>
                      <Td className="text-right">
                        <Input type="number" value={l.quantity || ""} min={0} max={batch.quantity}
                          onChange={(e) => setLines((p) => p.map((x, j) => j === i ? { ...x, quantity: Math.max(0, Math.min(batch.quantity, Number(e.target.value) || 0)) } : x))}
                          className="h-8 w-20" />
                      </Td>
                      <Td className="text-right">{fmt(batch.purchasePrice)}</Td>
                      <Td className="text-right font-semibold">{fmt(batch.purchasePrice * l.quantity)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
          <Alert tone="blue" title="Effect on records">Stock leaves the selected batch and the supplier's outstanding balance is reduced by the credit amount.</Alert>
          <div className="mt-3">
            <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="text-lg font-bold text-slate-800">Supplier Credit: {fmt(credit)}</div>
            <Button variant="danger" onClick={submit}><PackageMinus className="h-4 w-4" /> Process Return</Button>
          </div>
        </Card>
      )}

      {step === "done" && done && (
        <Card className="mx-auto max-w-md p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><PackageMinus className="h-7 w-7" /></div>
          <h3 className="mt-3 text-base font-bold text-slate-800">Return {done.no} processed</h3>
          <p className="mt-1 text-sm text-slate-500">Supplier credited {fmt(done.total)} · stock updated</p>
          <Button className="mt-4" onClick={startOver}>Process Another Return</Button>
        </Card>
      )}

      <Card className="mt-6">
        <div className="px-5 pt-4 pb-2 text-[15px] font-semibold text-slate-800">Return History</div>
        <TableWrap>
          <table className="w-full min-w-[780px]">
            <thead><tr><Th>Return #</Th><Th>Date</Th><Th>PO Ref</Th><Th>Supplier</Th><Th className="text-right">Units</Th><Th className="text-right">Credit</Th><Th>Reason</Th><Th className="text-right">Doc</Th></tr></thead>
            <tbody>
              {returns.map((r) => (
                <tr key={r.id}>
                  <Td className="font-mono text-[12px] font-semibold">{r.returnNo}</Td>
                  <Td>{formatDate(r.date.slice(0, 10))}</Td>
                  <Td className="font-mono text-[12px]">{r.refNo}</Td>
                  <Td>{r.supplierName}</Td>
                  <Td className="text-right">{r.items.reduce((s, i) => s + i.quantity, 0)}</Td>
                  <Td className="text-right font-semibold">{fmt(r.totalRefund)}</Td>
                  <Td className="max-w-[200px] truncate text-slate-500">{r.reason}</Td>
                  <Td className="text-right"><Button size="sm" variant="outline" onClick={() => printPurchaseReturnNote(r, settings)}><Printer className="h-3.5 w-3.5" /></Button></Td>
                </tr>
              ))}
              {!returns.length && <tr><Td colSpan={8}><EmptyState title="No purchase returns yet" /></Td></tr>}
            </tbody>
          </table>
        </TableWrap>
      </Card>
    </div>
  );
}
