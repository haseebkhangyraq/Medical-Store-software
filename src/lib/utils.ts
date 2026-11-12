import clsx, { type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

let seq = Math.floor(Math.random() * 100000);
export function uid(prefix = "id") {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

// ─── Number & currency formatting (Pakistani style) ───────────────────────────

export function formatCurrency(amount: number, currency = "Rs.") {
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  const s = rounded.toLocaleString("en-PK", {
    maximumFractionDigits: 2,
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
  });
  return `${currency} ${s}`;
}

export function formatNumber(n: number) {
  return n.toLocaleString("en-PK");
}

export function formatCompact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-PK");
}

// ─── Dates ────────────────────────────────────────────────────────────────────

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function addDays(dateISO: string, days: number) {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function formatDate(dateISO: string) {
  if (!dateISO) return "—";
  const d = new Date(dateISO.length > 10 ? dateISO : dateISO + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

export function formatDateTime(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  const h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${formatDate(iso.slice(0, 10))}, ${h12}:${String(d.getMinutes()).padStart(2, "0")} ${ampm}`;
}

export function daysUntil(dateISO: string) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateISO + "T00:00:00");
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

export function isExpired(expiryDate: string) {
  return daysUntil(expiryDate) < 0;
}

// ─── IDs for documents ───────────────────────────────────────────────────────

export function docNo(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(5, "0")}`;
}

// ─── CSV export ──────────────────────────────────────────────────────────────

export function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function printArea(html: string, title = "Print") {
  const win = window.open("", "_blank", "width=880,height=900");
  if (!win) return;
  win.document.write(`<!doctype html><html><head><title>${title}</title>
  <style>${PRINT_CSS}</style></head><body>${html}
  <script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script>
  </body></html>`);
  win.document.close();
}

export const PRINT_CSS = `
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; color: #111; margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 6px 8px; font-size: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
  th { background: #f3f4f6; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: #374151; }
  .num { text-align: right; }
  .center { text-align: center; }
  h1,h2,h3 { margin: 0; }
  .muted { color: #6b7280; }
  .border { border: 1px solid #e5e7eb; }
  .mt8 { margin-top: 8px; } .mt16 { margin-top: 16px; } .mt24 { margin-top: 24px; }
  /* thermal receipt 80mm */
  .receipt80 { width: 80mm; margin: 0 auto; font-family: "Courier New", monospace; font-size: 12px; }
  .receipt80 table { font-size: 11px; }
  .receipt80 th { background: none; border-bottom: 1px dashed #000; text-transform: none; font-size: 11px; }
  .receipt80 td, .receipt80 th { padding: 2px 4px; }
  .receipt80 hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  .receipt80 .center { text-align: center; }
  .receipt80 .right { text-align: right; }
  .invoice { max-width: 800px; margin: 0 auto; }
  .inv-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #16223a; padding-bottom: 12px; }
  .inv-logo { font-size: 22px; font-weight: 800; color: #16223a; letter-spacing: .5px; }
  .totals td { border: none; padding: 3px 8px; }
  .badge-amber { background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:99px; font-size:11px; font-weight:600;}
  @media print { body { margin: 0; } }
`;
