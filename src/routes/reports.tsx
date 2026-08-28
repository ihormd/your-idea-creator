import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, FileText, Loader2, Package } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBusiness } from "@/lib/business";
import { useProjects, useReceipts } from "@/lib/queries";
import { CATEGORIES, money, num } from "@/lib/domain";
import {
  exportAccountantPackage,
  exportCsv,
  exportExpensePdf,
  exportTaxSummaryPdf,
  exportXlsx,
} from "@/lib/export";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports & exports — JobLedger" },
      {
        name: "description",
        content: "Summaries by category and project, plus accountant-ready exports.",
      },
      { property: "og:title", content: "Reports & exports — JobLedger" },
      {
        property: "og:description",
        content: "Export your expenses, GST/HST totals, and receipt images in one click.",
      },
    ],
  }),
  component: Reports,
});

function Reports() {
  const { business, businessId } = useBusiness();
  const { data: receipts = [] } = useReceipts(businessId);
  const { data: projects = [] } = useProjects(businessId);
  const [packing, setPacking] = useState(false);
  const [packProgress, setPackProgress] = useState({ done: 0, total: 0 });

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

  async function handlePackage() {
    setPacking(true);
    setPackProgress({ done: 0, total: inRange.length });
    try {
      await exportAccountantPackage(business, inRange, projects, from, to, (done, total) =>
        setPackProgress({ done, total }),
      );
    } catch {
      toast.error("Couldn't build the export package. Try again.");
    } finally {
      setPacking(false);
    }
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
          <Metric label="Total spend" value={money(total, business?.currency)} />
          <Metric label="GST/HST" value={money(gst, business?.currency)} />
          <Metric label="Other tax" value={money(other, business?.currency)} />
        </div>

        <Breakdown
          title="By category"
          rows={byCategory}
          total={total}
          currency={business?.currency}
        />
        {byProject.length ? (
          <Breakdown
            title="By project"
            rows={byProject}
            total={total}
            currency={business?.currency}
          />
        ) : null}

        <div className="panel space-y-3 p-4">
          <p className="text-sm font-medium">Export {inRange.length} receipts</p>

          <Button
            className="w-full"
            disabled={inRange.length === 0 || packing}
            onClick={handlePackage}
          >
            {packing ? (
              <>
                <Loader2 className="animate-spin" /> Packing {packProgress.done}/
                {packProgress.total} receipts…
              </>
            ) : (
              <>
                <Package /> Full accountant package (.zip)
              </>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            CSV + Excel + expense report PDF + tax summary PDF + every receipt photo, bundled
            together.
          </p>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              disabled={inRange.length === 0}
              onClick={() => exportCsv(inRange, projects, from, to)}
            >
              <Download className="size-3.5" /> CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={inRange.length === 0}
              onClick={() => exportXlsx(inRange, projects, from, to)}
            >
              <FileSpreadsheet className="size-3.5" /> Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={inRange.length === 0}
              onClick={() => exportExpensePdf(business, inRange, projects, from, to)}
            >
              <FileText className="size-3.5" /> PDF
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={inRange.length === 0}
            onClick={() => exportTaxSummaryPdf(business, inRange, projects, from, to)}
          >
            <FileText className="size-3.5" /> GST/HST summary only (PDF)
          </Button>
        </div>
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
  currency,
}: {
  title: string;
  rows: { label: string; value: number }[];
  total: number;
  currency: string | undefined;
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
                <span className="tabular-nums font-medium">{money(r.value, currency)}</span>
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
