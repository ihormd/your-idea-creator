import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import JSZip from "jszip";

import { supabase } from "@/integrations/supabase/client";
import { categoryLabel, money, num, type Business, type Project, type Receipt } from "@/lib/domain";

// The "Accountant Export" bundle — matches what a bookkeeper actually asks
// for at tax time: the raw transaction list in two formats they can drop
// into their own tools (CSV, XLSX), a PDF someone can read without opening
// a spreadsheet, a GST/HST summary PDF, the receipt images themselves so
// nothing gets requested twice, and a README explaining what's in the zip.

type Row = {
  date: string;
  vendor: string;
  category: string;
  project: string;
  subtotal: number;
  gst: number;
  otherTax: number;
  total: number;
  currency: string;
  payment: string;
  receiptNumber: string;
  status: string;
};

function toRows(receipts: Receipt[], projects: Project[]): Row[] {
  return receipts.map((r) => ({
    date: r.receipt_date ?? "",
    vendor: r.vendor ?? "",
    category: categoryLabel(r.category),
    project: projects.find((p) => p.id === r.project_id)?.name ?? "",
    subtotal: num(r.subtotal),
    gst: num(r.gst_hst),
    otherTax: num(r.other_tax),
    total: num(r.total),
    currency: r.currency,
    payment: r.payment_method ?? "",
    receiptNumber: r.receipt_number ?? "",
    status: r.review_status,
  }));
}

const HEADER = [
  "Date",
  "Vendor",
  "Category",
  "Project",
  "Subtotal",
  "GST/HST",
  "Other tax",
  "Total",
  "Currency",
  "Payment method",
  "Receipt #",
  "Status",
];

function rowToArray(r: Row): (string | number)[] {
  return [
    r.date,
    r.vendor,
    r.category,
    r.project,
    r.subtotal.toFixed(2),
    r.gst.toFixed(2),
    r.otherTax.toFixed(2),
    r.total.toFixed(2),
    r.currency,
    r.payment,
    r.receiptNumber,
    r.status,
  ];
}

function buildCsv(rows: Row[]): string {
  const lines = [HEADER, ...rows.map(rowToArray)];
  return lines
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function buildXlsx(rows: Row[]): ArrayBuffer {
  const sheet = XLSX.utils.aoa_to_sheet([HEADER, ...rows.map(rowToArray)]);
  sheet["!cols"] = HEADER.map((h) => ({ wch: Math.max(h.length + 2, 12) }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Transactions");
  return XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function buildExpenseReportPdf(
  business: Business | null,
  rows: Row[],
  from: string,
  to: string,
): ArrayBuffer {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(business?.name || "Expense report", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`${from} to ${to} · Generated ${new Date().toLocaleDateString()}`, 14, 25);

  autoTable(doc, {
    startY: 32,
    head: [HEADER],
    body: rows.map(rowToArray),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59] },
    columnStyles: {
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
    },
  });

  const total = rows.reduce((s, r) => s + r.total, 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY ?? 32;
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text(`Total: ${money(total, business?.currency ?? "CAD")}`, 14, finalY + 10);

  return doc.output("arraybuffer");
}

function buildTaxSummaryPdf(
  business: Business | null,
  rows: Row[],
  from: string,
  to: string,
): ArrayBuffer {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("GST/HST summary", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`${business?.name || ""} · ${from} to ${to}`, 14, 25);

  const byCategory = new Map<string, { subtotal: number; gst: number; total: number }>();
  for (const r of rows) {
    const cur = byCategory.get(r.category) ?? { subtotal: 0, gst: 0, total: 0 };
    cur.subtotal += r.subtotal;
    cur.gst += r.gst;
    cur.total += r.total;
    byCategory.set(r.category, cur);
  }

  autoTable(doc, {
    startY: 32,
    head: [["Category", "Subtotal", "GST/HST collected", "Total"]],
    body: Array.from(byCategory.entries()).map(([cat, v]) => [
      cat,
      v.subtotal.toFixed(2),
      v.gst.toFixed(2),
      v.total.toFixed(2),
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 41, 59] },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });

  const totalGst = rows.reduce((s, r) => s + r.gst, 0);
  const totalOther = rows.reduce((s, r) => s + r.otherTax, 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY ?? 32;
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text(`Total GST/HST: ${money(totalGst, business?.currency ?? "CAD")}`, 14, finalY + 10);
  doc.text(`Total other tax: ${money(totalOther, business?.currency ?? "CAD")}`, 14, finalY + 17);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    "Informational summary only — not tax advice. Confirm figures with your accountant.",
    14,
    finalY + 28,
  );

  return doc.output("arraybuffer");
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCsv(receipts: Receipt[], projects: Project[], from: string, to: string) {
  const rows = toRows(receipts, projects);
  download(
    new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8" }),
    `transactions-${from}-to-${to}.csv`,
  );
}

export function exportXlsx(receipts: Receipt[], projects: Project[], from: string, to: string) {
  const rows = toRows(receipts, projects);
  download(
    new Blob([buildXlsx(rows)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `transactions-${from}-to-${to}.xlsx`,
  );
}

export function exportExpensePdf(
  business: Business | null,
  receipts: Receipt[],
  projects: Project[],
  from: string,
  to: string,
) {
  const rows = toRows(receipts, projects);
  download(
    new Blob([buildExpenseReportPdf(business, rows, from, to)], { type: "application/pdf" }),
    `expense-report-${from}-to-${to}.pdf`,
  );
}

export function exportTaxSummaryPdf(
  business: Business | null,
  receipts: Receipt[],
  projects: Project[],
  from: string,
  to: string,
) {
  const rows = toRows(receipts, projects);
  download(
    new Blob([buildTaxSummaryPdf(business, rows, from, to)], { type: "application/pdf" }),
    `tax-summary-${from}-to-${to}.pdf`,
  );
}

// The full accountant package: everything above, plus every receipt image
// in the date range, zipped together with a README explaining the contents
// — this is what actually gets emailed to a bookkeeper at year-end.
export async function exportAccountantPackage(
  business: Business | null,
  receipts: Receipt[],
  projects: Project[],
  from: string,
  to: string,
  onProgress?: (done: number, total: number) => void,
) {
  const rows = toRows(receipts, projects);
  const zip = new JSZip();

  zip.file(`transactions.csv`, buildCsv(rows));
  zip.file(`transactions.xlsx`, buildXlsx(rows));
  zip.file(`expense_report.pdf`, buildExpenseReportPdf(business, rows, from, to));
  zip.file(`tax_summary.pdf`, buildTaxSummaryPdf(business, rows, from, to));

  const receiptsFolder = zip.folder("receipts");
  const withImages = receipts.filter((r) => r.image_path);
  for (let i = 0; i < withImages.length; i++) {
    const r = withImages[i]!;
    onProgress?.(i, withImages.length);
    try {
      const { data: signed } = await supabase.storage
        .from("receipts")
        .createSignedUrl(r.image_path!, 300);
      if (!signed) continue;
      const res = await fetch(signed.signedUrl);
      const blob = await res.blob();
      const ext = r.image_path!.split(".").pop() || "jpg";
      const safeVendor = (r.vendor || "receipt").replace(/[^a-z0-9]+/gi, "-").slice(0, 40);
      receiptsFolder?.file(
        `${r.receipt_date ?? "undated"}-${safeVendor}-${r.id.slice(0, 8)}.${ext}`,
        blob,
      );
    } catch {
      // one bad image shouldn't block the whole export
    }
  }
  onProgress?.(withImages.length, withImages.length);

  const total = rows.reduce((s, r) => s + r.total, 0);
  zip.file(
    "README.txt",
    [
      `${business?.name || "Expense export"}`,
      `Period: ${from} to ${to}`,
      `Generated: ${new Date().toLocaleString()}`,
      `Transactions: ${rows.length}`,
      `Total: ${money(total, business?.currency ?? "CAD")}`,
      "",
      "Contents:",
      "  transactions.csv     — raw transaction list (Excel, QuickBooks, Xero import)",
      "  transactions.xlsx    — same data as a formatted spreadsheet",
      "  expense_report.pdf   — printable transaction list",
      "  tax_summary.pdf      — GST/HST totals by category",
      "  receipts/            — original receipt photos, one per transaction",
      "",
      "This export is informational only and is not tax or accounting advice.",
    ].join("\n"),
  );

  const blob = await zip.generateAsync({ type: "blob" });
  download(
    blob,
    `${(business?.name || "jobledger").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-export-${from}-to-${to}.zip`,
  );
}
