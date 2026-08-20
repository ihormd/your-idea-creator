import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useProjects, useReceipts } from "@/lib/queries";
import { CATEGORIES, REVIEW_STATUSES, categoryLabel, formatDate, money, statusLabel } from "@/lib/domain";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/receipts")({
  head: () => ({
    meta: [
      { title: "Receipt vault — JobLedger" },
      { name: "description", content: "Search every receipt by vendor, project, category, status or date." },
      { property: "og:title", content: "Receipt vault — JobLedger" },
      { property: "og:description", content: "Every business receipt, searchable and accountant-ready." },
    ],
  }),
  component: ReceiptsLayout,
});

function ReceiptsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/receipts") return <Outlet />;
  return <ReceiptList />;
}

function ReceiptList() {
  const { user } = useAuth();
  const { data: receipts = [], isLoading } = useReceipts(user?.id);
  const { data: projects = [] } = useProjects(user?.id);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");

  const filtered = useMemo(() => {
    const nameOf = (id: string | null) => projects.find((p) => p.id === id)?.name ?? "";
    return receipts.filter((r) => {
      if (status !== "all" && r.review_status !== status) return false;
      if (category !== "all" && r.category !== category) return false;
      if (q) {
        const hay = `${r.vendor ?? ""} ${r.receipt_number ?? ""} ${nameOf(r.project_id)}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [receipts, status, category, q, projects]);

  const total = filtered.reduce((s, r) => s + Number(r.total ?? 0), 0);

  return (
    <AppShell title="Receipts" subtitle={`${filtered.length} receipts · ${money(total)}`}>
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search vendor, project or receipt #"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <Chips value={status} onChange={setStatus} options={[{ value: "all", label: "All statuses" }, ...REVIEW_STATUSES]} />
        <Chips value={category} onChange={setCategory} options={[{ value: "all", label: "All categories" }, ...CATEGORIES]} />

        {isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading receipts…</p>
        ) : filtered.length === 0 ? (
          <div className="panel p-8 text-center">
            <p className="font-medium">No receipts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Tap Scan to capture your first one.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((r) => {
              const projectName = projects.find((p) => p.id === r.project_id)?.name;
              return (
                <li key={r.id}>
                  <Link to="/receipts/$id" params={{ id: r.id }} className="panel flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.vendor || "Unknown vendor"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(r.receipt_date)} · {categoryLabel(r.category)}
                        {projectName ? ` · ${projectName}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{money(r.total, r.currency)}</p>
                      <span
                        className={cn(
                          "text-[11px] font-medium",
                          r.review_status === "needs_review" ? "text-accent" : "text-muted-foreground",
                        )}
                      >
                        {statusLabel(r.review_status)}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function Chips({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            value === o.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-surface text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
