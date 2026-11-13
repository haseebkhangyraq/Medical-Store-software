"use client";

import { useMemo, useState } from "react";
import { Landmark, Banknote, ArrowDownToLine, ArrowUpFromLine, Wallet, TrendingUp, Download, Printer } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, CardHeader, Button, Badge, EmptyState, PageHeader, TableWrap, Th, Td, StatCard, Tabs, Select, Alert } from "@/components/ui";
import { toast } from "@/components/toast";
import { formatCurrency, formatDate, downloadCSV, printArea, todayISO, MONTHS } from "@/lib/utils";
import { printModuleReport } from "@/components/module-print";

export default function FinancePage() {
  const store = useStore();
  const cash = useStore((s) => s.cashEntries);
  const sales = useStore((s) => s.sales);
  const expenses = useStore((s) => s.expenses);
  const supplierPayments = useStore((s) => s.supplierPayments);
  const customerPayments = useStore((s) => s.customerPayments);
  const purchases = useStore((s) => s.purchases);
  const returns = useStore((s) => s.salesReturns);
  const customers = useStore((s) => s.customers);
  const suppliers = useStore((s) => s.suppliers);
  const settings = useStore((s) => s.settings);

  const [tab, setTab] = useState("summary");

  const cur = settings.currency;
  const fmt = (n: number) => formatCurrency(n, cur);
  const today = todayISO();
  const thisMonth = today.slice(0, 7);

  const todayEntries = useMemo(() => cash.filter((c) => c.date === today), [cash, today]);
  const cashInToday = todayEntries.filter((e) => e.direction === "in").reduce((s, e) => s + e.amount, 0);
  const cashOutToday = todayEntries.filter((e) => e.direction === "out").reduce((s, e) => s + e.amount, 0);

  // P&L this month (gross profit from batch cost, net = gross - expenses)
  const pnl = useMemo(() => {
    const monthSales = sales.filter((s) => s.date.slice(0, 7) === thisMonth && s.status !== "returned");
    const grossProfit = monthSales.reduce((sum, s) =>
      sum + s.items.reduce((x, it) => x + (it.quantity * it.unitPrice - it.discount - it.quantity * it.costPrice), 0), 0);
    const revenue = monthSales.reduce((sum, s) => sum + s.total, 0);
    const cogs = monthSales.reduce((sum, s) => sum + s.items.reduce((x, it) => x + it.quantity * it.costPrice, 0), 0);
    const monthExpenses = expenses.filter((e) => e.date.slice(0, 7) === thisMonth).reduce((s, e) => s + e.amount, 0);
    return {
      revenue, cogs, grossProfit,
      grossMargin: revenue ? Math.round((grossProfit / revenue) * 100) : 0,
      expenses: monthExpenses,
      netProfit: grossProfit - monthExpenses,
    };
  }, [sales, expenses, thisMonth]);

  // receivables / payables
  const receivables = useMemo(() => {
    const unpaid = sales.filter((s) => s.status !== "returned" && s.paidAmount < s.total).reduce((s, x) => s + (x.total - x.paidAmount), 0);
    const opening = customers.reduce((s, c) => s + c.openingBalance, 0);
    const paid = customerPayments.reduce((s, p) => s + p.amount, 0);
    const refunds = returns.filter((r) => r.restockMethod === "balance_adjustment").reduce((s, r) => s + r.totalRefund, 0);
    return { unpaid, opening, paid, refunds, total: Math.max(0, opening + unpaid - paid - refunds) };
  }, [sales, customers, customerPayments, returns]);

  const payables = useMemo(() => {
    const received = purchases.filter((p) => p.status !== "cancelled" && p.status !== "ordered")
      .reduce((s, p) => s + p.items.reduce((x, it) => x + it.receivedQty * it.unitCost, 0), 0);
    const opening = suppliers.reduce((s, x) => s + x.openingBalance, 0);
    const paid = supplierPayments.reduce((s, p) => s + p.amount, 0);
    const poPaid = purchases.reduce((s, p) => s + p.paidAmount, 0);
    return { total: Math.max(0, opening + received - paid - poPaid) };
  }, [purchases, suppliers, supplierPayments]);

  const entries = useMemo(() =>
    [...cash].sort((a, b) => b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1)).slice(0, 200),
  [cash]);

  function exportLedger() {
    downloadCSV("cash-ledger", entries.map((e) => ({ Date: e.date, Direction: e.direction, Category: e.category, Ref: e.refNo, Description: e.description, Method: e.method, Amount: e.amount })));
  }

  function printSummary() {
    printModuleReport({
      title: "Financial Summary",
      pharmacyName: settings.pharmacyName,
      address: settings.address,
      branchName: settings.branchName,
      kpis: [
        ["Cash In (today)", fmt(cashInToday)],
        ["Cash Out (today)", fmt(cashOutToday)],
        ["Receivables", fmt(receivables.total)],
        ["Payables", fmt(payables.total)],
      ],
      sections: [
        {
          heading: `Profit & Loss — ${MONTHS[Number(thisMonth.slice(5, 7)) - 1]} ${thisMonth.slice(0, 4)}`,
          columns: ["Line Item", "Amount"],
          right: [1],
          rows: [
            ["Revenue (net of returns)", fmt(pnl.revenue)],
            ["Cost of Goods Sold", `−${fmt(pnl.cogs)}`],
            [`Gross Profit (${pnl.grossMargin}%)`, fmt(pnl.grossProfit)],
            ["Operating Expenses", `−${fmt(pnl.expenses)}`],
            ["Net Profit (estimate)", fmt(pnl.netProfit)],
          ],
        },
        {
          heading: "Cash Ledger (latest 40 entries)",
          columns: ["Date", "Direction", "Category", "Description", "Amount"],
          right: [4],
          rows: entries.slice(0, 40).map((e) => [
            formatDate(e.date), e.direction === "in" ? "In" : "Out", e.category, e.description,
            `${e.direction === "in" ? "+" : "−"}${fmt(e.amount)}`,
          ]),
        },
      ],
      note: "Gross profit uses actual batch purchase cost (FEFO). Net profit excludes taxes, depreciation and drawings.",
    });
  }

  function printPL() {
    printArea(`<div class="invoice"><div class="inv-head"><div><div class="inv-logo">${settings.pharmacyName}</div></div>
      <div style="text-align:right"><div style="font-size:16px;font-weight:700">PROFIT & LOSS — ${MONTHS[Number(thisMonth.slice(5, 7)) - 1]} ${thisMonth.slice(0, 4)}</div>
      <div class="muted" style="font-size:12px">DEMO document</div></div></div>
      <table class="mt16"><tbody>
      <tr><td>Revenue (net of returns)</td><td class="num">${fmt(pnl.revenue)}</td></tr>
      <tr><td>Cost of Goods Sold (batch cost)</td><td class="num">−${fmt(pnl.cogs)}</td></tr>
      <tr><td style="font-weight:700">Gross Profit</td><td class="num" style="font-weight:700">${fmt(pnl.grossProfit)} (${pnl.grossMargin}%)</td></tr>
      <tr><td>Operating Expenses</td><td class="num">−${fmt(pnl.expenses)}</td></tr>
      <tr><td style="font-weight:700">Net Profit (estimate)</td><td class="num" style="font-weight:700">${fmt(pnl.netProfit)}</td></tr>
      </tbody></table>
      <div class="mt16 muted" style="font-size:11px">Gross profit uses actual batch purchase cost (FEFO allocations). Net profit further deducts operating expenses; it excludes taxes, depreciation and owner drawings.</div>
      </div>`, "P&L Report");
  }

  return (
    <div>
      <PageHeader title="Financial Accounts" subtitle="Cash register, P&L, receivables and payables"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={printSummary}><Printer className="h-4 w-4" /> Print Summary</Button>
            <Button variant="outline" size="sm" onClick={exportLedger}><Download className="h-4 w-4" /> Ledger CSV</Button>
          </>
        } />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Cash In (Today)" value={fmt(cashInToday)} icon={<ArrowDownToLine className="h-5 w-5" />} tone="green" />
        <StatCard label="Cash Out (Today)" value={fmt(cashOutToday)} icon={<ArrowUpFromLine className="h-5 w-5" />} tone="red" />
        <StatCard label="Receivables" value={fmt(receivables.total)} sub="Customers owe you" icon={<Landmark className="h-5 w-5" />} tone="amber" />
        <StatCard label="Payables" value={fmt(payables.total)} sub="You owe suppliers" icon={<Landmark className="h-5 w-5" />} tone="slate" />
      </div>

      <Tabs active={tab} onChange={setTab} className="mb-4 max-w-lg"
        tabs={[{ id: "summary", label: "P&L Summary" }, { id: "cash", label: "Cash Ledger" }, { id: "closing", label: "Daily Closing" }]} />

      {tab === "summary" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader title={`Profit & Loss — ${MONTHS[Number(thisMonth.slice(5, 7)) - 1]} ${thisMonth.slice(0, 4)}`} subtitle="Gross profit uses actual batch purchase costs" />
            <div className="p-4">
              <div className="space-y-2 text-[13px]">
                <PLRow label="Revenue" value={fmt(pnl.revenue)} />
                <PLRow label="Cost of Goods Sold (batch cost)" value={`−${fmt(pnl.cogs)}`} tone="rose" />
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 font-bold text-emerald-800">
                  <span>Gross Profit</span><span>{fmt(pnl.grossProfit)} <span className="text-xs font-normal">({pnl.grossMargin}% margin)</span></span>
                </div>
                <PLRow label="Operating Expenses" value={`−${fmt(pnl.expenses)}`} tone="rose" />
                <div className="flex items-center justify-between rounded-lg bg-navy-50 px-3 py-2 font-bold text-navy-900">
                  <span>Net Profit (estimate)</span><span>{fmt(pnl.netProfit)}</span>
                </div>
              </div>
              <div className="mt-3">
                <Alert tone="blue" title="Gross vs Net">
                  Gross profit = revenue − actual batch purchase cost. Net profit further deducts operating expenses (rent, salaries, utilities…). Taxes and depreciation are not modeled in this demo.
                </Alert>
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Outstanding Accounts" subtitle="Receivables & payables overview" />
            <div className="space-y-3 p-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Receivables (customers)</div>
                <div className="mt-1 text-2xl font-bold text-amber-800">{fmt(receivables.total)}</div>
                <div className="mt-1 text-[11px] text-amber-600">Unpaid invoice balances: {fmt(receivables.unpaid)} · Opening balances: {fmt(receivables.opening)} · Payments received: −{fmt(receivables.paid)}</div>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">Payables (suppliers)</div>
                <div className="mt-1 text-2xl font-bold text-rose-800">{fmt(payables.total)}</div>
                <div className="mt-1 text-[11px] text-rose-600">Received goods + opening balances − recorded payments</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expense categories this month</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[...new Set(expenses.filter((e) => e.date.slice(0, 7) === thisMonth).map((e) => e.category))].map((c) => (
                    <Badge key={c} tone="slate">{c}</Badge>
                  ))}
                  {!expenses.some((e) => e.date.slice(0, 7) === thisMonth) && <span className="text-xs text-slate-400">None recorded</span>}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === "cash" && (
        <Card>
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-slate-800">Cash / Transaction Ledger</h3>
            <Badge tone="slate">{cash.length} entries</Badge>
          </div>
          <TableWrap>
            <table className="w-full min-w-[720px]">
              <thead><tr><Th>Date</Th><Th>Direction</Th><Th>Category</Th><Th>Reference</Th><Th>Description</Th><Th>Method</Th><Th className="text-right">Amount</Th></tr></thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <Td>{formatDate(e.date)}</Td>
                    <Td><Badge tone={e.direction === "in" ? "green" : "red"}>{e.direction === "in" ? "IN" : "OUT"}</Badge></Td>
                    <Td className="capitalize">{e.category.replace("_", " ")}</Td>
                    <Td className="font-mono text-[11px]">{e.refNo}</Td>
                    <Td className="max-w-[220px] truncate">{e.description}</Td>
                    <Td className="capitalize">{e.method.replace("_", " ")}</Td>
                    <Td className={`text-right font-semibold ${e.direction === "in" ? "text-emerald-600" : "text-rose-600"}`}>
                      {e.direction === "in" ? "+" : "−"}{fmt(e.amount)}
                    </Td>
                  </tr>
                ))}
                {!entries.length && <tr><Td colSpan={7}><EmptyState title="No cash movements yet" /></Td></tr>}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}

      {tab === "closing" && (
        <Card className="p-5">
          <div className="mb-1 text-sm font-semibold text-slate-700">Daily Cash Reconciliation — {formatDate(today)}</div>
          <p className="mb-4 text-xs text-slate-500">Compare counted cash in drawer with the system ledger.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
              <div className="text-[10px] uppercase tracking-wide text-emerald-700">Cash In</div>
              <div className="text-xl font-bold text-emerald-800">{fmt(cashInToday)}</div>
              <div className="mt-1 text-[11px] text-emerald-600">{todayEntries.filter((e) => e.direction === "in").length} entries</div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
              <div className="text-[10px] uppercase tracking-wide text-rose-700">Cash Out</div>
              <div className="text-xl font-bold text-rose-800">{fmt(cashOutToday)}</div>
              <div className="mt-1 text-[11px] text-rose-600">{todayEntries.filter((e) => e.direction === "out").length} entries</div>
            </div>
            <div className="rounded-xl border border-navy-200 bg-navy-50 p-3">
              <div className="text-[10px] uppercase tracking-wide text-navy-700">Net (system)</div>
              <div className="text-xl font-bold text-navy-900">{fmt(cashInToday - cashOutToday)}</div>
              <div className="mt-1 text-[11px] text-navy-600">Expected drawer change</div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Card / Digital (today)</div>
              <div className="text-xl font-bold text-slate-700">{fmt(todayEntries.filter((e) => e.method !== "cash" && e.direction === "in").reduce((s, e) => s + e.amount, 0))}</div>
              <div className="mt-1 text-[11px] text-slate-400">Not in drawer</div>
            </div>
          </div>
          <div className="mt-4">
            <Select className="max-w-xs" defaultValue="">
              <option value="">— Closing note (demo) —</option>
              <option>Cash matched with ledger</option>
              <option>Shortage recorded</option>
              <option>Surplus recorded</option>
            </Select>
            <Button variant="secondary" size="sm" className="mt-2" onClick={() => toast.info("Demo", "Cash closing is a guided manual step in this demo build")}>Save Closing Note</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function PLRow({ label, value, tone }: { label: string; value: string; tone?: "rose" }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
      <span className="text-slate-600">{label}</span>
      <span className={`font-semibold ${tone === "rose" ? "text-rose-600" : "text-slate-800"}`}>{value}</span>
    </div>
  );
}
