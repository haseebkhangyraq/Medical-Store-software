"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Truck, Banknote, Download, Printer, Receipt, Landmark } from "lucide-react";
import { useStore, getSupplierBalance } from "@/lib/store";
import { Card, Button, Input, Select, Textarea, Badge, Modal, Field, EmptyState, PageHeader, TableWrap, Th, Td, StatCard, ConfirmDialog, SearchInput, Tabs } from "@/components/ui";
import { toast } from "@/components/toast";
import { formatCurrency, formatDate, formatDateTime, downloadCSV, cn, printArea } from "@/lib/utils";
import type { Supplier } from "@/lib/types";

const empty = { name: "", companyName: "", contactPerson: "", phone: "", email: "", address: "", taxNo: "", openingBalance: 0 };

export default function SuppliersPage() {
  const store = useStore();
  const suppliers = useStore((s) => s.suppliers);
  const purchases = useStore((s) => s.purchases);
  const payments = useStore((s) => s.supplierPayments);
  const returns = useStore((s) => s.purchaseReturns);
  const settings = useStore((s) => s.settings);

  const [q, setQ] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [detail, setDetail] = useState<Supplier | null>(null);
  const [detailTab, setDetailTab] = useState("purchases");
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [payOpen, setPayOpen] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("cash");
  const [payRef, setPayRef] = useState("");

  const cur = settings.currency;
  const fmt = (n: number) => formatCurrency(n, cur);

  const balances = useMemo(() =>
    new Map(suppliers.map((s) => [s.id, getSupplierBalance(suppliers, s.id, purchases, payments)])),
  [suppliers, purchases, payments]);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return suppliers.filter((s) => !query || s.name.toLowerCase().includes(query) || s.contactPerson.toLowerCase().includes(query) || s.phone.includes(query));
  }, [suppliers, q]);

  const totalPayable = useMemo(() => [...balances.values()].reduce((s, v) => s + Math.max(0, v), 0), [balances]);

  function saveForm() {
    if (!form.name.trim()) { toast.error("Supplier name required"); return; }
    if (editing) {
      store.updateSupplier(editing.id, form);
      toast.success("Supplier updated", form.name);
    } else {
      store.addSupplier({ ...form, openingBalance: Number(form.openingBalance) || 0 });
      toast.success("Supplier added", form.name);
    }
    setFormOpen(false);
  }

  function recordPayment() {
    if (!payOpen) return;
    if (payAmount <= 0) { toast.error("Enter a valid amount"); return; }
    const p = store.paySupplier(payOpen.id, payAmount, payMethod as any, payRef || undefined);
    toast.success("Payment recorded", `${p.paymentNo} — ${fmt(payAmount)} to ${payOpen.name}`);
    setPayOpen(null); setPayAmount(0); setPayRef("");
  }

  function printStatement(sup: Supplier) {
    const bal = balances.get(sup.id) ?? 0;
    const po = purchases.filter((p) => p.supplierId === sup.id);
    const pays = payments.filter((p) => p.supplierId === sup.id);
    const prs = returns.filter((r) => r.supplierId === sup.id);
    const entries = [
      ...po.map((p) => ({ date: p.date.slice(0, 10), ref: p.refNo, desc: "Purchase invoice", debit: p.status === "ordered" ? 0 : p.items.reduce((s, i) => s + i.receivedQty * i.unitCost, 0), credit: 0 })),
      ...pays.map((p) => ({ date: p.date, ref: p.paymentNo, desc: "Payment", debit: 0, credit: p.amount })),
      ...prs.map((r) => ({ date: r.date.slice(0, 10), ref: r.returnNo, desc: "Purchase return", debit: 0, credit: r.totalRefund })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    let running = sup.openingBalance;
    const rowsHtml = entries.map((e) => {
      running += e.debit - e.credit;
      return `<tr><td>${e.date}</td><td>${e.ref}</td><td>${e.desc}</td><td class="num">${e.debit || ""}</td><td class="num">${e.credit || ""}</td><td class="num"><b>${running}</b></td></tr>`;
    }).join("");
    printArea(`<div class="invoice"><div class="inv-head"><div><div class="inv-logo">${settings.pharmacyName}</div><div class="muted" style="font-size:11px">${settings.address}</div></div>
      <div style="text-align:right"><div style="font-size:16px;font-weight:700">SUPPLIER STATEMENT</div>
      <div class="muted" style="font-size:12px">${sup.name}<br/>${sup.contactPerson} · ${sup.phone}</div></div></div>
      <div class="mt16" style="font-size:12px"><span class="muted">Opening Balance:</span> <b>${fmt(sup.openingBalance)}</b> &nbsp; <span class="muted">Closing Balance:</span> <b>${fmt(bal)}</b></div>
      <table class="mt8"><thead><tr><th>Date</th><th>Reference</th><th>Description</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead><tbody>${rowsHtml || '<tr><td colspan="6" class="center muted">No transactions</td></tr>'}</tbody></table>
      <div class="mt8 muted" style="font-size:10px;text-align:center">Demonstration document</div></div>`, `Statement ${sup.name}`);
  }

  const detailSup = detail ? suppliers.find((s) => s.id === detail.id) ?? detail : null;

  return (
    <div>
      <PageHeader title="Suppliers" subtitle="Distributors, ledgers and outstanding payables"
        actions={<Button size="sm" onClick={() => { setEditing(null); setForm({ ...empty }); setFormOpen(true); }}><Plus className="h-4 w-4" /> Add Supplier</Button>} />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Suppliers" value={String(suppliers.length)} icon={<Truck className="h-5 w-5" />} tone="navy" />
        <StatCard label="Total Payable" value={fmt(totalPayable)} icon={<Landmark className="h-5 w-5" />} tone="red" />
        <StatCard label="Payments Made" value={fmt(payments.reduce((s, p) => s + p.amount, 0))} icon={<Banknote className="h-5 w-5" />} tone="green" />
      </div>

      <Card className="mb-4 p-3">
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search suppliers…" className="sm:max-w-xs" />
      </Card>

      <Card>
        <TableWrap>
          <table className="w-full min-w-[840px]">
            <thead><tr><Th>Supplier</Th><Th>Contact</Th><Th>Phone</Th><Th className="text-right">Purchases</Th><Th className="text-right">Paid</Th><Th className="text-right">Balance</Th><Th className="text-right">Actions</Th></tr></thead>
            <tbody>
              {rows.map((s) => {
                const bal = balances.get(s.id) ?? 0;
                const pur = purchases.filter((p) => p.supplierId === s.id);
                const paid = payments.filter((p) => p.supplierId === s.id).reduce((x, p) => x + p.amount, 0);
                return (
                  <tr key={s.id}>
                    <Td><div className="font-medium text-slate-800">{s.name}</div><div className="text-[11px] text-slate-400">{s.companyName}</div></Td>
                    <Td>{s.contactPerson}<div className="text-[11px] text-slate-400">{s.email}</div></Td>
                    <Td>{s.phone}</Td>
                    <Td className="text-right">{fmt(pur.reduce((x, p) => x + (p.status === "ordered" ? 0 : p.items.reduce((y, i) => y + i.receivedQty * i.unitCost, 0)), 0))}</Td>
                    <Td className="text-right text-emerald-600">{fmt(paid)}</Td>
                    <Td className="text-right">
                      <span className={cn("font-bold", bal > 0 ? "text-rose-600" : "text-emerald-600")}>{fmt(bal)}</span>
                      <div className="text-[10px] text-slate-400">{bal > 0 ? "payable" : "settled"}</div>
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="secondary" onClick={() => { setPayOpen(s); setPayAmount(Math.max(0, bal)); }}><Banknote className="h-3.5 w-3.5" /> Pay</Button>
                        <Button size="icon" variant="ghost" title="Ledger" onClick={() => { setDetail(s); setDetailTab("purchases"); }}><Receipt className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" title="Edit" onClick={() => { setEditing(s); setForm({ ...s }); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-rose-500 hover:bg-rose-50" onClick={() => setDeleteTarget(s)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
              {!rows.length && <tr><Td colSpan={7}><EmptyState title="No suppliers found" action={<Button size="sm" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> Add Supplier</Button>} /></Td></tr>}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {/* Add/Edit */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit Supplier" : "Add Supplier"} size="md"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button><Button onClick={saveForm}>Save</Button></div>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Supplier Name" required className="col-span-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Company Name"><Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></Field>
          <Field label="Contact Person"><Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Tax / NTN #"><Input value={form.taxNo} onChange={(e) => setForm({ ...form, taxNo: e.target.value })} /></Field>
          <Field label="Opening Balance (Rs.)" hint="Payable amount carried forward"><Input type="number" value={form.openingBalance || ""} onChange={(e) => setForm({ ...form, openingBalance: Number(e.target.value) || 0 })} /></Field>
          <Field label="Address" className="col-span-2"><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        </div>
      </Modal>

      {/* Detail / ledger */}
      <Modal open={!!detailSup} onClose={() => setDetail(null)} title={detailSup?.name ?? ""} subtitle={detailSup ? `${detailSup.contactPerson} · ${detailSup.phone} · ${detailSup.taxNo}` : ""} size="lg"
        footer={detailSup && <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => printStatement(detailSup)}><Printer className="h-4 w-4" /> Print Statement</Button>
          <Button onClick={() => { setPayOpen(detailSup); setPayAmount(Math.max(0, balances.get(detailSup.id) ?? 0)); }}><Banknote className="h-4 w-4" /> Record Payment</Button>
        </div>}>
        {detailSup && (
          <div>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] uppercase text-slate-400">Balance</div><div className={cn("text-lg font-bold", (balances.get(detailSup.id) ?? 0) > 0 ? "text-rose-600" : "text-emerald-600")}>{fmt(balances.get(detailSup.id) ?? 0)}</div></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] uppercase text-slate-400">Opening</div><div className="text-lg font-bold text-slate-700">{fmt(detailSup.openingBalance)}</div></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] uppercase text-slate-400">Orders</div><div className="text-lg font-bold text-slate-700">{purchases.filter((p) => p.supplierId === detailSup.id).length}</div></div>
            </div>
            <Tabs active={detailTab} onChange={setDetailTab} className="mb-3"
              tabs={[{ id: "purchases", label: "Purchases" }, { id: "payments", label: "Payments", count: payments.filter((p) => p.supplierId === detailSup.id).length }, { id: "returns", label: "Returns" }, { id: "info", label: "Info" }]} />

            {detailTab === "purchases" && (
              <TableWrap>
                <table className="w-full">
                  <thead><tr><Th>Ref</Th><Th>Date</Th><Th className="text-right">Total</Th><Th className="text-right">Paid</Th><Th>Status</Th></tr></thead>
                  <tbody>
                    {purchases.filter((p) => p.supplierId === detailSup.id).map((p) => (
                      <tr key={p.id}>
                        <Td className="font-mono text-[12px]">{p.refNo}</Td>
                        <Td>{formatDate(p.date.slice(0, 10))}</Td>
                        <Td className="text-right font-semibold">{fmt(p.total)}</Td>
                        <Td className="text-right">{fmt(p.paidAmount)}</Td>
                        <Td><Badge tone={p.status === "received" ? "green" : p.status === "cancelled" ? "slate" : "amber"}>{p.status.replace("_", " ")}</Badge></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
            {detailTab === "payments" && (
              <div className="space-y-1">
                {payments.filter((p) => p.supplierId === detailSup.id).map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-[13px]">
                    <div><div className="font-medium text-slate-700">{p.paymentNo}</div><div className="text-[11px] text-slate-400">{formatDate(p.date)} · {p.method} {p.reference ? `· ${p.reference}` : ""}</div></div>
                    <span className="font-semibold text-emerald-600">{fmt(p.amount)}</span>
                  </div>
                ))}
                {!payments.some((p) => p.supplierId === detailSup.id) && <EmptyState title="No payments recorded" />}
              </div>
            )}
            {detailTab === "returns" && (
              <div className="space-y-1">
                {returns.filter((r) => r.supplierId === detailSup.id).map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-[13px]">
                    <div><div className="font-medium text-slate-700">{r.returnNo} <span className="text-slate-400">· {r.refNo}</span></div><div className="text-[11px] text-slate-400">{formatDate(r.date.slice(0, 10))} · {r.reason}</div></div>
                    <span className="font-semibold text-rose-600">−{fmt(r.totalRefund)}</span>
                  </div>
                ))}
                {!returns.some((r) => r.supplierId === detailSup.id) && <EmptyState title="No purchase returns" />}
              </div>
            )}
            {detailTab === "info" && (
              <div className="space-y-1.5 text-[13px] text-slate-600">
                <p><b>Company:</b> {detailSup.companyName}</p>
                <p><b>Email:</b> {detailSup.email}</p>
                <p><b>Address:</b> {detailSup.address}</p>
                <p><b>Tax #:</b> {detailSup.taxNo}</p>
                <p><b>Since:</b> {formatDate(detailSup.createdAt.slice(0, 10))}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Payment */}
      <Modal open={!!payOpen} onClose={() => setPayOpen(null)} title="Record Supplier Payment" size="sm"
        subtitle={payOpen ? `${payOpen.name} · balance ${fmt(balances.get(payOpen.id) ?? 0)}` : ""}
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setPayOpen(null)}>Cancel</Button><Button variant="success" onClick={recordPayment}>Record Payment</Button></div>}>
        <div className="space-y-3">
          <Field label="Amount (Rs.)" required><Input type="number" value={payAmount || ""} onChange={(e) => setPayAmount(Number(e.target.value) || 0)} /></Field>
          <Field label="Method">
            <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              <option value="cash">Cash</option><option value="card">Card</option><option value="bank_transfer">Bank Transfer</option><option value="mobile_wallet">Mobile Wallet</option>
            </Select>
          </Field>
          <Field label="Reference / Cheque #"><Input value={payRef} onChange={(e) => setPayRef(e.target.value)} /></Field>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} danger title="Delete supplier?"
        message={`Delete ${deleteTarget?.name}? Purchase history remains but will be unlinked.`} confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) { store.deleteSupplier(deleteTarget.id); toast.success("Supplier deleted"); } }} />
    </div>
  );
}
