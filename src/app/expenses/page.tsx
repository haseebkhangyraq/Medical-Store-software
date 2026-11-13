"use client";

import { useMemo, useState } from "react";
import { Wallet, Plus, Trash2, Download, Home, Zap, Users, Truck, Wrench, Megaphone, MoreHorizontal, Printer } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, Button, Input, Select, Badge, Modal, Field, EmptyState, PageHeader, TableWrap, Th, Td, StatCard, SearchInput, ConfirmDialog } from "@/components/ui";
import { printModuleReport } from "@/components/module-print";
import { toast } from "@/components/toast";
import { formatCurrency, formatDate, downloadCSV, todayISO, MONTHS } from "@/lib/utils";
import { CategoryPie } from "@/components/charts";
import type { Expense, ExpenseCategory } from "@/lib/types";

const CATS: { id: ExpenseCategory; label: string; icon: React.ReactNode }[] = [
  { id: "rent", label: "Rent", icon: <Home className="h-4 w-4" /> },
  { id: "electricity", label: "Electricity", icon: <Zap className="h-4 w-4" /> },
  { id: "salaries", label: "Salaries", icon: <Users className="h-4 w-4" /> },
  { id: "transportation", label: "Transportation", icon: <Truck className="h-4 w-4" /> },
  { id: "maintenance", label: "Maintenance", icon: <Wrench className="h-4 w-4" /> },
  { id: "marketing", label: "Marketing", icon: <Megaphone className="h-4 w-4" /> },
  { id: "other", label: "Other", icon: <MoreHorizontal className="h-4 w-4" /> },
];

export default function ExpensesPage() {
  const store = useStore();
  const expenses = useStore((s) => s.expenses);
  const settings = useStore((s) => s.settings);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ date: string; category: ExpenseCategory; amount: number; description: string; method: string }>({ date: todayISO(), category: "rent", amount: 0, description: "", method: "cash" });
  const [q, setQ] = useState("");
  const [monthF, setMonthF] = useState("all");
  const [catF, setCatF] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const cur = settings.currency;
  const fmt = (n: number) => formatCurrency(n, cur);

  const months = useMemo(() => [...new Set(expenses.map((e) => e.date.slice(0, 7)))].sort().reverse(), [expenses]);

  const rows = useMemo(() => expenses.filter((e) => {
    if (monthF !== "all" && e.date.slice(0, 7) !== monthF) return false;
    if (catF !== "all" && e.category !== catF) return false;
    const query = q.trim().toLowerCase();
    return !query || e.description.toLowerCase().includes(query) || e.expenseNo.toLowerCase().includes(query);
  }), [expenses, q, monthF, catF]);

  const thisMonth = useMemo(() => {
    const key = todayISO().slice(0, 7);
    return expenses.filter((e) => e.date.slice(0, 7) === key);
  }, [expenses]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of thisMonth) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    return [...map.entries()].map(([name, value]) => ({ name: CATS.find((c) => c.id === name)?.label ?? name, value }));
  }, [thisMonth]);

  function printSummary() {
    printModuleReport({
      title: "Operating Expenses",
      pharmacyName: settings.pharmacyName,
      address: settings.address,
      branchName: settings.branchName,
      kpis: [
        ["This Month", fmt(thisMonth.reduce((s, e) => s + e.amount, 0))],
        ["Lifetime", fmt(expenses.reduce((s, e) => s + e.amount, 0))],
        ["Entries", String(expenses.length)],
        ["This Month Entries", String(thisMonth.length)],
      ],
      sections: [
        {
          heading: "By Category (this month)",
          columns: ["Category", "Amount"],
          right: [1],
          rows: byCategory.sort((a, b) => b.value - a.value).map((c) => [c.name, fmt(c.value)]),
        },
        {
          heading: "Expense Entries (latest 60)",
          columns: ["No", "Date", "Category", "Description", "Method", "Amount"],
          right: [5],
          rows: rows.slice(0, 60).map((e) => [
            e.expenseNo, formatDate(e.date.slice(0, 10)),
            CATS.find((c) => c.id === e.category)?.label ?? e.category,
            e.description, e.method, fmt(e.amount),
          ]),
        },
      ],
      note: `Showing ${Math.min(rows.length, 60)} of ${rows.length} entries.`,
    });
  }

  function save() {
    if (form.amount <= 0) { toast.error("Amount must be greater than 0"); return; }
    if (!form.description.trim()) { toast.error("Description required"); return; }
    const e = store.addExpense({ date: form.date, category: form.category, amount: Number(form.amount), description: form.description.trim(), method: form.method as any });
    toast.success("Expense recorded", `${e.expenseNo} — ${fmt(e.amount)}`);
    setOpen(false);
    setForm({ date: todayISO(), category: "rent", amount: 0, description: "", method: "cash" });
  }

  return (
    <div>
      <PageHeader title="Operating Expenses" subtitle="Rent, utilities, salaries and other operating costs"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={printSummary}><Printer className="h-4 w-4" /> Print Summary</Button>
            <Button variant="outline" size="sm" onClick={() => downloadCSV("expenses", rows.map((e) => ({ No: e.expenseNo, Date: e.date, Category: e.category, Amount: e.amount, Description: e.description, Method: e.method })))}><Download className="h-4 w-4" /> Export</Button>
            <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Expense</Button>
          </>
        } />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="This Month" value={fmt(thisMonth.reduce((s, e) => s + e.amount, 0))} sub={`${thisMonth.length} entries`} icon={<Wallet className="h-5 w-5" />} tone="red" />
        <StatCard label="Lifetime" value={fmt(expenses.reduce((s, e) => s + e.amount, 0))} icon={<Wallet className="h-5 w-5" />} tone="slate" />
        <StatCard label="Largest Category" value={byCategory.length ? fmt(Math.max(...byCategory.map((c) => c.value))) : "—"} sub={byCategory.length ? byCategory.sort((a, b) => b.value - a.value)[0].name : ""} icon={<Wallet className="h-5 w-5" />} tone="amber" />
        <StatCard label="Entries" value={String(expenses.length)} icon={<Wallet className="h-5 w-5" />} tone="navy" />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2 p-3">
          <div className="mb-2 flex flex-col gap-2 sm:flex-row">
            <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search description…" className="sm:max-w-xs" />
            <Select value={monthF} onChange={(e) => setMonthF(e.target.value)} className="sm:w-44">
              <option value="all">All months</option>
              {months.map((m) => <option key={m} value={m}>{MONTHS[Number(m.slice(5, 7)) - 1]} {m.slice(0, 4)}</option>)}
            </Select>
            <Select value={catF} onChange={(e) => setCatF(e.target.value)} className="sm:w-44">
              <option value="all">All categories</option>
              {CATS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </div>
          <TableWrap>
            <table className="w-full min-w-[640px]">
              <thead><tr><Th>Expense #</Th><Th>Date</Th><Th>Category</Th><Th>Description</Th><Th className="text-right">Amount</Th><Th className="text-right" /></tr></thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <Td className="font-mono text-[12px]">{e.expenseNo}</Td>
                    <Td>{formatDate(e.date)}</Td>
                    <Td><Badge tone="slate">{CATS.find((c) => c.id === e.category)?.label ?? e.category}</Badge></Td>
                    <Td className="max-w-[240px] truncate">{e.description}</Td>
                    <Td className="text-right font-semibold text-rose-600">{fmt(e.amount)}</Td>
                    <Td className="text-right"><button onClick={() => setDeleteTarget(e)} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></Td>
                  </tr>
                ))}
                {!rows.length && <tr><Td colSpan={6}><EmptyState title="No expenses found" message="Record operating expenses to see the P&L impact." action={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Expense</Button>} /></Td></tr>}
              </tbody>
            </table>
          </TableWrap>
        </Card>
        <Card>
          <div className="px-5 pt-4"><h3 className="text-[15px] font-semibold text-slate-800">This Month by Category</h3></div>
          <div className="px-3 py-2">
            {byCategory.length ? <CategoryPie data={byCategory} height={260} /> : <EmptyState title="No expenses this month" />}
          </div>
        </Card>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Expense" size="sm"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Record Expense</Button></div>}>
        <div className="space-y-3">
          <Field label="Date" required><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Category" required>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}>
              {CATS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Amount (Rs.)" required><Input type="number" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })} /></Field>
          <Field label="Method">
            <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              <option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option><option value="card">Card</option><option value="mobile_wallet">Mobile Wallet</option>
            </Select>
          </Field>
          <Field label="Description" required><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. LESCO bill — June" /></Field>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} danger title="Delete expense?"
        message={`Delete ${deleteTarget?.expenseNo}? The cash ledger entry is removed too.`} confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) { store.deleteExpense(deleteTarget.id); toast.success("Expense deleted"); } }} />
    </div>
  );
}
