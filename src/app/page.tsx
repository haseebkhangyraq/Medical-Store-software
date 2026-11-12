"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  Pill, PackageSearch, ShoppingCart, TrendingUp, Banknote, AlertTriangle, Hourglass,
  CalendarX2, Truck, Users, ArrowRight, Receipt, FileInput, Activity, Wallet,
} from "lucide-react";
import { useStore, getSupplierBalance } from "@/lib/store";
import { Card, CardHeader, StatCard, Badge, Button, EmptyState, Skeleton, TableWrap, Th, Td, Tabs } from "@/components/ui";
import { SalesAreaChart, CompareBarChart, CategoryPie } from "@/components/charts";
import { formatCurrency, formatDate, formatDateTime, todayISO, daysUntil, MONTHS, formatCompact } from "@/lib/utils";
import { sellableStock, stockValueAll, totalStock } from "@/lib/stock";
import type { Sale } from "@/lib/types";

function saleProfit(s: Sale) {
  return Math.round(s.items.reduce((sum, it) => sum + (it.quantity * it.unitPrice - it.discount - it.quantity * it.costPrice), 0));
}

export default function DashboardPage() {
  const s = useStore();
  const [range, setRange] = useState<"daily" | "weekly" | "monthly">("daily");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const d = useMemo(() => {
    const today = todayISO();
    const todaySales = s.sales.filter((x) => x.date.slice(0, 10) === today);
    const todayPurchases = s.purchases.filter((x) => x.date.slice(0, 10) === today);
    const todayProfit = todaySales.reduce((sum, x) => sum + saleProfit(x), 0);

    let lowStock = 0, expired = 0, nearExpiry = 0, outOfStock = 0;
    for (const m of s.medicines) {
      const sellable = sellableStock(m);
      if (sellable <= Math.max(m.minStockLevel, s.settings.lowStockThreshold)) lowStock++;
      if (sellable === 0) outOfStock++;
      for (const b of m.batches) {
        const days = daysUntil(b.expiryDate);
        if (b.quantity > 0) {
          if (days < 0) expired++;
          else if (days <= s.settings.expiryWarnDays) nearExpiry++;
        }
      }
    }

    const payables = s.suppliers.reduce((sum, sup) => sum + Math.max(0, getSupplierBalance(s.suppliers, sup.id, s.purchases, s.supplierPayments)), 0);
    const invValue = stockValueAll(s.medicines);

    // ── charts ──
    let series: { name: string; sales: number; profit?: number }[] = [];
    let compare: { name: string; purchases: number; sales: number }[] = [];
    if (range === "daily") {
      for (let i = 13; i >= 0; i--) {
        const dt = new Date(); dt.setDate(dt.getDate() - i);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
        const daySales = s.sales.filter((x) => x.date.slice(0, 10) === key);
        series.push({
          name: `${dt.getDate()} ${MONTHS[dt.getMonth()]}`,
          sales: daySales.reduce((sum, x) => sum + x.total, 0),
          profit: daySales.reduce((sum, x) => sum + saleProfit(x), 0),
        });
      }
    } else if (range === "weekly") {
      for (let w = 7; w >= 0; w--) {
        const end = new Date(); end.setDate(end.getDate() - w * 7);
        const start = new Date(end); start.setDate(start.getDate() - 6);
        const inRange = s.sales.filter((x) => {
          const t = new Date(x.date);
          return t >= new Date(start.toISOString().slice(0, 10) + "T00:00:00") && t <= new Date(end.toISOString().slice(0, 10) + "T23:59:59");
        });
        series.push({
          name: `W${8 - w}`,
          sales: inRange.reduce((sum, x) => sum + x.total, 0),
          profit: inRange.reduce((sum, x) => sum + saleProfit(x), 0),
        });
      }
    } else {
      for (let mo = 5; mo >= 0; mo--) {
        const dt = new Date(); dt.setMonth(dt.getMonth() - mo);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
        const moSales = s.sales.filter((x) => x.date.slice(0, 7) === key);
        const moPur = s.purchases.filter((x) => x.date.slice(0, 7) === key);
        series.push({
          name: MONTHS[dt.getMonth()],
          sales: moSales.reduce((sum, x) => sum + x.total, 0),
          profit: moSales.reduce((sum, x) => sum + saleProfit(x), 0),
        });
      }
      // compare last 6 months
      compare = [];
      for (let mo = 5; mo >= 0; mo--) {
        const dt = new Date(); dt.setMonth(dt.getMonth() - mo);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
        compare.push({
          name: MONTHS[dt.getMonth()],
          sales: s.sales.filter((x) => x.date.slice(0, 7) === key).reduce((sum, x) => sum + x.total, 0),
          purchases: s.purchases.filter((x) => x.date.slice(0, 7) === key).reduce((sum, x) => sum + x.total, 0),
        });
      }
    }

    // category-wise sales (last 30 days)
    const catMap = new Map<string, number>();
    for (const sale of s.sales) {
      if (new Date(sale.date).getTime() < Date.now() - 30 * 86400000) continue;
      for (const it of sale.items) {
        const med = s.medicines.find((m) => m.id === it.medicineId);
        const cat = med?.category ?? "Other";
        catMap.set(cat, (catMap.get(cat) ?? 0) + it.quantity * it.unitPrice);
      }
    }
    const categories = [...catMap.entries()].map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value).slice(0, 6);

    // top sellers (qty last 30 days)
    const topMap = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const sale of s.sales) {
      if (new Date(sale.date).getTime() < Date.now() - 30 * 86400000) continue;
      for (const it of sale.items) {
        const cur = topMap.get(it.medicineId) ?? { name: it.medicineName, qty: 0, revenue: 0 };
        cur.qty += it.quantity; cur.revenue += it.quantity * it.unitPrice;
        topMap.set(it.medicineId, cur);
      }
    }
    const topSellers = [...topMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

    const lowStockItems = s.medicines
      .filter((m) => sellableStock(m) <= Math.max(m.minStockLevel, s.settings.lowStockThreshold))
      .sort((a, b) => sellableStock(a) - sellableStock(b))
      .slice(0, 6);

    const expiryAlerts = s.medicines
      .flatMap((m) => m.batches.filter((b) => b.quantity > 0 && daysUntil(b.expiryDate) <= s.settings.expiryWarnDays)
        .map((b) => ({ med: m, batch: b, days: daysUntil(b.expiryDate) })))
      .sort((a, b) => a.days - b.days)
      .slice(0, 6);

    const totalCustomers = s.customers.length;
    const totalSuppliers = s.suppliers.length;

    return {
      todaySalesTotal: todaySales.reduce((sum, x) => sum + x.total, 0),
      todayProfit, todayPurchasesTotal: todayPurchases.reduce((sum, x) => sum + x.total, 0),
      invValue, medCount: s.medicines.length, lowStock, expired, nearExpiry, outOfStock, payables,
      totalCustomers, totalSuppliers, series, compare, categories, topSellers, lowStockItems,
      expiryAlerts, recentSales: s.sales.slice(0, 6), recentPurchases: s.purchases.slice(0, 5),
      recentMovements: s.movements.slice(0, 6),
    };
  }, [s.sales, s.purchases, s.medicines, s.settings, s.suppliers, s.supplierPayments, s.movements, range]);

  const currency = s.settings.currency;
  const fmt = (n: number) => formatCurrency(n, currency);

  if (!mounted) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-48" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Dashboard</h1>
          <p className="text-[13px] text-slate-500">Business overview for {formatDate(todayISO())} · {s.currentUser?.name}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/pos"><Button size="sm"><ShoppingCart className="h-4 w-4" /> New Sale</Button></Link>
          <Link href="/purchases"><Button variant="outline" size="sm"><FileInput className="h-4 w-4" /> New Purchase</Button></Link>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Medicines" value={String(d.medCount)} sub={`${s.medicines.reduce((n, m) => n + totalStock(m), 0)} units in stock`} icon={<Pill className="h-5 w-5" />} tone="navy" onClick={() => location.assign("/medicines")} />
        <StatCard label="Inventory Value" value={fmt(d.invValue)} sub="At batch purchase cost" icon={<PackageSearch className="h-5 w-5" />} tone="violet" onClick={() => location.assign("/inventory")} />
        <StatCard label="Today's Sales" value={fmt(d.todaySalesTotal)} sub={`${todayISO() === todayISO() ? s.sales.filter((x) => x.date.slice(0, 10) === todayISO()).length : 0} invoices today`} icon={<Banknote className="h-5 w-5" />} tone="green" onClick={() => location.assign("/sales")} />
        <StatCard label="Today's Profit" value={fmt(d.todayProfit)} sub="Gross margin (batch cost)" icon={<TrendingUp className="h-5 w-5" />} tone="amber" />
        <StatCard label="Today's Purchases" value={fmt(d.todayPurchasesTotal)} sub={`${s.purchases.filter((x) => x.date.slice(0, 10) === todayISO()).length} orders`} icon={<Truck className="h-5 w-5" />} tone="blue" onClick={() => location.assign("/purchases")} />
        <StatCard label="Low Stock" value={String(d.lowStock)} sub={`${d.outOfStock} out of stock`} icon={<AlertTriangle className="h-5 w-5" />} tone="red" onClick={() => location.assign("/inventory")} />
        <StatCard label="Expired Batches" value={String(d.expired)} sub="Quarantine & dispose" icon={<CalendarX2 className="h-5 w-5" />} tone="red" onClick={() => location.assign("/expiry")} />
        <StatCard label="Near Expiry" value={String(d.nearExpiry)} sub={`Within ${s.settings.expiryWarnDays} days`} icon={<Hourglass className="h-5 w-5" />} tone="amber" onClick={() => location.assign("/expiry")} />
        <StatCard label="Pending Supplier Payments" value={fmt(d.payables)} sub="Accounts payable" icon={<Wallet className="h-5 w-5" />} tone="slate" onClick={() => location.assign("/suppliers")} />
        <StatCard label="Customers" value={String(d.totalCustomers)} sub="Registered profiles" icon={<Users className="h-5 w-5" />} tone="navy" onClick={() => location.assign("/customers")} />
        <StatCard label="Suppliers" value={String(d.totalSuppliers)} sub="Distributors on file" icon={<Truck className="h-5 w-5" />} tone="navy" onClick={() => location.assign("/suppliers")} />
        <StatCard label="Invoices Today" value={String(s.sales.filter((x) => x.date.slice(0, 10) === todayISO()).length)} sub="POS transactions" icon={<Receipt className="h-5 w-5" />} tone="green" onClick={() => location.assign("/sales")} />
      </div>

      {/* Charts */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Sales & Profit Analytics" subtitle="Dynamically updates with every transaction"
            action={<Tabs active={range} onChange={(id) => setRange(id as typeof range)} tabs={[{ id: "daily", label: "Daily" }, { id: "weekly", label: "Weekly" }, { id: "monthly", label: "Monthly" }]} />}
          />
          <div className="px-3 pb-4 pt-2">
            {d.series.every((x) => x.sales === 0) ? (
              <EmptyState title="No sales in this period" message="Complete a sale from the POS to see analytics here." />
            ) : (
              <SalesAreaChart data={d.series} height={278} />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Category Sales" subtitle="Last 30 days" />
          <div className="px-3 pb-4 pt-2">
            {d.categories.length ? <CategoryPie data={d.categories} height={278} /> : <EmptyState title="No sales yet" />}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Purchases vs Sales" subtitle="Monthly revenue and procurement comparison" />
          <div className="px-3 pb-4 pt-2"><CompareBarChart data={d.compare} height={260} /></div>
        </Card>
        <Card>
          <CardHeader title="Most Selling Medicines" subtitle="By units sold · last 30 days" />
          <div className="space-y-1 px-2.5 pb-3 pt-2">
            {d.topSellers.length === 0 && <EmptyState title="No sales data" />}
            {d.topSellers.map((t, i) => (
              <div key={t.name} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-50 text-[11px] font-bold text-navy-700">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-slate-700">{t.name}</div>
                  <div className="text-[11px] text-slate-400">{t.qty} units sold</div>
                </div>
                <span className="text-[13px] font-semibold text-slate-700">{fmt(t.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Alerts + recents */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Low Stock Alerts" subtitle="At or below minimum level" action={<Link href="/inventory" className="text-xs font-medium text-navy-600 hover:underline">View all</Link>} />
          <TableWrap>
            <table className="w-full">
              <thead><tr><Th>Medicine</Th><Th>Stock</Th><Th>Min</Th><Th>Status</Th></tr></thead>
              <tbody>
                {d.lowStockItems.map((m) => {
                  const stock = sellableStock(m);
                  return (
                    <tr key={m.id}>
                      <Td className="font-medium">{m.name}</Td>
                      <Td>{stock} {m.unitType}</Td>
                      <Td>{m.minStockLevel}</Td>
                      <Td>{stock === 0 ? <Badge tone="red">Out of stock</Badge> : <Badge tone="amber">Low</Badge>}</Td>
                    </tr>
                  );
                })}
                {!d.lowStockItems.length && <tr><Td colSpan={4}><div className="py-6 text-center text-xs text-slate-400">No low-stock items</div></Td></tr>}
              </tbody>
            </table>
          </TableWrap>
        </Card>

        <Card>
          <CardHeader title="Expiry Alerts" subtitle={`Batches expiring within ${s.settings.expiryWarnDays} days or expired`} action={<Link href="/expiry" className="text-xs font-medium text-navy-600 hover:underline">Expiry module</Link>} />
          <TableWrap>
            <table className="w-full">
              <thead><tr><Th>Medicine</Th><Th>Batch</Th><Th>Expiry</Th><Th>Status</Th></tr></thead>
              <tbody>
                {d.expiryAlerts.map(({ med, batch, days }) => (
                  <tr key={batch.id}>
                    <Td className="font-medium">{med.name}</Td>
                    <Td>{batch.batchNo}</Td>
                    <Td>{formatDate(batch.expiryDate)}</Td>
                    <Td>{days < 0 ? <Badge tone="red">Expired</Badge> : days <= 30 ? <Badge tone="amber">{days}d left</Badge> : <Badge tone="blue">{days}d left</Badge>}</Td>
                  </tr>
                ))}
                {!d.expiryAlerts.length && <tr><Td colSpan={4}><div className="py-6 text-center text-xs text-slate-400">No expiry alerts</div></Td></tr>}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader title="Recent Sales" action={<Link href="/sales" className="text-xs font-medium text-navy-600 hover:underline">All sales <ArrowRight className="inline h-3 w-3" /></Link>} />
          <div className="space-y-1 px-2.5 pb-3 pt-2">
            {d.recentSales.map((sale) => (
              <div key={sale.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Receipt className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-slate-700">{sale.customerName}</div>
                  <div className="text-[11px] text-slate-400">{sale.invoiceNo} · {formatDateTime(sale.date)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-semibold text-slate-700">{fmt(sale.total)}</div>
                  <div className="text-[10px] uppercase text-slate-400">{sale.paymentMethod.replace("_", " ")}</div>
                </div>
              </div>
            ))}
            {!d.recentSales.length && <EmptyState title="No sales yet" message="Open the POS to create the first invoice." />}
          </div>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader title="Recent Purchases" action={<Link href="/purchases" className="text-xs font-medium text-navy-600 hover:underline">All purchases <ArrowRight className="inline h-3 w-3" /></Link>} />
          <div className="space-y-1 px-2.5 pb-3 pt-2">
            {d.recentPurchases.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><Truck className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-slate-700">{p.supplierName}</div>
                  <div className="text-[11px] text-slate-400">{p.refNo} · {formatDate(p.date.slice(0, 10))}</div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-semibold text-slate-700">{fmt(p.total)}</div>
                  <div className="text-[10px] capitalize text-slate-400">{p.status.replace("_", " ")}</div>
                </div>
              </div>
            ))}
            {!d.recentPurchases.length && <EmptyState title="No purchases yet" />}
          </div>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader title="Inventory Activity" subtitle="Latest stock movement ledger entries" />
          <div className="space-y-1 px-2.5 pb-3 pt-2">
            {d.recentMovements.map((mv) => (
              <div key={mv.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${mv.qtyIn > 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                  <Activity className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-slate-700">{mv.medicineName}</div>
                  <div className="truncate text-[11px] text-slate-400">{mv.type.replace("_", " ")} · {mv.refNo}</div>
                </div>
                <span className={`text-[13px] font-semibold ${mv.qtyIn > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {mv.qtyIn > 0 ? `+${mv.qtyIn}` : `−${mv.qtyOut}`}
                </span>
              </div>
            ))}
            {!d.recentMovements.length && <EmptyState title="No activity" />}
          </div>
        </Card>
      </div>
    </div>
  );
}
