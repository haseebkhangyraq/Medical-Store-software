import type { Sale, SalesReturn, PharmacySettings, Issuance, Receiving, PurchaseReturn } from "@/lib/types";
import { formatCurrency, formatDateTime, printArea } from "@/lib/utils";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash", card: "Card", bank_transfer: "Bank Transfer", mobile_wallet: "Mobile Wallet", split: "Split",
};

export function printReceipt(sale: Sale, settings: PharmacySettings) {
  const cur = settings.currency;
  const rows = sale.items.map((it) => `
    <tr>
      <td colspan="3">${esc(it.medicineName)}<br/><span style="font-size:9px;color:#444">B:${esc(it.batchNo)} · Exp:${it.expiryDate.slice(0,10)} · ${it.quantity} x ${formatCurrency(it.unitPrice, cur)}</span></td>
    </tr>
    <tr><td colspan="3" style="border:none;padding:0 4px 6px 4px;text-align:right"><b>${formatCurrency(it.total, cur)}</b></td></tr>
  `).join("");

  const split = sale.paymentMethod === "split" && sale.splitParts?.length
    ? sale.splitParts.map((p) => `<div class="right">${METHOD_LABEL[p.method]}: ${formatCurrency(p.amount, cur)}</div>`).join("")
    : "";

  const html = `
  <div class="receipt80">
    <div class="center">
      <div style="font-size:15px;font-weight:bold">${esc(settings.pharmacyName)}</div>
      <div style="font-size:10px">${esc(settings.address)}</div>
      <div style="font-size:10px">Tel: ${esc(settings.phone)} · LIC: ${esc(settings.licenseNo)}</div>
    </div>
    <hr/>
    <div style="display:flex;justify-content:space-between;font-size:11px">
      <span>Invoice: <b>${esc(sale.invoiceNo)}</b></span>
      <span>${formatDateTime(sale.date)}</span>
    </div>
    <div style="font-size:11px">Customer: ${esc(sale.customerName)} &nbsp;|&nbsp; Cashier: ${esc(sale.cashierName)}</div>
    <hr/>
    <table>
      <tr><th colspan="3" style="text-align:left">Items</th></tr>
      ${rows}
    </table>
    <hr/>
    <div style="font-size:11px">
      <div class="right">Subtotal: ${formatCurrency(sale.subtotal, cur)}</div>
      ${sale.itemDiscountTotal ? `<div class="right">Item discounts: −${formatCurrency(sale.itemDiscountTotal, cur)}</div>` : ""}
      ${sale.invoiceDiscount ? `<div class="right">Invoice discount: −${formatCurrency(sale.invoiceDiscount, cur)}</div>` : ""}
      ${sale.taxTotal ? `<div class="right">Tax: ${formatCurrency(sale.taxTotal, cur)}</div>` : ""}
      <div class="right" style="font-weight:bold;font-size:13px">TOTAL: ${formatCurrency(sale.total, cur)}</div>
      <div class="right">Paid (${METHOD_LABEL[sale.paymentMethod]}): ${formatCurrency(sale.paidAmount, cur)}</div>
      ${sale.changeReturned ? `<div class="right">Change: ${formatCurrency(sale.changeReturned, cur)}</div>` : ""}
      ${sale.paidAmount < sale.total ? `<div class="right">Balance due: ${formatCurrency(sale.total - sale.paidAmount, cur)}</div>` : ""}
      ${split}
    </div>
    <hr/>
    <div class="center" style="font-size:10px">${esc(settings.invoiceFooter)}</div>
    <div class="center" style="font-size:9px;margin-top:4px">*** DEMO RECEIPT — NOT A LEGAL DOCUMENT ***</div>
  </div>`;
  printArea(html, `Receipt ${sale.invoiceNo}`);
}

export function printInvoice(sale: Sale, settings: PharmacySettings) {
  const cur = settings.currency;
  const rows = sale.items.map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><b>${esc(it.medicineName)}</b><br/><span class="muted" style="font-size:10px">Batch ${esc(it.batchNo)} · Exp ${it.expiryDate.slice(0, 10)}</span></td>
      <td class="num">${it.quantity}</td>
      <td class="num">${formatCurrency(it.unitPrice, cur)}</td>
      <td class="num">${it.discount ? "−" + formatCurrency(it.discount, cur) : "—"}</td>
      <td class="num">${formatCurrency(it.total, cur)}</td>
    </tr>`).join("");

  const html = `
  <div class="invoice">
    <div class="inv-head">
      <div>
        <div class="inv-logo">${esc(settings.pharmacyName)}</div>
        <div class="muted" style="font-size:11px;margin-top:4px">${esc(settings.address)}<br/>Tel: ${esc(settings.phone)} · ${esc(settings.email)}<br/>DRAP License: ${esc(settings.licenseNo)}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:16px;font-weight:700;color:#16223a">SALES INVOICE</div>
        <div class="muted" style="font-size:12px;margin-top:4px">Invoice #: <b>${esc(sale.invoiceNo)}</b></div>
        <div class="muted" style="font-size:12px">Date: ${formatDateTime(sale.date)}</div>
        <div class="muted" style="font-size:12px">Cashier: ${esc(sale.cashierName)}</div>
        <span class="badge-amber" style="margin-top:6px;display:inline-block">DEMO DOCUMENT</span>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;margin-top:16px">
      <div>
        <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Billed To</div>
        <div style="font-weight:700;font-size:14px">${esc(sale.customerName)}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Payment</div>
        <div style="font-weight:600;font-size:13px">${METHOD_LABEL[sale.paymentMethod]}</div>
      </div>
    </div>

    <table class="mt16">
      <thead><tr><th style="width:28px">#</th><th>Medicine</th><th class="num" style="width:60px">Qty</th><th class="num" style="width:90px">Unit Price</th><th class="num" style="width:80px">Disc.</th><th class="num" style="width:100px">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div style="display:flex;justify-content:flex-end;margin-top:14px">
      <table class="totals" style="min-width:280px">
        <tr><td class="muted">Subtotal</td><td class="num">${formatCurrency(sale.subtotal, cur)}</td></tr>
        ${sale.itemDiscountTotal ? `<tr><td class="muted">Item Discounts</td><td class="num">−${formatCurrency(sale.itemDiscountTotal, cur)}</td></tr>` : ""}
        ${sale.invoiceDiscount ? `<tr><td class="muted">Invoice Discount</td><td class="num">−${formatCurrency(sale.invoiceDiscount, cur)}</td></tr>` : ""}
        ${sale.taxTotal ? `<tr><td class="muted">Tax (${sale.items[0]?.taxRate ?? 0}%)</td><td class="num">${formatCurrency(sale.taxTotal, cur)}</td></tr>` : ""}
        <tr style="border-top:2px solid #16223a"><td style="font-weight:800;color:#16223a;font-size:14px">GRAND TOTAL</td><td class="num" style="font-weight:800;color:#16223a;font-size:14px">${formatCurrency(sale.total, cur)}</td></tr>
        <tr><td class="muted">Paid (${METHOD_LABEL[sale.paymentMethod]})</td><td class="num">${formatCurrency(sale.paidAmount, cur)}</td></tr>
        ${sale.changeReturned ? `<tr><td class="muted">Change Returned</td><td class="num">${formatCurrency(sale.changeReturned, cur)}</td></tr>` : ""}
        ${sale.paidAmount < sale.total ? `<tr><td style="color:#b91c1c;font-weight:700">Balance Due</td><td class="num" style="color:#b91c1c;font-weight:700">${formatCurrency(sale.total - sale.paidAmount, cur)}</td></tr>` : ""}
      </table>
    </div>

    <div class="mt24" style="border-top:1px dashed #d1d5db;padding-top:10px;font-size:11px;color:#6b7280">
      ${esc(settings.invoiceFooter)}
    </div>
    <div class="mt8" style="font-size:10px;color:#9ca3af;text-align:center">Generated by MediCore Pharmacy ERP — demonstration document</div>
  </div>`;
  printArea(html, `Invoice ${sale.invoiceNo}`);
}

export function printIssuanceVoucher(iss: Issuance, settings: PharmacySettings) {
  const cur = settings.currency;
  const REASONS: Record<string, string> = {
    internal_use: "Internal Use", damaged: "Damaged Stock", expired: "Expired Stock",
    sample: "Sample Distribution", adjustment: "Stock Adjustment", other: "Other",
  };
  const rows = iss.items.map((it, i) => `
    <tr><td>${i + 1}</td><td>${esc(it.medicineName)}</td><td>${esc(it.batchNo)}</td><td class="num">${it.quantity}</td>
    <td class="num">${formatCurrency(it.unitCost, cur)}</td><td class="num">${formatCurrency(it.quantity * it.unitCost, cur)}</td></tr>`).join("");
  const html = `
  <div class="invoice">
    <div class="inv-head">
      <div><div class="inv-logo">${esc(settings.pharmacyName)}</div>
      <div class="muted" style="font-size:11px;margin-top:4px">${esc(settings.address)}<br/>Tel: ${esc(settings.phone)}</div></div>
      <div style="text-align:right"><div style="font-size:16px;font-weight:700;color:#16223a">STOCK ISSUE VOUCHER</div>
      <div class="muted" style="font-size:12px;margin-top:4px">Voucher #: <b>${esc(iss.voucherNo)}</b></div>
      <div class="muted" style="font-size:12px">Date: ${formatDateTime(iss.date)}</div>
      <div class="muted" style="font-size:12px">Reason: ${REASONS[iss.reason] ?? iss.reason}</div></div>
    </div>
    <div style="display:flex;gap:32px;margin-top:14px;font-size:12px">
      <div><span class="muted">Destination:</span> <b>${esc(iss.destination)}</b></div>
      <div><span class="muted">Authorized By:</span> <b>${esc(iss.authorizedBy)}</b></div>
    </div>
    <table class="mt16">
      <thead><tr><th style="width:28px">#</th><th>Medicine</th><th>Batch</th><th class="num">Qty</th><th class="num">Unit Cost</th><th class="num">Value</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${iss.notes ? `<div class="mt8" style="font-size:12px"><span class="muted">Notes:</span> ${esc(iss.notes)}</div>` : ""}
    <div style="display:flex;justify-content:flex-end;margin-top:12px"><table class="totals" style="min-width:240px">
      <tr><td style="font-weight:700">Total Value</td><td class="num" style="font-weight:700">${formatCurrency(iss.totalValue, cur)}</td></tr></table></div>
    <div class="mt24" style="display:flex;justify-content:space-between;font-size:11px">
      <div style="border-top:1px solid #333;padding-top:4px;width:200px">Issued By</div>
      <div style="border-top:1px solid #333;padding-top:4px;width:200px">Received By</div>
      <div style="border-top:1px solid #333;padding-top:4px;width:200px">Authorized By</div>
    </div>
    <div class="mt8" style="font-size:10px;color:#9ca3af;text-align:center">Demonstration document</div>
  </div>`;
  printArea(html, `Issue Voucher ${iss.voucherNo}`);
}

export function printReceivingDoc(rcv: Receiving, settings: PharmacySettings) {
  const cur = settings.currency;
  const rows = rcv.items.map((it, i) => `
    <tr><td>${i + 1}</td><td>${esc(it.medicineName)}</td><td>${esc(it.batchNo)}</td><td>${it.expiryDate.slice(0, 10)}</td>
    <td class="num">${it.quantity}</td><td class="num">${formatCurrency(it.unitCost, cur)}</td><td class="num">${formatCurrency(it.quantity * it.unitCost, cur)}</td></tr>`).join("");
  const html = `
  <div class="invoice">
    <div class="inv-head">
      <div><div class="inv-logo">${esc(settings.pharmacyName)}</div>
      <div class="muted" style="font-size:11px;margin-top:4px">${esc(settings.address)}</div></div>
      <div style="text-align:right"><div style="font-size:16px;font-weight:700;color:#16223a">GOODS RECEIVING NOTE</div>
      <div class="muted" style="font-size:12px;margin-top:4px">GRN #: <b>${esc(rcv.receiveNo)}</b></div>
      <div class="muted" style="font-size:12px">PO Ref: ${esc(rcv.refNo)}</div>
      <div class="muted" style="font-size:12px">Date: ${formatDateTime(rcv.date)}</div></div>
    </div>
    <div style="margin-top:14px;font-size:12px"><span class="muted">Supplier:</span> <b>${esc(rcv.supplierName)}</b> &nbsp; <span class="muted">Received By:</span> <b>${esc(rcv.receivedBy)}</b></div>
    <table class="mt16">
      <thead><tr><th style="width:28px">#</th><th>Medicine</th><th>Batch</th><th>Expiry</th><th class="num">Qty</th><th class="num">Cost</th><th class="num">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-top:12px"><table class="totals" style="min-width:240px">
      <tr><td style="font-weight:700">Received Value</td><td class="num" style="font-weight:700">${formatCurrency(rcv.total, cur)}</td></tr></table></div>
    <div class="mt8" style="font-size:10px;color:#9ca3af;text-align:center">Demonstration document</div>
  </div>`;
  printArea(html, `GRN ${rcv.receiveNo}`);
}

export function printSalesReturnNote(sr: SalesReturn, settings: PharmacySettings) {
  const cur = settings.currency;
  const rows = sr.items.map((it, i) => `
    <tr><td>${i + 1}</td><td>${esc(it.medicineName)}</td><td>${esc(it.batchNo)}</td><td class="num">${it.quantity}</td>
    <td class="num">${formatCurrency(it.unitPrice, cur)}</td><td class="num">${it.restock ? "Yes" : "No"}</td><td class="num">${formatCurrency(it.refundAmount, cur)}</td></tr>`).join("");
  const html = `
  <div class="invoice">
    <div class="inv-head">
      <div><div class="inv-logo">${esc(settings.pharmacyName)}</div><div class="muted" style="font-size:11px;margin-top:4px">${esc(settings.address)}</div></div>
      <div style="text-align:right"><div style="font-size:16px;font-weight:700;color:#16223a">SALES RETURN NOTE</div>
      <div class="muted" style="font-size:12px;margin-top:4px">Return #: <b>${esc(sr.returnNo)}</b></div>
      <div class="muted" style="font-size:12px">Invoice: ${esc(sr.invoiceNo)}</div>
      <div class="muted" style="font-size:12px">Date: ${formatDateTime(sr.date)}</div></div>
    </div>
    <div style="margin-top:14px;font-size:12px"><span class="muted">Customer:</span> <b>${esc(sr.customerName)}</b> &nbsp; <span class="muted">Reason:</span> ${esc(sr.reason)}</div>
    <table class="mt16">
      <thead><tr><th style="width:28px">#</th><th>Medicine</th><th>Batch</th><th class="num">Qty</th><th class="num">Price</th><th>Restock</th><th class="num">Refund</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-top:12px"><table class="totals" style="min-width:240px">
      <tr><td style="font-weight:700">Total Refund (${sr.restockMethod.replace("_", " ")})</td><td class="num" style="font-weight:700">${formatCurrency(sr.totalRefund, cur)}</td></tr></table></div>
    <div class="mt8" style="font-size:10px;color:#9ca3af;text-align:center">Demonstration document</div>
  </div>`;
  printArea(html, `Sales Return ${sr.returnNo}`);
}

export function printPurchaseReturnNote(pr: PurchaseReturn, settings: PharmacySettings) {
  const cur = settings.currency;
  const rows = pr.items.map((it, i) => `
    <tr><td>${i + 1}</td><td>${esc(it.medicineName)}</td><td>${esc(it.batchNo)}</td><td class="num">${it.quantity}</td>
    <td class="num">${formatCurrency(it.unitCost, cur)}</td><td class="num">${formatCurrency(it.refundAmount, cur)}</td></tr>`).join("");
  const html = `
  <div class="invoice">
    <div class="inv-head">
      <div><div class="inv-logo">${esc(settings.pharmacyName)}</div><div class="muted" style="font-size:11px;margin-top:4px">${esc(settings.address)}</div></div>
      <div style="text-align:right"><div style="font-size:16px;font-weight:700;color:#16223a">PURCHASE RETURN NOTE</div>
      <div class="muted" style="font-size:12px;margin-top:4px">Return #: <b>${esc(pr.returnNo)}</b></div>
      <div class="muted" style="font-size:12px">PO Ref: ${esc(pr.refNo)}</div>
      <div class="muted" style="font-size:12px">Date: ${formatDateTime(pr.date)}</div></div>
    </div>
    <div style="margin-top:14px;font-size:12px"><span class="muted">Supplier:</span> <b>${esc(pr.supplierName)}</b> &nbsp; <span class="muted">Reason:</span> ${esc(pr.reason)}</div>
    <table class="mt16">
      <thead><tr><th style="width:28px">#</th><th>Medicine</th><th>Batch</th><th class="num">Qty</th><th class="num">Cost</th><th class="num">Credit</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-top:12px"><table class="totals" style="min-width:240px">
      <tr><td style="font-weight:700">Total Adjustment</td><td class="num" style="font-weight:700">${formatCurrency(pr.totalRefund, cur)}</td></tr></table></div>
    <div class="mt8" style="font-size:10px;color:#9ca3af;text-align:center">Demonstration document</div>
  </div>`;
  printArea(html, `Purchase Return ${pr.returnNo}`);
}
