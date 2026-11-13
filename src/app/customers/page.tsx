"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Users, Banknote, Printer, Receipt, Phone, Download } from "lucide-react";
import { useStore, getCustomerBalance } from "@/lib/store";
import { printModuleReport } from "@/components/module-print";
import { Card, Button, Input, Select, Badge, Modal, Field, EmptyState, PageHeader, TableWrap, Th, Td, StatCard, ConfirmDialog, SearchInput, Tabs } from "@/components/ui";
import { toast } from "@/components/toast";
import { formatCurrency, formatDate, formatDateTime, downloadCSV, cn, printArea } from "@/lib/utils";
import type { Customer } from "@/lib/types";

const empty = { name: "", phone: "", address: "", type: "regular" as Customer["type"], creditLimit: 0, openingBalance: 0 };

export default function CustomersPage() {
  const store = useStore();
  const customers = useStore((s) => s.customers);
  const sales = useStore((s) => s.sales);
  const payments = useStore((s) => s.customerPayments);
  const settings = useStore((s) => s.settings);

  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [detail, setDetail] = useState<Customer | null>(null);
  const [detailTab, setDetailTab] = useState("purchases");
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [payOpen, setPayOpen] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("cash");

  const cur = settings.currency;
  const fmt = (n: number) => formatCurrency(n, cur);

  const balances = useMemo(() =>
    new Map(customers.map((c) => [c.id, getCustomerBalance(customers, c.id, sales, payments)])),
  [customers, sales, payments]);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return customers.filter((c) => {
      if (typeF !== "all" && c.type !== typeF) return false;
      return !query || c.name.toLowerCase().includes(query) || c.phone.includes(query);
    });
  }, [customers, q, typeF]);

  const totalReceivable = useMemo(() => [...balances.values()].reduce((s, v) => s + Math.max(0, v), 0), [balances]);

  function printSummary() {
    printModuleReport({
      title: "Customers Report",
      pharmacyName: settings.pharmacyName,
      address: settings.address,
      branchName: settings.branchName,
      kpis: [
        ["Customers", String(customers.length)],
        ["Total Receivable", fmt(totalReceivable)],
        ["Payments Received", fmt(payments.reduce((s, p) => s + p.amount, 0))],
        ["Credit Customers", String(customers.filter((c) => c.type !== "regular").length)],
      ],
      sections: [{
        heading: "Customer Directory & Balances",
        columns: ["Customer", "Phone", "Type", "Credit Limit", "Balance (Receivable)"],
        right: [3, 4],
        rows: rows.slice(0, 60).map((c) => [
          c.name, c.phone, c.type, fmt(c.creditLimit), fmt(balances.get(c.id) ?? 0),
        ]),
      }],
      note: `Showing ${Math.min(rows.length, 60)} of ${rows.length} customers.`,
    });
  }

  function saveForm() {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    if (editing) {
      store.updateCustomer(editing.id, form);
      toast.success("Customer updated", form.name);
    } else {
      store.addCustomer({ ...form, openingBalance: Number(form.openingBalance) || 0, creditLimit: Number(form.creditLimit) || 0 });
      toast.success("Customer added", form.name);
    }
    setFormOpen(false);
  }

  function recordPayment() {
    if (!payOpen) return;
    if (payAmount <= 0) { toast.error("Enter a valid amount"); return; }
    const p = store.payCustomer(payOpen.id, payAmount, payMethod as any);
    toast.success("Payment recorded", `${p.paymentNo} — ${fmt(payAmount)} from ${payOpen.name}`);
    setPayOpen(null); setPayAmount(0);
  }

  function printStatement(c: Customer) {
    const bal = balances.get(c.id) ?? 0;
    const mySales = sales.filter((s) => s.customerId === c.id);
    const myPays = payments.filter((p) => p.customerId === c.id);
    const myReturns = store.salesReturns.filter((r) => r.customerId === c.id);
    const entries = [
      ...mySales.map((s) => ({ date: s.date.slice(0, 10), ref: s.invoiceNo, desc: `Sales invoice (${s.status.replace("_", " ")})`, debit: s.total, credit: s.paidAmount })),
      ...myPays.map((p) => ({ date: p.date, ref: p.paymentNo, desc: "Payment received", debit: 0, credit: p.amount })),
      ...myReturns.map((r) => ({ date: r.date.slice(0, 10), ref: r.returnNo, desc: "Sales return", debit: 0, credit: r.totalRefund })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    let running = c.openingBalance;
    const rowsHtml = entries.map((e) => {
      running += e.debit - e.credit;
      return `<tr><td>${e.date}</td><td>${e.ref}</td><td>${e.desc}</td><td class="num">${e.debit || ""}</td><td class="num">${e.credit || ""}</td><td class="num"><b>${running}</b></td></tr>`;
    }).join("");
    printArea(`<div class="invoice"><div class="inv-head"><div><div class="inv-logo">${settings.pharmacyName}</div><div class="muted" style="font-size:11px">${settings.address}</div></div>
      <div style="text-align:right"><div style="font-size:16px;font-weight:700">CUSTOMER STATEMENT</div>
      <div class="muted" style="font-size:12px">${c.name}<br/>${c.phone || ""}${c.address ? ` · ${c.address}` : ""}</div></div></div>
      <div class="mt16" style="font-size:12px"><span class="muted">Customer Type:</span> <b>${c.type}</b> &nbsp; <span class="muted">Credit Limit:</span> <b>${fmt(c.creditLimit)}</b> &nbsp; <span class="muted">Opening Balance:</span> <b>${fmt(c.openingBalance)}</b> &nbsp; <span class="muted">Closing Balance:</span> <b>${fmt(bal)}</b></div>
      <table class="mt8"><thead><tr><th>Date</th><th>Reference</th><th>Description</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead><tbody>${rowsHtml || '<tr><td colspan="6" class="center muted">No transactions</td></tr>'}</tbody></table>
      <div class="mt8 muted" style="font-size:10px;text-align:center">Demonstration document</div></div>`, `Statement ${c.name}`);
  }

  function printLedger(c: Customer) {
    const bal = balances.get(c.id) ?? 0;
    const mySales = sales.filter((s) => s.customerId === c.id);
    const myPays = payments.filter((p) => p.customerId === c.id);
    const entries = [
      ...mySales.map((s) => ({ date: s.date.slice(0, 10), ref: s.invoiceNo, desc: `Invoice (${s.status.replace("_", " ")})`, debit: s.total, credit: s.paidAmount })),
      ...myPays.map((p) => ({ date: p.date, ref: p.paymentNo, desc: "Payment received", debit: 0, credit: p.amount })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    let running = c.openingBalance;
    const rowsHtml = entries.map((e) => {
      running += e.debit - e.credit;
      return `<tr><td>${e.date}</td><td>${e.ref}</td><td>${e.desc}</td><td class="num">${e.debit || ""}</td><td class="num">${e.credit || ""}</td><td class="num"><b>${running}</b></td></tr>`;
    }).join("");
    printArea(`<div class="invoice"><div class="inv-head"><div><div class="inv-logo">${settings.pharmacyName}</div></div>
      <div style="text-align:right"><div style="font-size:16px;font-weight:700">CUSTOMER LEDGER</div>
      <div class="muted" style="font-size:12px">${c.name}<br/>${c.phone || ""}</div></div></div>
      <div class="mt16" style="font-size:12px"><span class="muted">Opening:</span> <b>${fmt(c.openingBalance)}</b> &nbsp; <span class="muted">Credit Limit:</span> <b>${fmt(c.creditLimit)}</b> &nbsp; <span class="muted">Closing Balance:</span> <b>${fmt(bal)}</b></div>
      <table class="mt8"><thead><tr><th>Date</th><th>Reference</th><th>Description</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead><tbody>${rowsHtml || '<tr><td colspan="6" class="center muted">No transactions</td></tr>'}</tbody></table>
      <div class="mt8 muted" style="font-size:10px;text-align:center">Demonstration document</div></div>`, `Ledger ${c.name}`);
  }

  function exportCSV() {
    downloadCSV("customers", rows.map((c) => ({
      Name: c.name, Phone: c.phone, Type: c.type, Address: c.address,
      "Credit Limit": c.creditLimit, Balance: balances.get(c.id) ?? 0,
      "Total Purchases": sales.filter((s) => s.customerId === c.id).reduce((x, s) => x + s.total, 0),
    })));
  }

  const detailCus = detail ? customers.find((c) => c.id === detail.id) ?? detail : null;

  return (
    <div>
      <PageHeader title="Customers" subtitle="Profiles, purchase history and receivables"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={printSummary}><Printer className="h-4 w-4" /> Print Summary</Button>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4" /> Export</Button>
            <Button size="sm" onClick={() => { setEditing(null); setForm({ ...empty }); setFormOpen(true); }}><Plus className="h-4 w-4" /> Add Customer</Button>
          </>
        } />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Customers" value={String(customers.length)} icon={<Users className="h-5 w-5" />} tone="navy" />
        <StatCard label="Total Receivable" value={fmt(totalReceivable)} icon={<Banknote className="h-5 w-5" />} tone="amber" />
        <StatCard label="Payments Received" value={fmt(payments.reduce((s, p) => s + p.amount, 0))} icon={<Banknote className="h-5 w-5" />} tone="green" />
        <StatCard label="Wholesale Accounts" value={String(customers.filter((c) => c.type === "wholesale").length)} icon={<Users className="h-5 w-5" />} tone="violet" />
      </div>

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone…" className="sm:max-w-xs" />
          <Select value={typeF} onChange={(e) => setTypeF(e.target.value)} className="sm:w-44">
            <option value="all">All types</option><option value="regular">Regular</option><option value="wholesale">Wholesale</option><option value="walk-in">Walk-in</option>
          </Select>
        </div>
      </Card>

      <Card>
        <TableWrap>
          <table className="w-full min-w-[780px]">
            <thead><tr><Th>Customer</Th><Th>Type</Th><Th className="text-right">Invoices</Th><Th className="text-right">Total Purchases</Th><Th className="text-right">Credit Limit</Th><Th className="text-right">Balance</Th><Th className="text-right">Actions</Th></tr></thead>
            <tbody>
              {rows.map((c) => {
                const bal = balances.get(c.id) ?? 0;
                const mySales = sales.filter((s) => s.customerId === c.id);
                return (
                  <tr key={c.id}>
                    <Td>
                      <div className="font-medium text-slate-800">{c.name}</div>
                      <div className="text-[11px] text-slate-400">{c.phone || "—"}{c.address ? ` · ${c.address}` : ""}</div>
                    </Td>
                    <Td><Badge tone={c.type === "wholesale" ? "violet" : c.type === "walk-in" ? "slate" : "blue"}>{c.type}</Badge></Td>
                    <Td className="text-right">{mySales.length}</Td>
                    <Td className="text-right">{fmt(mySales.reduce((x, s) => x + s.total, 0))}</Td>
                    <Td className="text-right">{c.creditLimit ? fmt(c.creditLimit) : "—"}</Td>
                    <Td className="text-right"><span className={cn("font-bold", bal > 0 ? "text-amber-600" : "text-emerald-600")}>{fmt(bal)}</span></Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="secondary" onClick={() => { setPayOpen(c); setPayAmount(Math.max(0, bal)); }}><Banknote className="h-3.5 w-3.5" /> Payment</Button>
                        <Button size="icon" variant="ghost" title="Print Statement" onClick={() => printStatement(c)}><Printer className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" title="Ledger" onClick={() => { setDetail(c); setDetailTab("purchases"); }}><Receipt className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setForm({ name: c.name, phone: c.phone, address: c.address, type: c.type, creditLimit: c.creditLimit, openingBalance: c.openingBalance }); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-rose-500 hover:bg-rose-50" onClick={() => setDeleteTarget(c)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
              {!rows.length && <tr><Td colSpan={7}><EmptyState title="No customers found" action={<Button size="sm" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> Add Customer</Button>} /></Td></tr>}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit Customer" : "Add Customer"} size="md"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button><Button onClick={saveForm}>Save</Button></div>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full Name" required className="col-span-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="03xx-xxxxxxx" /></Field>
          <Field label="Customer Type">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Customer["type"] })}>
              <option value="regular">Regular</option><option value="wholesale">Wholesale</option><option value="walk-in">Walk-in</option>
            </Select>
          </Field>
          <Field label="Credit Limit (Rs.)"><Input type="number" value={form.creditLimit || ""} onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) || 0 })} /></Field>
          <Field label="Opening Balance (Rs.)"><Input type="number" value={form.openingBalance || ""} onChange={(e) => setForm({ ...form, openingBalance: Number(e.target.value) || 0 })} /></Field>
          <Field label="Address" className="col-span-2"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={!!detailCus} onClose={() => setDetail(null)} title={detailCus?.name ?? ""} subtitle={detailCus ? `${detailCus.type} · balance ${fmt(balances.get(detailCus.id) ?? 0)}` : ""} size="lg"
        footer={detailCus && <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => printLedger(detailCus)}><Printer className="h-4 w-4" /> Print Ledger</Button>
          <Button onClick={() => { setPayOpen(detailCus); setPayAmount(Math.max(0, balances.get(detailCus.id) ?? 0)); }}><Banknote className="h-4 w-4" /> Record Payment</Button>
        </div>}>
        {detailCus && (
          <div>
            <Tabs active={detailTab} onChange={setDetailTab} className="mb-3"
              tabs={[{ id: "purchases", label: "Purchase History", count: sales.filter((s) => s.customerId === detailCus.id).length }, { id: "payments", label: "Payments" }, { id: "info", label: "Info" }]} />
            {detailTab === "purchases" && (
              <TableWrap>
                <table className="w-full min-w-[560px]">
                  <thead><tr><Th>Invoice</Th><Th>Date</Th><Th className="text-right">Items</Th><Th className="text-right">Total</Th><Th className="text-right">Paid</Th><Th>Status</Th></tr></thead>
                  <tbody>
                    {sales.filter((s) => s.customerId === detailCus.id).map((s) => (
                      <tr key={s.id}>
                        <Td className="font-mono text-[12px]">{s.invoiceNo}</Td>
                        <Td>{formatDate(s.date.slice(0, 10))}</Td>
                        <Td className="text-right">{s.items.length}</Td>
                        <Td className="text-right font-semibold">{fmt(s.total)}</Td>
                        <Td className="text-right">{fmt(s.paidAmount)}</Td>
                        <Td><Badge tone={s.status === "completed" ? "green" : s.status === "returned" ? "slate" : "amber"}>{s.status.replace("_", " ")}</Badge></Td>
                      </tr>
                    ))}
                    {!sales.some((s) => s.customerId === detailCus.id) && <tr><Td colSpan={6}><EmptyState title="No purchases yet" /></Td></tr>}
                  </tbody>
                </table>
              </TableWrap>
            )}
            {detailTab === "payments" && (
              <div className="space-y-1">
                {payments.filter((p) => p.customerId === detailCus.id).map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-[13px]">
                    <div><div className="font-medium text-slate-700">{p.paymentNo}</div><div className="text-[11px] text-slate-400">{formatDate(p.date)} · {p.method}</div></div>
                    <span className="font-semibold text-emerald-600">{fmt(p.amount)}</span>
                  </div>
                ))}
                {!payments.some((p) => p.customerId === detailCus.id) && <EmptyState title="No payments recorded" />}
              </div>
            )}
            {detailTab === "info" && (
              <div className="space-y-1.5 text-[13px] text-slate-600">
                <p><b>Phone:</b> {detailCus.phone || "—"}</p>
                <p><b>Address:</b> {detailCus.address || "—"}</p>
                <p><b>Credit Limit:</b> {detailCus.creditLimit ? fmt(detailCus.creditLimit) : "No credit"}</p>
                <p><b>Registered:</b> {formatDate(detailCus.createdAt.slice(0, 10))}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!payOpen} onClose={() => setPayOpen(null)} title="Record Customer Payment" size="sm"
        subtitle={payOpen ? `${payOpen.name} · balance ${fmt(balances.get(payOpen.id) ?? 0)}` : ""}
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setPayOpen(null)}>Cancel</Button><Button variant="success" onClick={recordPayment}>Record Payment</Button></div>}>
        <div className="space-y-3">
          <Field label="Amount (Rs.)" required><Input type="number" value={payAmount || ""} onChange={(e) => setPayAmount(Number(e.target.value) || 0)} /></Field>
          <Field label="Method">
            <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              <option value="cash">Cash</option><option value="card">Card</option><option value="bank_transfer">Bank Transfer</option><option value="mobile_wallet">Mobile Wallet</option>
            </Select>
          </Field>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} danger title="Delete customer?"
        message={`Delete ${deleteTarget?.name}? Their invoices remain in sales history.`} confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) { store.deleteCustomer(deleteTarget.id); toast.success("Customer deleted"); } }} />
    </div>
  );
}
