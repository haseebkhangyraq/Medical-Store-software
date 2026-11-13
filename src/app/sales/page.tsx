"use client";

import { useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Printer, FileText, Undo2, Receipt, Download, Eye, Banknote } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, Button, Badge, Modal, EmptyState, PageHeader, TableWrap, Th, Td, StatCard, SearchInput, Select, Input } from "@/components/ui";
import { toast } from "@/components/toast";
import { formatCurrency, formatDate, formatDateTime, downloadCSV, cn } from "@/lib/utils";
import { printReceipt, printInvoice } from "@/components/prints";
import { printModuleReport } from "@/components/module-print";
import type { Sale } from "@/lib/types";

function saleProfit(s: Sale) {
  return Math.round(s.items.reduce((sum, it) => sum + (it.quantity * it.unitPrice - it.discount - it.quantity * it.costPrice), 0));
}

export default function SalesPage() {
  return <Suspense><SalesInner /></Suspense>;
}

function SalesInner() {
  const store = useStore();
  const sales = useStore((s) => s.sales);
  const settings = useStore((s) => s.settings);
  const searchParams = useSearchParams();

  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [methodF, setMethodF] = useState("all");
  const [dateF, setDateF] = useState("");
  const [detail, setDetail] = useState<Sale | null>(null);

  const cur = settings.currency;
  const fmt = (n: number) => formatCurrency(n, cur);
  const today = new Date().toISOString().slice(0, 10);

  const rows = useMemo(() => sales.filter((s) => {
    if (statusF !== "all" && s.status !== statusF) return false;
    if (methodF !== "all" && s.paymentMethod !== methodF) return false;
    if (dateF && s.date.slice(0, 10) !== dateF) return false;
    const query = q.trim().toLowerCase();
    return !query || s.invoiceNo.toLowerCase().includes(query) || s.customerName.toLowerCase().includes(query);
  }), [sales, q, statusF, methodF, dateF]);

  const stats = useMemo(() => {
    const todaySales = sales.filter((s) => s.date.slice(0, 10) === today);
    return {
      todayCount: todaySales.length,
      todayTotal: todaySales.reduce((s, x) => s + x.total, 0),
      todayProfit: todaySales.reduce((s, x) => s + saleProfit(x), 0),
      allTotal: sales.reduce((s, x) => s + x.total, 0),
    };
  }, [sales, today]);

  const detailSale = detail ? sales.find((s) => s.id === detail.id) ?? detail : null;

  const focusId = searchParams.get("sale");
  const openSale = useMemo(() => (focusId ? sales.find((s) => s.id === focusId) : null), [focusId, sales]);

  function printSummary() {
    printModuleReport({
      title: "Sales Report",
      pharmacyName: settings.pharmacyName,
      address: settings.address,
      branchName: settings.branchName,
      kpis: [
        ["Invoices Today", String(stats.todayCount)],
        ["Today's Revenue", fmt(stats.todayTotal)],
        ["Today's Gross Profit", fmt(stats.todayProfit)],
        ["Lifetime Revenue", fmt(stats.allTotal)],
      ],
      sections: [{
        heading: "Invoices",
        columns: ["Invoice", "Date", "Customer", "Items", "Total", "Paid", "Balance", "Status"],
        right: [4, 5, 6],
        rows: rows.slice(0, 60).map((s) => [
          s.invoiceNo, formatDate(s.date.slice(0, 10)), s.customerName, s.items.length,
          fmt(s.total), fmt(s.paidAmount), fmt(s.total - s.paidAmount),
          s.status.replace("_", " "),
        ]),
      }],
      note: `Showing ${Math.min(rows.length, 60)} of ${rows.length} invoices. Use CSV export for the complete list.`,
    });
  }

  return (
    <div>
      <PageHeader title="Sales History" subtitle="Invoices, payments and reprints"
        actions={<>
          <Button variant="outline" size="sm" onClick={printSummary}><Printer className="h-4 w-4" /> Print Summary</Button>
          <Button variant="outline" size="sm" onClick={() => {
            downloadCSV("sales", rows.map((s) => ({
              Invoice: s.invoiceNo, Date: s.date, Customer: s.customerName, Items: s.items.length,
              Subtotal: s.subtotal, Discount: s.itemDiscountTotal + s.invoiceDiscount, Tax: s.taxTotal,
              Total: s.total, Paid: s.paidAmount, Method: s.paymentMethod, Status: s.status, Cashier: s.cashierName,
            })));
          }}><Download className="h-4 w-4" /> Export</Button>
        </>} />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Invoices Today" value={String(stats.todayCount)} icon={<Receipt className="h-5 w-5" />} tone="green" />
        <StatCard label="Today's Revenue" value={fmt(stats.todayTotal)} icon={<Banknote className="h-5 w-5" />} tone="navy" />
        <StatCard label="Today's Gross Profit" value={fmt(stats.todayProfit)} sub="Batch-cost basis" icon={<Banknote className="h-5 w-5" />} tone="amber" />
        <StatCard label="Lifetime Revenue" value={fmt(stats.allTotal)} icon={<Receipt className="h-5 w-5" />} tone="violet" />
      </div>

      <Card className="mb-4 p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice # or customer…" className="col-span-2" />
          <Select value={statusF} onChange={(e) => setStatusF(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="partially_returned">Partially returned</option>
            <option value="returned">Returned</option>
          </Select>
          <Select value={methodF} onChange={(e) => setMethodF(e.target.value)}>
            <option value="all">All payments</option>
            <option value="cash">Cash</option><option value="card">Card</option>
            <option value="bank_transfer">Bank Transfer</option><option value="mobile_wallet">Mobile Wallet</option><option value="split">Split</option>
          </Select>
          <Input type="date" value={dateF} onChange={(e) => setDateF(e.target.value)} className="col-span-2 sm:col-span-1" />
        </div>
      </Card>

      <Card>
        <TableWrap>
          <table className="w-full min-w-[900px]">
            <thead><tr><Th>Invoice</Th><Th>Date</Th><Th>Customer</Th><Th className="text-right">Items</Th><Th className="text-right">Total</Th><Th>Payment</Th><Th>Status</Th><Th>Cashier</Th><Th className="text-right">Actions</Th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className={cn(focusId === s.id && openSale && "bg-amber-50/60", openSale?.id === s.id && "bg-amber-50/60")}>
                  <Td className="font-mono text-[12px] font-semibold">{s.invoiceNo}</Td>
                  <Td>{formatDate(s.date.slice(0, 10))}<div className="text-[10px] text-slate-400">{new Date(s.date).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true })}</div></Td>
                  <Td>{s.customerName}</Td>
                  <Td className="text-right">{s.items.length}</Td>
                  <Td className="text-right font-bold">{fmt(s.total)}</Td>
                  <Td><Badge tone="slate">{s.paymentMethod.replace("_", " ")}</Badge></Td>
                  <Td><Badge tone={s.status === "completed" ? "green" : s.status === "returned" ? "slate" : "amber"}>{s.status.replace("_", " ")}</Badge></Td>
                  <Td className="text-[12px]">{s.cashierName}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" title="Details" onClick={() => setDetail(s)}><Eye className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" title="Thermal receipt" onClick={() => printReceipt(s, settings)}><Printer className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" title="A4 invoice / PDF" onClick={() => printInvoice(s, settings)}><FileText className="h-4 w-4" /></Button>
                      {s.status === "completed" && (
                        <Button size="icon" variant="ghost" title="Return items" onClick={() => { location.assign("/sales-returns"); }}><Undo2 className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
              {!rows.length && <tr><Td colSpan={9}><EmptyState title="No sales match" message="Adjust filters, or create a sale in the POS." /></Td></tr>}
            </tbody>
          </table>
        </TableWrap>
        <div className="px-4 py-2.5 text-xs text-slate-400">{rows.length} invoices</div>
      </Card>

      <Modal open={!!detailSale} onClose={() => setDetail(null)} title={`Invoice ${detailSale?.invoiceNo ?? ""}`}
        subtitle={detailSale ? `${detailSale.customerName} · ${formatDateTime(detailSale.date)} · ${detailSale.cashierName}` : ""} size="lg"
        footer={detailSale && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => printReceipt(detailSale, settings)}><Printer className="h-4 w-4" /> Thermal Receipt</Button>
            <Button variant="dark" onClick={() => printInvoice(detailSale, settings)}><FileText className="h-4 w-4" /> A4 Invoice / PDF</Button>
          </div>
        )}>
        {detailSale && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge tone="slate">{detailSale.paymentMethod.replace("_", " ")}</Badge>
              <Badge tone={detailSale.status === "completed" ? "green" : "amber"}>{detailSale.status.replace("_", " ")}</Badge>
              {detailSale.prescriptionNote && <Badge tone="violet">Rx: {detailSale.prescriptionNote}</Badge>}
            </div>
            <TableWrap>
              <table className="w-full min-w-[560px]">
                <thead><tr><Th>Medicine</Th><Th>Batch</Th><Th className="text-right">Qty</Th><Th className="text-right">Price</Th><Th className="text-right">Disc.</Th><Th className="text-right">Total</Th></tr></thead>
                <tbody>
                  {detailSale.items.map((it) => (
                    <tr key={it.id}>
                      <Td className="font-medium">{it.medicineName}</Td>
                      <Td><div className="font-mono text-[11px]">{it.batchNo}</div><div className="text-[10px] text-slate-400">exp {formatDate(it.expiryDate)}</div></Td>
                      <Td className="text-right">{it.quantity}</Td>
                      <Td className="text-right">{fmt(it.unitPrice)}</Td>
                      <Td className="text-right">{it.discount ? `−${fmt(it.discount)}` : "—"}</Td>
                      <Td className="text-right font-semibold">{fmt(it.total)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-[13px]">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{fmt(detailSale.subtotal)}</span></div>
              {detailSale.itemDiscountTotal > 0 && <div className="flex justify-between text-slate-600"><span>Item discounts</span><span>−{fmt(detailSale.itemDiscountTotal)}</span></div>}
              {detailSale.invoiceDiscount > 0 && <div className="flex justify-between text-slate-600"><span>Invoice discount</span><span>−{fmt(detailSale.invoiceDiscount)}</span></div>}
              {detailSale.taxTotal > 0 && <div className="flex justify-between text-slate-600"><span>Tax</span><span>{fmt(detailSale.taxTotal)}</span></div>}
              <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-800"><span>Grand Total</span><span>{fmt(detailSale.total)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Paid</span><span>{fmt(detailSale.paidAmount)}</span></div>
              {detailSale.changeReturned > 0 && <div className="flex justify-between text-slate-600"><span>Change</span><span>{fmt(detailSale.changeReturned)}</span></div>}
              {detailSale.paidAmount < detailSale.total && <div className="flex justify-between font-semibold text-amber-700"><span>Balance due</span><span>{fmt(detailSale.total - detailSale.paidAmount)}</span></div>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
