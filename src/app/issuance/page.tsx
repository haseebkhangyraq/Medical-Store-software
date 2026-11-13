"use client";

import { useMemo, useState } from "react";
import { FileOutput, Plus, Trash2, Printer, AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, Button, Input, Select, Badge, Modal, Field, EmptyState, PageHeader, TableWrap, Th, Td, StatCard, SearchInput } from "@/components/ui";
import { toast } from "@/components/toast";
import { formatCurrency, formatDate, formatDateTime, cn } from "@/lib/utils";
import { liveBatches, sellableStock } from "@/lib/stock";
import { printIssuanceVoucher } from "@/components/prints";
import { printModuleReport } from "@/components/module-print";
import type { Issuance } from "@/lib/types";

const REASONS: Record<Issuance["reason"], string> = {
  internal_use: "Internal Use", damaged: "Damaged Stock", expired: "Expired Stock",
  sample: "Sample Distribution", adjustment: "Stock Adjustment", other: "Other (authorized)",
};

const reasonTone: Record<Issuance["reason"], "red" | "amber" | "blue" | "slate" | "violet" | "green"> = {
  internal_use: "blue", damaged: "amber", expired: "red", sample: "violet", adjustment: "slate", other: "green",
};

interface Line { key: string; medicineId: string; batchId: string; quantity: number }

export default function IssuancePage() {
  const store = useStore();
  const medicines = useStore((s) => s.medicines);
  const issuances = useStore((s) => s.issuances);
  const settings = useStore((s) => s.settings);

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Issuance["reason"]>("internal_use");
  const [destination, setDestination] = useState("Main Store");
  const [authorizedBy, setAuthorizedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [pick, setPick] = useState("");

  const cur = settings.currency;
  const fmt = (n: number) => formatCurrency(n, cur);

  const stats = useMemo(() => ({
    count: issuances.length,
    value: issuances.reduce((s, i) => s + i.totalValue, 0),
    expired: issuances.filter((i) => i.reason === "expired").reduce((s, i) => s + i.items.reduce((x, it) => x + it.quantity, 0), 0),
  }), [issuances]);

  function printSummary() {
    printModuleReport({
      title: "Stock Issuance",
      pharmacyName: settings.pharmacyName,
      address: settings.address,
      branchName: settings.branchName,
      kpis: [
        ["Issue Vouchers", String(stats.count)],
        ["Total Value Issued", fmt(stats.value)],
        ["Expired Units Removed", String(stats.expired)],
      ],
      sections: [{
        heading: "Issuance Vouchers",
        columns: ["Voucher #", "Date", "Reason", "Destination", "Items", "Value"],
        right: [4, 5],
        rows: issuances.slice(0, 60).map((i) => [
          i.voucherNo, formatDate(i.date.slice(0, 10)), REASONS[i.reason],
          i.destination, String(i.items.length), fmt(i.totalValue),
        ]),
      }],
      note: `Showing ${Math.min(issuances.length, 60)} of ${issuances.length} vouchers.`,
    });
  }

  const totalValue = lines.reduce((s, l) => {
    const med = medicines.find((m) => m.id === l.medicineId);
    const batch = med?.batches.find((b) => b.id === l.batchId);
    return s + (batch ? batch.purchasePrice * l.quantity : 0);
  }, 0);

  function addLine(medicineId: string) {
    const med = medicines.find((m) => m.id === medicineId);
    if (!med) return;
    const batches = liveBatches(med);
    if (!batches.length) { toast.error("No live batches", `${med.name} has no in-stock, non-expired batches.`); return; }
    setLines((p) => [...p, { key: `${medicineId}_${p.length}`, medicineId, batchId: batches[0].id, quantity: 1 }]);
    setPick("");
  }

  function submit() {
    if (!destination.trim()) { toast.error("Destination required"); return; }
    if (!authorizedBy.trim()) { toast.error("Authorized person is required"); return; }
    const res = store.createIssuance({
      destination, reason, authorizedBy: authorizedBy.trim(), notes: notes || undefined,
      items: lines.map((l) => ({ medicineId: l.medicineId, batchId: l.batchId, quantity: l.quantity })),
    });
    if ("error" in res) { toast.error("Issuance failed", res.error); return; }
    toast.success("Stock issued", `${res.voucherNo} — ${res.items.length} items, value ${fmt(res.totalValue)}`);
    printIssuanceVoucher(res, settings);
    setOpen(false);
    setLines([]); setNotes("");
  }

  return (
    <div>
      <PageHeader title="Stock Issuance" subtitle="Issue stock for internal use, damage, expiry, samples — every issue is ledgered"
        actions={<>
          <Button variant="outline" size="sm" onClick={printSummary}><Printer className="h-4 w-4" /> Print Summary</Button>
          <Button size="sm" onClick={() => { setAuthorizedBy(store.currentUser?.name ?? ""); setOpen(true); }}><Plus className="h-4 w-4" /> New Issuance</Button>
        </>} />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Issue Vouchers" value={String(stats.count)} icon={<FileOutput className="h-5 w-5" />} tone="navy" />
        <StatCard label="Total Value Issued" value={fmt(stats.value)} icon={<AlertTriangle className="h-5 w-5" />} tone="amber" />
        <StatCard label="Expired Units Removed" value={String(stats.expired)} icon={<AlertTriangle className="h-5 w-5" />} tone="red" />
      </div>

      <Card>
        <TableWrap>
          <table className="w-full min-w-[820px]">
            <thead><tr><Th>Voucher #</Th><Th>Date</Th><Th>Reason</Th><Th>Destination</Th><Th>Authorized By</Th><Th className="text-right">Items</Th><Th className="text-right">Value</Th><Th className="text-right">Doc</Th></tr></thead>
            <tbody>
              {issuances.map((iss) => (
                <tr key={iss.id}>
                  <Td className="font-mono text-[12px] font-semibold">{iss.voucherNo}</Td>
                  <Td>{formatDate(iss.date.slice(0, 10))}</Td>
                  <Td><Badge tone={reasonTone[iss.reason]}>{REASONS[iss.reason]}</Badge></Td>
                  <Td>{iss.destination}</Td>
                  <Td>{iss.authorizedBy}</Td>
                  <Td className="text-right">{iss.items.reduce((s, i) => s + i.quantity, 0)}</Td>
                  <Td className="text-right font-semibold">{fmt(iss.totalValue)}</Td>
                  <Td className="text-right"><Button size="sm" variant="outline" onClick={() => printIssuanceVoucher(iss, settings)}><Printer className="h-3.5 w-3.5" /> Voucher</Button></Td>
                </tr>
              ))}
              {!issuances.length && <tr><Td colSpan={8}><EmptyState icon={<FileOutput className="h-7 w-7" />} title="No issuances recorded" message="Issue stock for damage, expiry, samples or internal use." action={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New Issuance</Button>} /></Td></tr>}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Stock Issue Voucher" size="xl"
        subtitle="Select medicine and batch — stock decreases from the chosen batch only"
        footer={
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-700">Total value: {fmt(totalValue)}</div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit}>Issue & Generate Voucher</Button>
            </div>
          </div>
        }>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Reason" required>
              <Select value={reason} onChange={(e) => setReason(e.target.value as Issuance["reason"])}>
                {Object.entries(REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Destination" required>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Cold Storage / Branch B" />
            </Field>
            <Field label="Authorized Person" required>
              <Input value={authorizedBy} onChange={(e) => setAuthorizedBy(e.target.value)} placeholder="Name of authorizing staff" />
            </Field>
            <Field label="Issue Date"><Input value={formatDate(new Date().toISOString().slice(0, 10))} disabled /></Field>
          </div>

          <Field label="Add Medicine">
            <Select value={pick} onChange={(e) => { if (e.target.value) addLine(e.target.value); }}>
              <option value="">— Select medicine —</option>
              {medicines.filter((m) => sellableStock(m) > 0).map((m) => <option key={m.id} value={m.id}>{m.name} ({sellableStock(m)} available)</option>)}
            </Select>
          </Field>

          {lines.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[640px]">
                <thead><tr><Th>Medicine</Th><Th>Batch</Th><Th className="text-right">Available</Th><Th className="text-right">Qty</Th><Th className="text-right">Cost</Th><Th className="text-right">Value</Th><Th /></tr></thead>
                <tbody>
                  {lines.map((l, i) => {
                    const med = medicines.find((m) => m.id === l.medicineId)!;
                    const batch = med.batches.find((b) => b.id === l.batchId)!;
                    return (
                      <tr key={l.key}>
                        <Td className="font-medium">{med.name}</Td>
                        <Td>
                          <Select value={l.batchId} onChange={(e) => setLines((p) => p.map((x, j) => j === i ? { ...x, batchId: e.target.value } : x))} className="h-8 w-44 text-xs">
                            {liveBatches(med).map((b) => <option key={b.id} value={b.id}>{b.batchNo} · exp {b.expiryDate.slice(0, 10)} ({b.quantity})</option>)}
                          </Select>
                        </Td>
                        <Td className="text-right">{batch.quantity}</Td>
                        <Td className="text-right">
                          <Input type="number" value={l.quantity} min={1} max={batch.quantity}
                            onChange={(e) => {
                              const v = Math.max(1, Math.min(batch.quantity, Number(e.target.value) || 1));
                              setLines((p) => p.map((x, j) => j === i ? { ...x, quantity: v } : x));
                            }}
                            className={cn("h-8 w-20")} />
                        </Td>
                        <Td className="text-right">{fmt(batch.purchasePrice)}</Td>
                        <Td className="text-right font-semibold">{fmt(batch.purchasePrice * l.quantity)}</Td>
                        <Td><button onClick={() => setLines((p) => p.filter((_, j) => j !== i))} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!lines.length && <EmptyState title="No items selected" message="Add medicines above to build the issue voucher." />}

          <Field label="Notes"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional justification…" /></Field>
        </div>
      </Modal>
    </div>
  );
}
