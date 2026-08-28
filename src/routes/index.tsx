import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, ReceiptText } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Progress } from "@/components/ui/progress";
import { useBusiness } from "@/lib/business";
import { useProjects, useReceipts } from "@/lib/queries";
import { categoryLabel, formatDate, money, num, projectMetrics } from "@/lib/domain";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JobLedger — AI receipts & job costing" },
      {
        name: "description",
        content:
          "Scan receipts, capture GST/HST automatically and see live job profitability. Built for Canadian contractors and small businesses.",
      },
      { property: "og:title", content: "JobLedger — AI receipts & job costing" },
      {
        property: "og:description",
        content: "Snap a receipt, know your job costs, keep your accountant happy.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { business, businessId } = useBusiness();
  const { data: receipts = [] } = useReceipts(businessId);
  const { data: projects = [] } = useProjects(businessId);

  const now = new Date();
  const monthReceipts = receipts.filter((r) => {
    if (!r.receipt_date) return false;
    const d = new Date(`${r.receipt_date}T00:00:00`);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const monthTotal = monthReceipts.reduce((s, r) => s + num(r.total), 0);
  const monthTax = monthReceipts.reduce((s, r) => s + num(r.gst_hst), 0);
  const needsReview = receipts.filter((r) => r.review_status === "needs_review");
  const activeProjects = projects.filter((p) => p.status === "active");
  const jobMode = business?.mode !== "expense";

  return (
    <AppShell
      title={`Hi${business?.name ? `, ${business.name}` : ""}`}
      subtitle="Here's this month."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Spend this month
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{money(monthTotal)}</p>
            <p className="text-xs text-muted-foreground">{monthReceipts.length} receipts</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              GST/HST captured
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-primary">
              {money(monthTax)}
            </p>
            <p className="text-xs text-muted-foreground">Potential input tax credits</p>
          </div>
        </div>

        {needsReview.length > 0 ? (
          <Link
            to="/receipts"
            className="panel flex items-center gap-3 border-accent/40 bg-accent/10 p-4"
          >
            <AlertTriangle className="size-5 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{needsReview.length} receipts need review</p>
              <p className="text-xs text-muted-foreground">
                Approve them so they count toward your costs.
              </p>
            </div>
            <ArrowRight className="size-4 text-muted-foreground" />
          </Link>
        ) : null}

        {jobMode ? (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Active jobs</p>
              <Link to="/projects" className="text-xs text-primary">
                View all
              </Link>
            </div>
            {activeProjects.length === 0 ? (
              <Link
                to="/projects"
                className="panel block p-6 text-center text-sm text-muted-foreground"
              >
                Add your first project to track profitability.
              </Link>
            ) : (
              <ul className="space-y-2">
                {activeProjects.slice(0, 4).map((p) => {
                  const m = projectMetrics(p, receipts);
                  const critical =
                    m.costBudget > 0 && m.budgetUsedPct >= (business?.budget_critical_pct ?? 100);
                  const warn =
                    m.costBudget > 0 && m.budgetUsedPct >= (business?.budget_warn_pct ?? 80);
                  return (
                    <li key={p.id}>
                      <Link to="/projects/$id" params={{ id: p.id }} className="panel block p-4">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="truncate font-medium">{p.name}</p>
                          <p className="shrink-0 text-sm font-semibold tabular-nums">
                            {money(m.actualCost)}
                          </p>
                        </div>
                        <Progress className="mt-3" value={Math.min(m.budgetUsedPct, 100)} />
                        <p
                          className={
                            critical
                              ? "mt-2 text-xs font-medium text-destructive"
                              : warn
                                ? "mt-2 text-xs font-medium text-accent"
                                : "mt-2 text-xs text-muted-foreground"
                          }
                        >
                          {m.costBudget > 0
                            ? `${m.budgetUsedPct.toFixed(0)}% of ${money(m.costBudget)} budget`
                            : "No budget set"}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Recent receipts</p>
            <Link to="/receipts" className="text-xs text-primary">
              View all
            </Link>
          </div>
          {receipts.length === 0 ? (
            <div className="panel p-8 text-center">
              <ReceiptText className="mx-auto mb-2 size-8 text-muted-foreground" />
              <p className="font-medium">Nothing captured yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tap the orange Scan button to add a receipt.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {receipts.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <Link
                    to="/receipts/$id"
                    params={{ id: r.id }}
                    className="panel flex items-center gap-3 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.vendor || "Unknown vendor"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(r.receipt_date)} · {categoryLabel(r.category)}
                      </p>
                    </div>
                    <p className="font-semibold tabular-nums">{money(r.total, r.currency)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
