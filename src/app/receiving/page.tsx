"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PackageCheck, Printer, CheckCircle2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, Button, Input, Badge, Modal, Field, EmptyState, PageHeader, TableWrap, Th, Td, StatCard, Tabs } from "@/components/ui";
import { toast } from "@/components/toast";
import { formatCurrency, formatDate, formatDateTime, cn } from "@/lib/utils";
import { printReceivingDoc } from "@/components/prints";
import { printModuleReport } from "@/components/module-print";
import type { Purchase } from "@/lib/types";

interface RecvLine { itemId: string; quantity: number; batchNo: string; mfgDate: string; expiryDate: string; unitCost: number }

export default function ReceivingPage() {
  return (
    <Suspense>
      <ReceivingInner />
    </Suspense>
  );
}

function ReceivingInner() {
  const store = useStore();
  const purchases = useStore((s) => s.purchases);
  const receivings = useStore((s) => s.receivings);
  const settings = useStore((s) => s.settings);
  const searchParams = useSearchParams();
  const [tab, setTab] = useState("pending");
  const [active, setActive] = useState<Purchase | null>(null);
  const [lines, setLines] = useState<RecvLine[]>([]);
  const [receivedBy, setReceivedBy] = useState("");

  const cur = settings.currency;
  const fmt = (n: number) => formatCurrency(n, cur);
  const today = new Date().toISOString().slice(0, 10);

  const pending = useMemo(() => purchases.filter((p) => p.status === "ordered" || p.status === "partially_received"), [purchases]);

  // Auto-open ?po= param
  useEffect(() => {
    const poId = searchParams.get("po");
    if (poId) {
      const po = purchases.find((p) => p.id === poId);
      if (po && po.status !== "received" && po.id !== active?.id) openReceive(po);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, purchases]);

  function openReceive(po: Purchase) {
    setActive(po);
    setLines(po.items.map((it) => ({
      itemId: it.id,
      quantity: Math.max(0, it.orderedQty - it.receivedQty),
      batchNo: it.batchNo || "",
      mfgDate: it.mfgDate || "",
      expiryDate: it.expiryDate || "",
      unitCost: it.unitCost,
    })));
    setReceivedBy(store.currentUser?.name ?? "");
  }

  const draftValue = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);

  function printSummary() {
    printModuleReport({
      title: "Goods Receiving",
      pharmacyName: settings.pharmacyName,
      address: settings.address,
      branchName: settings.branchName,
      kpis: [
        ["Pending Orders", String(pending.length)],
        ["GRNs Issued", String(receivings.length)],
        ["Received Value", fmt(receivings.reduce((s, r) => s + r.total, 0))],
        ["Units Received", String(receivings.reduce((s, r) => s + r.items.reduce((x, i) => x + i.quantity, 0), 0))],
      ],
      sections: [{
        heading: "Receiving History (GRNs)",
        columns: ["GRN #", "Date", "Supplier", "Items", "Units", "Value"],
        right: [3, 4, 5],
        rows: receivings.slice(0, 60).map((r) => [
          r.receiveNo, formatDate(r.date.slice(0, 10)), r.supplierName ?? "—",
          String(r.items.length), String(r.items.reduce((x, i) => x + i.quantity, 0)), fmt(r.total),
        ]),
      }],
      note: `Showing ${Math.min(receivings.length, 60)} of ${receivings.length} GRNs.`,
    });
  }

  function submitReceive() {
    if (!active) return;
    const res = store.receivePurchase(active.id, lines, receivedBy || "Store");
    if ("error" in res) {
      toast.error("Receiving failed", res.error);
      return;
    }
    toast.success("Goods received", `${res.receiveNo} — ${res.items.length} items, value ${fmt(res.total)}`);
    setActive(null);
  }

  return (
    <div>
      <PageHeader title="Receiving" subtitle="Goods receiving — verify quantities, confirm batches, update inventory"
        actions={<Button variant="outline" size="sm" onClick={printSummary}><Printer className="h-4 w-4" /> Print Summary</Button>} />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Pending Orders" value={String(pending.length)} icon={<PackageCheck className="h-5 w-5" />} tone="amber" />
        <StatCard label="GRNs Issued" value={String(receivings.length)} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
        <StatCard label="Received Value" value={fmt(receivings.reduce((s, r) => s + r.total, 0))} icon={<PackageCheck className="h-5 w-5" />} tone="navy" />
        <StatCard label="Units Received" value={String(receivings.reduce((s, r) => s + r.items.reduce((x, i) => x + i.quantity, 0), 0))} icon={<CheckCircle2 className="h-5 w-5" />} tone="blue" />
      </div>

      <Tabs active={tab} onChange={setTab} className="mb-4 max-w-md"
        tabs={[{ id: "pending", label: "Pending", count: pending.length }, { id: "history", label: "Receiving History", count: receivings.length }]} />

      {tab === "pending" && (
        <Card>
          <TableWrap>
            <table className="w-full min-w-[760px]">
              <thead><tr><Th>Ref #</Th><Th>Date</Th><Th>Supplier</Th><Th className="text-right">Progress</Th><Th className="text-right">Order Value</Th><Th>Status</Th><Th className="text-right">Action</Th></tr></thead>
              <tbody>
                {pending.map((p) => {
                  const ordered = p.items.reduce((s, it) => s + it.orderedQty, 0);
                  const received = p.items.reduce((s, it) => s + it.receivedQty, 0);
                  const pct = ordered ? Math.round((received / ordered) * 100) : 0;
                  return (
                    <tr key={p.id}>
                      <Td className="font-mono text-[12px] font-semibold">{p.refNo}</Td>
                      <Td>{formatDate(p.date.slice(0, 10))}</Td>
                      <Td>{p.supplierName}</Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                            <div className={cn("h-full rounded-full", pct === 100 ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[11px] tabular-nums text-slate-500">{received}/{ordered}</span>
                        </div>
                      </Td>
                      <Td className="text-right font-semibold">{fmt(p.total)}</Td>
                      <Td><Badge tone={p.status === "ordered" ? "blue" : "amber"}>{p.status.replace("_", " ")}</Badge></Td>
                      <Td className="text-right"><Button size="sm" onClick={() => openReceive(p)}><PackageCheck className="h-3.5 w-3.5" /> Receive</Button></Td>
                    </tr>
                  );
                })}
                {!pending.length && <tr><Td colSpan={7}><EmptyState icon={<CheckCircle2 className="h-7 w-7" />} title="Nothing pending" message="All purchase orders have been fully received." /></Td></tr>}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}

      {tab === "history" && (
        <Card>
          <TableWrap>
            <table className="w-full min-w-[760px]">
              <thead><tr><Th>GRN #</Th><Th>Date</Th><Th>PO Ref</Th><Th>Supplier</Th><Th className="text-right">Items</Th><Th className="text-right">Value</Th><Th>Received By</Th><Th className="text-right">Doc</Th></tr></thead>
              <tbody>
                {receivings.map((r) => (
                  <tr key={r.id}>
                    <Td className="font-mono text-[12px] font-semibold">{r.receiveNo}</Td>
                    <Td>{formatDate(r.date.slice(0, 10))}</Td>
                    <Td className="font-mono text-[12px]">{r.refNo}</Td>
                    <Td>{r.supplierName}</Td>
                    <Td className="text-right">{r.items.length}</Td>
                    <Td className="text-right font-semibold">{fmt(r.total)}</Td>
                    <Td>{r.receivedBy}</Td>
                    <Td className="text-right"><Button size="sm" variant="outline" onClick={() => printReceivingDoc(r, settings)}><Printer className="h-3.5 w-3.5" /> GRN</Button></Td>
                  </tr>
                ))}
                {!receivings.length && <tr><Td colSpan={8}><EmptyState title="No receiving records yet" /></Td></tr>}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}

      {/* Receive modal */}
      <Modal open={!!active} onClose={() => setActive(null)} title={`Receive Goods — ${active?.refNo ?? ""}`}
        subtitle={active ? `${active.supplierName} · set received quantities, batch & expiry per line (partial receiving supported)` : ""} size="xl"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Field label="Received By" className="w-52"><Input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} className="h-9" /></Field>
              <div className="text-sm font-semibold text-slate-700">Receiving value: {fmt(draftValue)}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setActive(null)}>Cancel</Button>
              <Button variant="success" onClick={submitReceive}><PackageCheck className="h-4 w-4" /> Confirm Receiving</Button>
            </div>
          </div>
        }>
        {active && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead><tr><Th>Medicine</Th><Th className="text-right">Ordered</Th><Th className="text-right">Already</Th><Th className="text-right">Receive Now</Th><Th>Batch #</Th><Th>Mfg</Th><Th>Expiry</Th><Th className="text-right">Cost</Th></tr></thead>
              <tbody>
                {active.items.map((it, i) => {
                  const l = lines[i];
                  const remain = it.orderedQty - it.receivedQty;
                  return (
                    <tr key={it.id}>
                      <Td className="font-medium">{it.medicineName}</Td>
                      <Td className="text-right">{it.orderedQty}</Td>
                      <Td className="text-right text-slate-400">{it.receivedQty}</Td>
                      <Td className="text-right">
                        <Input type="number" value={l?.quantity ?? 0} max={remain}
                          onChange={(e) => {
                            const v = Math.max(0, Math.min(remain, Number(e.target.value) || 0));
                            setLines((p) => p.map((x, j) => j === i ? { ...x, quantity: v } : x));
                          }}
                          className="h-8 w-20" />
                      </Td>
                      <Td><Input value={l?.batchNo ?? ""} onChange={(e) => setLines((p) => p.map((x, j) => j === i ? { ...x, batchNo: e.target.value } : x))} className="h-8 w-28" /></Td>
                      <Td><Input type="date" value={l?.mfgDate ?? ""} onChange={(e) => setLines((p) => p.map((x, j) => j === i ? { ...x, mfgDate: e.target.value } : x))} className="h-8 w-36" /></Td>
                      <Td>
                        <Input type="date" value={l?.expiryDate ?? ""} onChange={(e) => setLines((p) => p.map((x, j) => j === i ? { ...x, expiryDate: e.target.value } : x))} className={cn("h-8 w-36", l?.expiryDate && l.expiryDate < today && "border-rose-400")} />
                        {l?.expiryDate && l.expiryDate < today && <div className="text-[10px] font-medium text-rose-500">Expired date!</div>}
                      </Td>
                      <Td className="text-right"><Input type="number" value={l?.unitCost ?? 0} onChange={(e) => setLines((p) => p.map((x, j) => j === i ? { ...x, unitCost: Number(e.target.value) || 0 } : x))} className="h-8 w-24" /></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-[13px] text-slate-600">
              Received quantity increases stock and adds supplier payable automatically. Batches are stored separately — expiry and purchase cost are never merged.
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
