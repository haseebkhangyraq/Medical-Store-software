"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Eye, PackageCheck, XCircle, Download, FileSpreadsheet, Truck, Printer } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, Button, Input, Select, Badge, Modal, Field, EmptyState, PageHeader, TableWrap, Th, Td, StatCard, ConfirmDialog, SearchInput } from "@/components/ui";
import { toast } from "@/components/toast";
import { formatCurrency, formatDate, formatDateTime, downloadCSV, cn } from "@/lib/utils";
import { printReceivingDoc } from "@/components/prints";
import { printModuleReport } from "@/components/module-print";
import type { Purchase, PurchaseItem } from "@/lib/types";

interface DraftItem {
  key: string;
  medicineId: string;
  orderedQty: number;
  unitCost: number;
  batchNo: string;
  mfgDate: string;
  expiryDate: string;
}

const statusTone = { ordered: "blue", partially_received: "amber", received: "green", cancelled: "slate" } as const;

export default function PurchasesPage() {
  const store = useStore();
  const purchases = useStore((s) => s.purchases);
  const suppliers = useStore((s) => s.suppliers);
  const medicines = useStore((s) => s.medicines);
  const receivings = useStore((s) => s.receivings);
  const settings = useStore((s) => s.settings);

  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Purchase | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Purchase | null>(null);

  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [receiveNow, setReceiveNow] = useState(false);
  const [notes, setNotes] = useState("");

  const cur = settings.currency;
  const fmt = (n: number) => formatCurrency(n, cur);

  const rows = useMemo(() => purchases.filter((p) => {
    if (statusF !== "all" && p.status !== statusF) return false;
    const query = q.trim().toLowerCase();
    return !query || p.refNo.toLowerCase().includes(query) || p.supplierName.toLowerCase().includes(query);
  }), [purchases, q, statusF]);

  const stats = useMemo(() => ({
    total: purchases.filter((p) => p.status !== "cancelled").reduce((s, p) => s + p.total, 0),
    pending: purchases.filter((p) => p.status === "ordered" || p.status === "partially_received").length,
    outstanding: purchases.filter((p) => p.status === "received" || p.status === "partially_received").reduce((s, p) => {
      const receivedValue = p.items.reduce((x, it) => x + it.receivedQty * it.unitCost, 0);
      return s + Math.max(0, receivedValue - p.paidAmount);
    }, 0),
  }), [purchases]);

  function printSummary() {
    printModuleReport({
      title: "Purchase Report",
      pharmacyName: settings.pharmacyName,
      address: settings.address,
      branchName: settings.branchName,
      kpis: [
        ["Purchase Orders", String(purchases.length)],
        ["Total Purchased", fmt(stats.total)],
        ["Awaiting Receiving", String(stats.pending)],
        ["Unpaid (received)", fmt(stats.outstanding)],
      ],
      sections: [{
        heading: "Purchase Orders",
        columns: ["Ref #", "Date", "Supplier", "Items", "Total", "Status"],
        right: [4],
        rows: rows.slice(0, 60).map((p) => [
          p.refNo, formatDate(p.date.slice(0, 10)), p.supplierName, String(p.items.length),
          fmt(p.total), p.status.replace("_", " "),
        ]),
      }],
    });
  }

  const draftSubtotal = items.reduce((s, it) => s + it.orderedQty * it.unitCost, 0);
  const draftTotal = Math.max(0, draftSubtotal - discount + tax);

  function addItem(medicineId: string) {
    const med = medicines.find((m) => m.id === medicineId);
    if (!med) return;
    setItems((prev) => [
      ...prev,
      { key: `${medicineId}_${prev.length}`, medicineId, orderedQty: 50, unitCost: Math.round(med.retailPrice * 0.65), batchNo: `B${Math.floor(Math.random() * 9000) + 1000}-${Math.floor(Math.random() * 90) + 10}`, mfgDate: "", expiryDate: "" },
    ]);
  }

  function createPO() {
    if (!supplierId) { toast.error("Select a supplier"); return; }
    if (!items.length) { toast.error("Add at least one medicine"); return; }
    const bad = items.find((it) => !it.expiryDate);
    if (receiveNow && bad) { toast.error("Batch expiry date required for all items when receiving immediately"); return; }
    const po = store.createPurchase({
      supplierId,
      items: items.map((it) => ({ medicineId: it.medicineId, medicineName: medicines.find((m) => m.id === it.medicineId)?.name ?? "", orderedQty: it.orderedQty, unitCost: it.unitCost, batchNo: it.batchNo, mfgDate: it.mfgDate, expiryDate: it.expiryDate })),
      discount, tax, paidAmount: receiveNow ? paidAmount : 0, notes, receiveNow,
    });
    toast.success(receiveNow ? "Purchase received" : "Purchase order created", `${po.refNo} — ${fmt(po.total)}`);
    setCreateOpen(false);
    setItems([]); setDiscount(0); setTax(0); setPaidAmount(0); setReceiveNow(false); setNotes("");
  }

  function exportCSV() {
    downloadCSV("purchases", rows.map((p) => ({
      Ref: p.refNo, Date: p.date.slice(0, 10), Supplier: p.supplierName, Items: p.items.length,
      Subtotal: p.subtotal, Discount: p.discount, Tax: p.tax, Total: p.total, Paid: p.paidAmount, Status: p.status,
    })));
  }

  const detailPur = detail ? purchases.find((p) => p.id === detail.id) ?? detail : null;
  const detailRcv = detailPur ? receivings.filter((r) => r.purchaseId === detailPur.id) : [];

  return (
    <div>
      <PageHeader title="Purchases" subtitle="Purchase orders, pricing and supplier procurement"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={printSummary}><Printer className="h-4 w-4" /> Print Summary</Button>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4" /> Export</Button>
            <Button size="sm" onClick={() => { setSupplierId(suppliers[0]?.id ?? ""); setCreateOpen(true); }}><Plus className="h-4 w-4" /> New Purchase</Button>
          </>
        } />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Purchase Orders" value={String(purchases.length)} icon={<FileSpreadsheet className="h-5 w-5" />} tone="navy" />
        <StatCard label="Total Purchased" value={fmt(stats.total)} icon={<Truck className="h-5 w-5" />} tone="amber" />
        <StatCard label="Pending Receiving" value={String(stats.pending)} icon={<PackageCheck className="h-5 w-5" />} tone="blue" onClick={() => window.location.assign("/receiving")} />
        <StatCard label="Unpaid (received)" value={fmt(stats.outstanding)} icon={<XCircle className="h-5 w-5" />} tone="red" />
      </div>

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ref # or supplier…" className="sm:max-w-xs" />
          <Select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="sm:w-56">
            <option value="all">All statuses</option>
            <option value="ordered">Ordered</option>
            <option value="partially_received">Partially received</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>
      </Card>

      <Card>
        <TableWrap>
          <table className="w-full min-w-[880px]">
            <thead><tr><Th>Ref #</Th><Th>Date</Th><Th>Supplier</Th><Th className="text-right">Items</Th><Th className="text-right">Total</Th><Th className="text-right">Paid</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
            <tbody>
              {rows.map((p) => {
                const received = p.items.reduce((s, it) => s + it.receivedQty, 0);
                const ordered = p.items.reduce((s, it) => s + it.orderedQty, 0);
                return (
                  <tr key={p.id}>
                    <Td className="font-mono text-[12px] font-semibold">{p.refNo}</Td>
                    <Td>{formatDate(p.date.slice(0, 10))}</Td>
                    <Td>{p.supplierName}</Td>
                    <Td className="text-right">{p.items.length} <span className="text-[10px] text-slate-400">({received}/{ordered} units)</span></Td>
                    <Td className="text-right font-semibold">{fmt(p.total)}</Td>
                    <Td className="text-right">
                      <span className={cn(p.paidAmount < p.total ? "text-amber-600" : "text-emerald-600")}>{fmt(p.paidAmount)}</span>
                    </Td>
                    <Td><Badge tone={statusTone[p.status]}>{p.status.replace("_", " ")}</Badge></Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" title="Details" onClick={() => setDetail(p)}><Eye className="h-4 w-4" /></Button>
                        {(p.status === "ordered" || p.status === "partially_received") && (
                          <>
                            <Button size="sm" variant="primary" onClick={() => window.location.assign(`/receiving?po=${p.id}`)}><PackageCheck className="h-3.5 w-3.5" /> Receive</Button>
                            <Button size="icon" variant="ghost" className="text-rose-500 hover:bg-rose-50" title="Cancel order" onClick={() => setCancelTarget(p)}><XCircle className="h-4 w-4" /></Button>
                          </>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
              {!rows.length && <tr><Td colSpan={8}><EmptyState title="No purchase orders" message="Create your first purchase order to stock up." action={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New Purchase</Button>} /></Td></tr>}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {/* Create PO */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Purchase Order" size="xl"
        subtitle="Add medicines, quantities, costs and batch details. Receive now or later."
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold text-slate-700">Total: {fmt(draftTotal)}</div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={createPO}>{receiveNow ? "Create & Receive" : "Create Order"}</Button>
            </div>
          </div>
        }>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier" required>
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">— Select supplier —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Add Medicine">
              <Select value="" onChange={(e) => { if (e.target.value) { addItem(e.target.value); } }}>
                <option value="">— Select medicine to add —</option>
                {medicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </Field>
          </div>

          {items.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[760px]">
                <thead><tr><Th>Medicine</Th><Th className="text-right">Qty</Th><Th className="text-right">Unit Cost</Th><Th>Batch #</Th><Th>Mfg</Th><Th>Expiry</Th><Th /></tr></thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={it.key}>
                      <Td className="font-medium">{medicines.find((m) => m.id === it.medicineId)?.name}</Td>
                      <Td className="text-right"><Input type="number" value={it.orderedQty} onChange={(e) => setItems((p) => p.map((x, j) => j === i ? { ...x, orderedQty: Math.max(1, Number(e.target.value) || 1) } : x))} className="h-8 w-20" /></Td>
                      <Td className="text-right"><Input type="number" value={it.unitCost} onChange={(e) => setItems((p) => p.map((x, j) => j === i ? { ...x, unitCost: Math.max(0, Number(e.target.value) || 0) } : x))} className="h-8 w-24" /></Td>
                      <Td><Input value={it.batchNo} onChange={(e) => setItems((p) => p.map((x, j) => j === i ? { ...x, batchNo: e.target.value } : x))} className="h-8 w-28" /></Td>
                      <Td><Input type="date" value={it.mfgDate} onChange={(e) => setItems((p) => p.map((x, j) => j === i ? { ...x, mfgDate: e.target.value } : x))} className="h-8 w-36" /></Td>
                      <Td><Input type="date" value={it.expiryDate} onChange={(e) => setItems((p) => p.map((x, j) => j === i ? { ...x, expiryDate: e.target.value } : x))} className="h-8 w-36" /></Td>
                      <Td><button onClick={() => setItems((p) => p.filter((_, j) => j !== i))} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!items.length && <EmptyState title="No medicines added" message="Use the dropdown above to add medicines to this order." />}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Discount (Rs.)"><Input type="number" value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value) || 0)} /></Field>
            <Field label="Tax (Rs.)"><Input type="number" value={tax || ""} onChange={(e) => setTax(Number(e.target.value) || 0)} /></Field>
            <Field label="Paid Now (Rs.)" hint={receiveNow ? "Recorded as supplier payment" : "Applies when receiving"}>
              <Input type="number" value={paidAmount || ""} onChange={(e) => setPaidAmount(Number(e.target.value) || 0)} disabled={!receiveNow} />
            </Field>
            <Field label="Receive Immediately">
              <Select value={receiveNow ? "yes" : "no"} onChange={(e) => setReceiveNow(e.target.value === "yes")}>
                <option value="no">No — receive later</option>
                <option value="yes">Yes — receive now</option>
              </Select>
            </Field>
          </div>
          <Field label="Notes"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" /></Field>
          <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-[13px]">
            <Row label="Subtotal" value={fmt(draftSubtotal)} />
            <Row label="Discount" value={`−${fmt(discount)}`} />
            <Row label="Tax" value={fmt(tax)} />
            <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-800"><span>Total</span><span>{fmt(draftTotal)}</span></div>
          </div>
        </div>
      </Modal>

      {/* Detail */}
      <Modal open={!!detailPur} onClose={() => setDetail(null)} title={`Purchase ${detailPur?.refNo ?? ""}`} subtitle={detailPur ? `${detailPur.supplierName} · ${formatDateTime(detailPur.date)}` : ""} size="lg">
        {detailPur && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone[detailPur.status]}>{detailPur.status.replace("_", " ")}</Badge>
              <Badge tone="slate">{detailPur.items.length} items</Badge>
            </div>
            <TableWrap>
              <table className="w-full min-w-[560px]">
                <thead><tr><Th>Medicine</Th><Th className="text-right">Ordered</Th><Th className="text-right">Received</Th><Th className="text-right">Cost</Th><Th>Batch</Th><Th>Expiry</Th></tr></thead>
                <tbody>
                  {detailPur.items.map((it) => (
                    <tr key={it.id}>
                      <Td className="font-medium">{it.medicineName}</Td>
                      <Td className="text-right">{it.orderedQty}</Td>
                      <Td className={cn("text-right font-semibold", it.receivedQty >= it.orderedQty ? "text-emerald-600" : it.receivedQty > 0 ? "text-amber-600" : "text-rose-500")}>{it.receivedQty}</Td>
                      <Td className="text-right">{fmt(it.unitCost)}</Td>
                      <Td className="font-mono text-[11px]">{it.batchNo || "—"}</Td>
                      <Td>{it.expiryDate ? formatDate(it.expiryDate) : "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-[13px]">
              <Row label="Subtotal" value={fmt(detailPur.subtotal)} />
              {detailPur.discount > 0 && <Row label="Discount" value={`−${fmt(detailPur.discount)}`} />}
              {detailPur.tax > 0 && <Row label="Tax" value={fmt(detailPur.tax)} />}
              <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-800"><span>Total</span><span>{fmt(detailPur.total)}</span></div>
              <Row label="Paid" value={fmt(detailPur.paidAmount)} />
            </div>
            {detailRcv.length > 0 && (
              <div>
                <div className="mb-1.5 text-xs font-semibold text-slate-600">Receiving history</div>
                {detailRcv.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-[13px]">
                    <div>
                      <div className="font-medium text-slate-700">{r.receiveNo}</div>
                      <div className="text-[11px] text-slate-400">{formatDate(r.date.slice(0, 10))} · {r.items.length} items · by {r.receivedBy}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{fmt(r.total)}</span>
                      <Button size="sm" variant="outline" onClick={() => printReceivingDoc(r, settings)}>Print GRN</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {(detailPur.status === "ordered" || detailPur.status === "partially_received") && (
              <Button className="w-full" onClick={() => { setDetail(null); window.location.assign(`/receiving?po=${detailPur.id}`); }}>
                <PackageCheck className="h-4 w-4" /> Receive Goods
              </Button>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!cancelTarget} onClose={() => setCancelTarget(null)} danger title="Cancel purchase order?"
        message={`Cancel ${cancelTarget?.refNo}? Only unreceived orders can be cancelled.`} confirmLabel="Cancel Order"
        onConfirm={() => { if (cancelTarget) { store.cancelPurchase(cancelTarget.id); toast.success("Order cancelled", cancelTarget.refNo); } }}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-slate-600"><span>{label}</span><span className="font-medium text-slate-700">{value}</span></div>;
}
