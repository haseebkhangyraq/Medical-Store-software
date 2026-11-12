"use client";

import { useMemo, useState, Suspense } from "react";
import { BarChart3, Download, Printer, CalendarRange } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useStore, getCustomerBalance, getSupplierBalance } from "@/lib/store";
import { Card, Button, Input, Select, Badge, EmptyState, PageHeader, TableWrap, Th, Td, Tabs } from "@/components/ui";
import { toast } from "@/components/toast";
import { formatCurrency, formatDate, addDays, downloadCSV, printArea, todayISO, MONTHS } from "@/lib/utils";
import { sellableStock, stockValue, totalStock } from "@/lib/stock";
import { daysUntil } from "@/lib/utils";
import { CategoryPie, SalesAreaChart } from "@/components/charts";

interface ReportDef { id: string; label: string; group: string }

const REPORTS: ReportDef[] = [
  { id: "daily_sales", label: "Daily Sales Report", group: "Sales" },
  { id: "monthly_sales", label: "Monthly Sales Report", group: "Sales" },
  { id: "medicine_sales", label: "Medicine-wise Sales", group: "Sales" },
  { id: "category_sales", label: "Category-wise Sales", group: "Sales" },
  { id: "purchases", label: "Purchase Report", group: "Buying" },
  { id: "supplier", label: "Supplier Report", group: "Buying" },
  { id: "inventory_valuation", label: "Inventory Valuation", group: "Inventory" },
  { id: "stock_movement", label: "Stock Movement", group: "Inventory" },
  { id: "expiry", label: "Expiry Report", group: "Inventory" },
  { id: "low_stock", label: "Low Stock Report", group: "Inventory" },
  { id: "pnl", label: "Profit & Loss", group: "Finance" },
  { id: "expenses", label: "Expense Report", group: "Finance" },
  { id: "customer", label: "Customer Report", group: "Finance" },
  { id: "returns", label: "Returns Report", group: "Finance" },
];

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsInner />
    </Suspense>
  );
}

function ReportsInner() {
  const store = useStore();
  const s = useStore();
  const settings = s.settings;
  const searchParams = useSearchParams();
  const [reportId, setReportId] = useState(() => searchParams.get("type") ?? "daily_sales");
  const [from, setFrom] = useState(addDays(todayISO(), -30));
  const [to, setTo] = useState(todayISO());
  const [period, setPeriod] = useState<"custom" | "today" | "7" | "30" | "month">("30");

  const cur = settings.currency;
  const fmt = (n: number) => formatCurrency(n, cur);

  function applyPeriod(p: typeof period) {
    setPeriod(p);
    const t = todayISO();
    if (p === "today") { setFrom(t); setTo(t); }
    else if (p === "7") { setFrom(addDays(t, -6)); setTo(t); }
    else if (p === "30") { setFrom(addDays(t, -29)); setTo(t); }
    else if (p === "month") { setFrom(t.slice(0, 8) + "01"); setTo(t); }
  }

  const report = useMemo(() => {
    const inRange = (d: string) => d >= from && d <= to;
    const salesInRange = s.sales.filter((x) => inRange(x.date.slice(0, 10)));
    const purchasesInRange = s.purchases.filter((x) => inRange(x.date.slice(0, 10)));
    const profit = (sale: typeof s.sales[number]) => sale.items.reduce((x, it) => x + (it.quantity * it.unitPrice - it.discount - it.quantity * it.costPrice), 0);

    switch (reportId) {
      case "daily_sales": {
        const map = new Map<string, { sales: number; profit: number; count: number }>();
        for (const sale of salesInRange) {
          const d = sale.date.slice(0, 10);
          const cur0 = map.get(d) ?? { sales: 0, profit: 0, count: 0 };
          cur0.sales += sale.total; cur0.profit += profit(sale); cur0.count++;
          map.set(d, cur0);
        }
        const rows = [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
        return {
          title: "Daily Sales Report",
          columns: ["Date", "Invoices", "Revenue", "Gross Profit", "Avg Invoice"],
          rows: rows.map(([d, v]) => [formatDate(d), String(v.count), fmt(v.sales), fmt(v.profit), v.count ? fmt(v.sales / v.count) : "—"]),
          csv: rows.map(([d, v]) => ({ Date: d, Invoices: v.count, Revenue: v.sales, Profit: Math.round(v.profit) })),
          chart: rows.reverse().map(([d, v]) => ({ name: d.slice(5), sales: v.sales, profit: v.profit })),
        };
      }
      case "monthly_sales": {
        const map = new Map<string, { sales: number; profit: number; count: number }>();
        for (const sale of s.sales) {
          const m = sale.date.slice(0, 7);
          const cur0 = map.get(m) ?? { sales: 0, profit: 0, count: 0 };
          cur0.sales += sale.total; cur0.profit += profit(sale); cur0.count++;
          map.set(m, cur0);
        }
        const rows = [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
        return {
          title: "Monthly Sales Report",
          columns: ["Month", "Invoices", "Revenue", "Gross Profit"],
          rows: rows.map(([m, v]) => [`${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`, String(v.count), fmt(v.sales), fmt(v.profit)]),
          csv: rows.map(([m, v]) => ({ Month: m, Invoices: v.count, Revenue: v.sales, Profit: Math.round(v.profit) })),
        };
      }
      case "medicine_sales": {
        const map = new Map<string, { name: string; qty: number; revenue: number; profit: number }>();
        for (const sale of salesInRange) for (const it of sale.items) {
          const cur1 = map.get(it.medicineId) ?? { name: it.medicineName, qty: 0, revenue: 0, profit: 0 };
          cur1.qty += it.quantity; cur1.revenue += it.quantity * it.unitPrice; cur1.profit += it.quantity * it.unitPrice - it.discount - it.quantity * it.costPrice;
          map.set(it.medicineId, cur1);
        }
        const rows = [...map.values()].sort((a, b) => b.revenue - a.revenue);
        return {
          title: "Medicine-wise Sales Report",
          columns: ["Medicine", "Units Sold", "Revenue", "Gross Profit"],
          rows: rows.map((r) => [r.name, String(r.qty), fmt(r.revenue), fmt(r.profit)]),
          csv: rows.map((r) => ({ Medicine: r.name, Units: r.qty, Revenue: r.revenue, Profit: Math.round(r.profit) })),
        };
      }
      case "category_sales": {
        const map = new Map<string, number>();
        for (const sale of salesInRange) for (const it of sale.items) {
          const med = s.medicines.find((m) => m.id === it.medicineId);
          const cat = med?.category ?? "Other";
          map.set(cat, (map.get(cat) ?? 0) + it.quantity * it.unitPrice);
        }
        const rows = [...map.entries()].sort((a, b) => b[1] - a[1]);
        return {
          title: "Category-wise Sales Report",
          columns: ["Category", "Revenue"],
          rows: rows.map(([c, v]) => [c, fmt(v)]),
          csv: rows.map(([c, v]) => ({ Category: c, Revenue: v })),
          chart: rows.map(([name, value]) => ({ name, value })),
        };
      }
      case "purchases": {
        return {
          title: "Purchase Report",
          columns: ["Ref #", "Date", "Supplier", "Items", "Total", "Paid", "Status"],
          rows: purchasesInRange.map((p) => [p.refNo, formatDate(p.date.slice(0, 10)), p.supplierName, String(p.items.length), fmt(p.total), fmt(p.paidAmount), p.status.replace("_", " ")]),
          csv: purchasesInRange.map((p) => ({ Ref: p.refNo, Date: p.date.slice(0, 10), Supplier: p.supplierName, Total: p.total, Paid: p.paidAmount, Status: p.status })),
        };
      }
      case "supplier": {
        const rows = s.suppliers.map((sup) => {
          const bal = getSupplierBalance(s.suppliers, sup.id, s.purchases, s.supplierPayments);
          const received = s.purchases.filter((p) => p.supplierId === sup.id && p.status !== "cancelled")
            .reduce((x, p) => x + (p.status === "ordered" ? 0 : p.items.reduce((y, i) => y + i.receivedQty * i.unitCost, 0)), 0);
          return [sup.name, sup.contactPerson, String(s.purchases.filter((p) => p.supplierId === sup.id).length), fmt(received), fmt(bal)];
        });
        return {
          title: "Supplier Report",
          columns: ["Supplier", "Contact", "Orders", "Received Value", "Outstanding Balance"],
          rows,
          csv: s.suppliers.map((sup) => ({ Supplier: sup.name, Orders: s.purchases.filter((p) => p.supplierId === sup.id).length, Balance: getSupplierBalance(s.suppliers, sup.id, s.purchases, s.supplierPayments) })),
        };
      }
      case "inventory_valuation": {
        const rows = [...s.medicines].sort((a, b) => stockValue(b) - stockValue(a));
        return {
          title: "Inventory Valuation Report",
          columns: ["Medicine", "Category", "Sellable", "Total Units", "Batches", "Stock Value", "Retail Value"],
          rows: rows.map((m) => [m.name, m.category, String(sellableStock(m)), String(totalStock(m)), String(m.batches.length), fmt(stockValue(m)), fmt(sellableStock(m) * m.retailPrice)]),
          csv: rows.map((m) => ({ Medicine: m.name, Category: m.category, Sellable: sellableStock(m), Total: totalStock(m), Value: Math.round(stockValue(m)) })),
          footerTotal: fmt(rows.reduce((x, m) => x + stockValue(m), 0)),
        };
      }
      case "stock_movement": {
        const mvs = s.movements.filter((m) => inRange(m.date)).slice(0, 300);
        return {
          title: "Stock Movement Report",
          columns: ["Date", "Type", "Medicine", "Batch", "In", "Out", "Ref"],
          rows: mvs.map((m) => [formatDate(m.date), m.type.replace("_", " "), m.medicineName, m.batchNo, String(m.qtyIn || "—"), String(m.qtyOut || "—"), m.refNo]),
          csv: mvs.map((m) => ({ Date: m.date, Type: m.type, Medicine: m.medicineName, Batch: m.batchNo, In: m.qtyIn, Out: m.qtyOut, Ref: m.refNo })),
        };
      }
      case "expiry": {
        const rows: string[][] = [];
        for (const m of s.medicines) for (const b of m.batches) {
          if (b.quantity > 0 && daysUntil(b.expiryDate) <= settings.expiryWarnDays) {
            const d = daysUntil(b.expiryDate);
            rows.push([m.name, b.batchNo, String(b.quantity), formatDate(b.expiryDate), d < 0 ? `Expired ${Math.abs(d)}d ago` : `${d}d left`, fmt(b.quantity * b.purchasePrice)]);
          }
        }
        return {
          title: "Expiry Report",
          columns: ["Medicine", "Batch", "Qty", "Expiry", "Status", "Value at Risk"],
          rows,
          csv: rows.map((r) => ({ Medicine: r[0], Batch: r[1], Qty: r[2], Expiry: r[3], Status: r[4], Value: r[5] })),
        };
      }
      case "low_stock": {
        const rows = s.medicines
          .filter((m) => sellableStock(m) <= Math.max(m.minStockLevel, settings.lowStockThreshold))
          .sort((a, b) => sellableStock(a) - sellableStock(b))
          .map((m) => [m.name, m.sku, String(sellableStock(m)), String(m.minStockLevel), m.supplierId ? (s.suppliers.find((x) => x.id === m.supplierId)?.name ?? "—") : "—"]);
        return {
          title: "Low Stock Report",
          columns: ["Medicine", "SKU", "Sellable", "Min Level", "Preferred Supplier"],
          rows,
          csv: rows.map((r) => ({ Medicine: r[0], SKU: r[1], Stock: r[2], Min: r[3] })),
        };
      }
      case "pnl": {
        const revenue = salesInRange.reduce((x, sale) => x + sale.total, 0);
        const cogs = salesInRange.reduce((x, sale) => x + sale.items.reduce((y, it) => y + it.quantity * it.costPrice, 0), 0);
        const gross = salesInRange.reduce((x, sale) => x + profit(sale), 0);
        const exp = s.expenses.filter((e) => inRange(e.date)).reduce((x, e) => x + e.amount, 0);
        return {
          title: "Profit & Loss Report",
          columns: ["Metric", "Value"],
          rows: [
            ["Revenue", fmt(revenue)],
            ["Cost of Goods Sold (batch cost)", `−${fmt(cogs)}`],
            ["Gross Profit", fmt(gross)],
            ["Operating Expenses", `−${fmt(exp)}`],
            ["Net Profit (estimate)", fmt(gross - exp)],
          ],
          csv: [{ Revenue: revenue, COGS: cogs, Gross: Math.round(gross), Expenses: exp, Net: Math.round(gross - exp) }],
        };
      }
      case "expenses": {
        const exp = s.expenses.filter((e) => inRange(e.date));
        const map = new Map<string, number>();
        for (const e of exp) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
        const rows = [...map.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => [c, String(exp.filter((e) => e.category === c).length), fmt(v)]);
        return {
          title: "Expense Report",
          columns: ["Category", "Entries", "Total"],
          rows,
          csv: exp.map((e) => ({ No: e.expenseNo, Date: e.date, Category: e.category, Amount: e.amount, Description: e.description })),
          footerTotal: fmt(exp.reduce((x, e) => x + e.amount, 0)),
        };
      }
      case "customer": {
        const rows = s.customers.map((c) => {
          const my = s.sales.filter((x) => x.customerId === c.id);
          return [c.name, c.type, String(my.length), fmt(my.reduce((x, i) => x + i.total, 0)), fmt(getCustomerBalance(s.customers, c.id, s.sales, s.customerPayments))];
        });
        return {
          title: "Customer Report",
          columns: ["Customer", "Type", "Invoices", "Total Purchases", "Balance"],
          rows,
          csv: s.customers.map((c) => ({ Name: c.name, Type: c.type, Invoices: s.sales.filter((x) => x.customerId === c.id).length, Balance: getCustomerBalance(s.customers, c.id, s.sales, s.customerPayments) })),
        };
      }
      case "returns": {
        const srs = s.salesReturns.filter((r) => inRange(r.date.slice(0, 10)));
        const prs = s.purchaseReturns.filter((r) => inRange(r.date.slice(0, 10)));
        const rows = [
          ...srs.map((r) => [`Sales Return ${r.returnNo}`, formatDate(r.date.slice(0, 10)), r.customerName, String(r.items.reduce((x, i) => x + i.quantity, 0)), fmt(r.totalRefund)]),
          ...prs.map((r) => [`Purchase Return ${r.returnNo}`, formatDate(r.date.slice(0, 10)), r.supplierName, String(r.items.reduce((x, i) => x + i.quantity, 0)), fmt(r.totalRefund)]),
        ];
        return {
          title: "Returns Report",
          columns: ["Return", "Date", "Party", "Units", "Amount"],
          rows,
          csv: [...srs.map((r) => ({ Type: "sales", No: r.returnNo, Amount: r.totalRefund })), ...prs.map((r) => ({ Type: "purchase", No: r.returnNo, Amount: r.totalRefund }))],
        };
      }
      default:
        return { title: "", columns: [], rows: [] as string[][], csv: [] };
    }
  }, [reportId, from, to, s.sales, s.purchases, s.medicines, s.suppliers, s.customers, s.expenses, s.movements, s.salesReturns, s.purchaseReturns, s.customerPayments, s.supplierPayments, settings.expiryWarnDays, cur]);

  function exportCSVNow() {
    if (!report.csv.length) { toast.error("Nothing to export"); return; }
    downloadCSV(reportId, report.csv as Record<string, unknown>[]);
    toast.success("Exported", `${report.title} CSV downloaded`);
  }

  function printNow() {
    const head = report.columns.map((c) => `<th>${c}</th>`).join("");
    const body = report.rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
    printArea(`<div class="invoice"><div class="inv-head"><div><div class="inv-logo">${settings.pharmacyName}</div><div class="muted" style="font-size:11px">${settings.address}</div></div>
      <div style="text-align:right"><div style="font-size:16px;font-weight:700;color:#16223a">${report.title.toUpperCase()}</div>
      <div class="muted" style="font-size:12px">${formatDate(from)} → ${formatDate(to)} · Generated ${new Date().toLocaleString()}</div></div></div>
      <table class="mt16"><thead><tr>${head}</tr></thead><tbody>${body || '<tr><td colspan="9" class="center muted">No data in range</td></tr>'}</tbody></table>
      ${report.footerTotal ? `<div style="display:flex;justify-content:flex-end;margin-top:10px"><table class="totals"><tr><td style="font-weight:700">Total</td><td class="num" style="font-weight:700">${report.footerTotal}</td></tr></table></div>` : ""}
      <div class="mt8 muted" style="font-size:10px;text-align:center">Demonstration report</div></div>`, report.title);
  }

  const groups = [...new Set(REPORTS.map((r) => r.group))];

  return (
    <div>
      <PageHeader title="Reports" subtitle="15 operational reports with date-range filtering, CSV export and printing" />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:max-w-2xl">
          <Select value={reportId} onChange={(e) => setReportId(e.target.value)} className="col-span-2">
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {REPORTS.filter((r) => r.group === g).map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </optgroup>
            ))}
          </Select>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPeriod("custom"); }} />
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPeriod("custom"); }} />
        </div>
        <div className="flex gap-2">
          <Select value={period} onChange={(e) => applyPeriod(e.target.value as typeof period)} className="w-36">
            <option value="today">Today</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="month">This month</option>
            <option value="custom">Custom</option>
          </Select>
          <Button variant="outline" size="md" onClick={exportCSVNow}><Download className="h-4 w-4" /> CSV</Button>
          <Button variant="dark" size="md" onClick={printNow}><Printer className="h-4 w-4" /> Print / PDF</Button>
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <div>
            <h3 className="text-[15px] font-bold text-slate-800">{report.title}</h3>
            <p className="text-xs text-slate-400">{formatDate(from)} → {formatDate(to)} · {report.rows.length} rows</p>
          </div>
          <BarChart3 className="h-5 w-5 text-slate-300" />
        </div>
        <TableWrap>
          <table className="w-full min-w-[640px]">
            <thead><tr>{report.columns.map((c) => <Th key={c}>{c}</Th>)}</tr></thead>
            <tbody>
              {report.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <Td key={j} className={j === r.length - 1 ? "text-right font-semibold" : ""}>{c}</Td>)}</tr>
              ))}
              {!report.rows.length && <tr><Td colSpan={Math.max(1, report.columns.length)}><EmptyState title="No data for the selected range" message="Adjust the date range or pick another report." /></Td></tr>}
            </tbody>
          </table>
        </TableWrap>
        {report.footerTotal && (
          <div className="flex justify-end px-5 py-3 text-sm font-bold text-slate-800">Total: {report.footerTotal}</div>
        )}
      </Card>

      {report.chart && (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {reportId === "daily_sales" && (
            <Card className="xl:col-span-2">
              <div className="px-5 pt-4 text-[15px] font-semibold text-slate-800">Daily Trend</div>
              <div className="px-3 py-2"><SalesAreaChart data={report.chart as any} height={260} /></div>
            </Card>
          )}
          {reportId === "category_sales" && (
            <Card>
              <div className="px-5 pt-4 text-[15px] font-semibold text-slate-800">Category Share</div>
              <div className="px-3 py-2"><CategoryPie data={report.chart as any} height={260} /></div>
            </Card>
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {REPORTS.slice(0, 8).map((r) => (
          <button key={r.id} onClick={() => setReportId(r.id)}
            className={`rounded-xl border p-3 text-left text-[13px] font-medium transition-colors ${reportId === r.id ? "border-navy-500 bg-navy-50 text-navy-800" : "border-slate-200 bg-white text-slate-600 hover:border-navy-300"}`}>
            {r.label}
            <div className="text-[10px] font-normal text-slate-400">{r.group}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

