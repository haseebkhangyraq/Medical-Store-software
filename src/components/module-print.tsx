"use client";

import { printArea } from "@/lib/utils";

export interface PrintSection {
  heading?: string;
  columns: string[];
  rows: (string | number)[][];
  /** per-column alignment; default left, columns listed here are right-aligned */
  right?: number[];
}

export interface ModuleReportInput {
  title: string;
  pharmacyName: string;
  address?: string;
  branchName?: string;
  /** KPI summary chips: [label, value] */
  kpis?: [string, string][];
  sections: PrintSection[];
  note?: string;
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Prints a polished A4 summary report for a module: header, KPI chips,
 *  sectioned tables with right-aligned numeric columns and a footer. */
export function printModuleReport(input: ModuleReportInput) {
  const now = new Date().toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });

  const kpiHtml = input.kpis?.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px">${input.kpis
        .map(([k, v]) =>
          `<div style="flex:1 1 118px;border:1px solid #e5e7eb;border-radius:10px;padding:8px 10px">
             <div style="font-size:9px;text-transform:uppercase;letter-spacing:.6px;color:#6b7280;font-weight:700">${esc(k)}</div>
             <div style="font-size:14px;font-weight:800;color:#16223a;margin-top:3px">${esc(v)}</div>
           </div>`)
        .join("")}</div>`
    : "";

  const sections = input.sections.map((sec) => {
    const align = (i: number) => (sec.right?.includes(i) ? ' class="num"' : "");
    const head = sec.columns.map((c, i) => `<th${sec.right?.includes(i) ? ' class="num"' : ""}>${esc(c)}</th>`).join("");
    const body = sec.rows.length
      ? sec.rows.map((r) => `<tr>${r.map((c, i) => `<td${align(i)}>${esc(c)}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="${sec.columns.length}" class="center muted" style="padding:14px">No records</td></tr>`;
    return `
      ${sec.heading ? `<div style="font-size:12px;font-weight:800;color:#16223a;margin:16px 0 2px;text-transform:uppercase;letter-spacing:.5px">${esc(sec.heading)}</div>` : ""}
      <table>${`<thead><tr>${head}</tr></thead><tbody>${body}</tbody>`}</table>`;
  }).join("");

  printArea(`<div class="invoice">
    <div class="inv-head">
      <div>
        <div class="inv-logo">${esc(input.pharmacyName)}</div>
        <div class="muted" style="font-size:11px">${esc(input.address ?? "")}${input.branchName ? `<br/>${esc(input.branchName)}` : ""}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:16px;font-weight:800;color:#16223a">${esc(input.title.toUpperCase())}</div>
        <div class="muted" style="font-size:12px">Summary Report · Generated ${esc(now)}</div>
      </div>
    </div>
    ${kpiHtml}
    ${sections}
    ${input.note ? `<div class="mt8" style="font-size:11px;color:#6b7280">${esc(input.note)}</div>` : ""}
    <div class="mt8 muted" style="font-size:10px;text-align:center">Demonstration summary report · MediCore Pharmacy ERP</div>
  </div>`, `${input.title} — Summary`);
}
