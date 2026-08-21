import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useProjects, useReceipts } from "@/lib/queries";
import { CATEGORIES, categoryLabel, money, num } from "@/lib/domain";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports & exports — JobLedger" },
      { name: "description", content: "Summaries by category and project, plus accountant-ready CSV exports." },
      { property: "og:title", content: "Reports & exports — JobLedger" },
      { property: "og:description", content: "Export your expenses and GST/HST totals in one click." },
    ],
  }),
  component: Reports,
});

function Reports() {
  const { user } = useAuth();
  const { data: receipts = [] } = useReceipts(user?.id);
  const { data: projects = [] } = useProjects(user?.id);

  const today = new Date();
  const firstOfYear = `${today.getFullYear()}-01-01`;
  const [from, setFrom] = useState(firstOfYear);
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  const inRange = useMemo(
    () =>
      receipts.filter((r) => {
        if (!r.receipt_date) return false;
        return r.receipt_date >= from && r.receipt_date <= to;
      }),
    [receipts, from, to],
  );

  const total = inRange.reduce((s, r) => s + num(r.total), 0);
  const gst = inRange.reduce((s, r) => s + num(r.gst_hst), 0);
  const other = inRange.reduce((s, r) => s + num(r.other_tax), 0);

  const byCategory = CATEGORIES.map((c) => ({
    label: c.label,
    value: inRange.filter((r) => r.category === c.value).reduce((s, r) => s + num(r.total), 0),
  }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  const byProject = projects
    .map((p) => ({
      label: p.name,
      value: inRange.filter((r) => r.project_id === p.id).reduce((s, r) => s + num(r.total), 0),
    }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);

  function exportCsv() {
    const header = [
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
    const rows = inRange.map((r) => [
      r.receipt_date ?? "",
      r.vendor ?? "",
      categoryLabel(r.category),
      projects.find((p) => p.id === r.project_id)?.name ?? "",
      num(r.subtotal).toFixed(2),
      num(r.gst_hst).toFixed(2),
      num(r.other_tax).toFixed(2),
      num(r.total).toFixed(2),
      r.currency,
      r.payment_method ?? "",
      r.receipt_number ?? "",
      r.review_status,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `jobledger-expenses-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell title="Reports" subtitle="Summaries and exports">
      <div className="space-y-4">
        <div className="panel grid grid-cols-2 gap-3 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <div className="panel grid grid-cols-3 gap-3 p-4">
          <Metric label="Total spend" value={money(total)} />
          <Metric label="GST/HST" value={money(gst)} />
          <Metric label="Other tax" value={money(other)} />
        </div>

        <Breakdown title="By category" rows={byCategory} total={total} />
        {byProject.length ? <Breakdown title="By project" rows={byProject} total={total} /> : null}

        <Button className="w-full" onClick={exportCsv} disabled={inRange.length === 0}>
          <Download /> Export {inRange.length} receipts to CSV
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          CSV works with QuickBooks Online, Xero and your accountant's spreadsheet.
        </p>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Breakdown({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { label: string; value: number }[];
  total: number;
}) {
  return (
    <div className="panel p-4">
      <p className="mb-3 text-sm font-medium">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing in this date range.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex justify-between text-sm">
                <span className="truncate">{r.label}</span>
                <span className="tabular-nums font-medium">{money(r.value)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${total > 0 ? (r.value / total) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
