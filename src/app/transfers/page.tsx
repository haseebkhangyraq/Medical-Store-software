"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, Button, Input, Select, Modal, Field, EmptyState, PageHeader, TableWrap, Th, Td, StatCard, Textarea } from "@/components/ui";
import { toast } from "@/components/toast";
import { formatDate, cn } from "@/lib/utils";
import { liveBatches, sellableStock } from "@/lib/stock";
import type { StockTransfer } from "@/lib/types";

interface Line { key: string; medicineId: string; batchId: string; quantity: number }

export default function TransfersPage() {
  const store = useStore();
  const transfers = useStore((s) => s.transfers);
  const medicines = useStore((s) => s.medicines);
  const settings = useStore((s) => s.settings);

  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(settings.storageLocations[0] ?? "Main Store");
  const [to, setTo] = useState(settings.storageLocations[1] ?? "Cold Storage");
  const [authorizedBy, setAuthorizedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [pick, setPick] = useState("");

  const units = transfers.reduce((s, t) => s + t.items.reduce((x, i) => x + i.quantity, 0), 0);

  function addLine(medicineId: string) {
    const med = medicines.find((m) => m.id === medicineId);
    if (!med) return;
    const batches = liveBatches(med);
    if (!batches.length) { toast.error("No live batches", `${med.name} has no in-stock, non-expired batches.`); return; }
    setLines((p) => [...p, { key: `${medicineId}_${p.length}`, medicineId, batchId: batches[0].id, quantity: 1 }]);
    setPick("");
  }

  function submit() {
    if (from === to) { toast.error("Locations must differ", "Source and destination cannot be the same."); return; }
    if (!authorizedBy.trim()) { toast.error("Authorized person required"); return; }
    const res = store.createTransfer({
      fromLocation: from, toLocation: to, authorizedBy: authorizedBy.trim(), notes: notes || undefined,
      items: lines.map((l) => ({ medicineId: l.medicineId, batchId: l.batchId, quantity: l.quantity })),
    });
    if ("error" in res) { toast.error("Transfer failed", res.error); return; }
    toast.success("Transfer recorded", `${res.transferNo} — ${res.items.length} items moved`);
    setOpen(false);
    setLines([]); setNotes("");
  }

  return (
    <div>
      <PageHeader title="Stock Transfers" subtitle="Move stock between branches and storage locations"
        actions={<Button size="sm" onClick={() => { setAuthorizedBy(store.currentUser?.name ?? ""); setOpen(true); }}><Plus className="h-4 w-4" /> New Transfer</Button>} />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Transfers" value={String(transfers.length)} icon={<ArrowLeftRight className="h-5 w-5" />} tone="navy" />
        <StatCard label="Units Moved" value={String(units)} icon={<ArrowLeftRight className="h-5 w-5" />} tone="blue" />
        <StatCard label="Locations" value={String(settings.storageLocations.length)} icon={<ArrowLeftRight className="h-5 w-5" />} tone="violet" />
      </div>

      <Card>
        <TableWrap>
          <table className="w-full min-w-[760px]">
            <thead><tr><Th>Transfer #</Th><Th>Date</Th><Th>From → To</Th><Th>Authorized By</Th><Th className="text-right">Items</Th><Th className="text-right">Units</Th><Th>Notes</Th></tr></thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id}>
                  <Td className="font-mono text-[12px] font-semibold">{t.transferNo}</Td>
                  <Td>{formatDate(t.date.slice(0, 10))}</Td>
                  <Td><span className="font-medium">{t.fromLocation}</span> <ArrowLeftRight className="inline h-3.5 w-3.5 text-slate-400" /> <span className="font-medium">{t.toLocation}</span></Td>
                  <Td>{t.authorizedBy}</Td>
                  <Td className="text-right">{t.items.length}</Td>
                  <Td className="text-right font-semibold">{t.items.reduce((s, i) => s + i.quantity, 0)}</Td>
                  <Td className="max-w-[200px] truncate text-slate-500">{t.notes ?? "—"}</Td>
                </tr>
              ))}
              {!transfers.length && (
                <tr><Td colSpan={7}><EmptyState icon={<ArrowLeftRight className="h-7 w-7" />} title="No transfers yet" message="Record stock movements between storage locations." action={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New Transfer</Button>} /></Td></tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Stock Transfer" size="xl"
        subtitle="Recorded in the movement ledger for audit"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit}>Confirm Transfer</Button></div>}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="From Location" required>
              <Select value={from} onChange={(e) => setFrom(e.target.value)}>
                {settings.storageLocations.map((l) => <option key={l}>{l}</option>)}
              </Select>
            </Field>
            <Field label="To Location" required>
              <Select value={to} onChange={(e) => setTo(e.target.value)}>
                {settings.storageLocations.map((l) => <option key={l}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Authorized By" required><Input value={authorizedBy} onChange={(e) => setAuthorizedBy(e.target.value)} /></Field>
          </div>

          <Field label="Add Medicine">
            <Select value={pick} onChange={(e) => { if (e.target.value) addLine(e.target.value); }}>
              <option value="">— Select medicine —</option>
              {medicines.filter((m) => sellableStock(m) > 0).map((m) => <option key={m.id} value={m.id}>{m.name} ({sellableStock(m)})</option>)}
            </Select>
          </Field>

          {lines.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[600px]">
                <thead><tr><Th>Medicine</Th><Th>Batch</Th><Th className="text-right">Available</Th><Th className="text-right">Qty</Th><Th /></tr></thead>
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
                            onChange={(e) => setLines((p) => p.map((x, j) => j === i ? { ...x, quantity: Math.max(1, Math.min(batch.quantity, Number(e.target.value) || 1)) } : x))}
                            className={cn("h-8 w-20")} />
                        </Td>
                        <Td><button onClick={() => setLines((p) => p.filter((_, j) => j !== i))} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!lines.length && <EmptyState title="No items selected" message="Add medicines to transfer." />}

          <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional…" /></Field>
        </div>
      </Modal>
    </div>
  );
}
