import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBusiness } from "@/lib/business";
import { useProjects, useReceipts } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { categoryLabel, formatDate, money, projectMetrics, type ProjectStatus } from "@/lib/domain";

export const Route = createFileRoute("/projects/$id")({
  head: () => ({
    meta: [
      { title: "Project costs — JobLedger" },
      {
        name: "description",
        content: "Budget, actual cost, gross profit and every receipt tied to this job.",
      },
      { property: "og:title", content: "Project costs — JobLedger" },
      {
        property: "og:description",
        content: "See job profitability while the job is still running.",
      },
    ],
  }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { id } = useParams({ from: "/projects/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { businessId, role } = useBusiness();
  const canManage = role !== "accountant" && role !== "read_only";
  const { data: projects = [], isLoading } = useProjects(businessId);
  const { data: receipts = [] } = useReceipts(businessId);
  const project = projects.find((p) => p.id === id);

  const [form, setForm] = useState({
    name: "",
    customer: "",
    cost_budget: "",
    revenue: "",
    status: "active",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!project) return;
    setForm({
      name: project.name,
      customer: project.customer ?? "",
      cost_budget: String(project.cost_budget ?? 0),
      revenue: String(project.revenue ?? 0),
      status: project.status,
    });
  }, [project?.id]);

  if (isLoading) {
    return (
      <AppShell title="Project">
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }
  if (!project) {
    return (
      <AppShell title="Project">
        <p className="py-10 text-center text-sm text-muted-foreground">
          This project no longer exists.
        </p>
      </AppShell>
    );
  }

  const m = projectMetrics(project, receipts);
  const projectReceipts = receipts.filter((r) => r.project_id === project.id);

  async function save() {
    setBusy(true);
    const { error } = await supabase
      .from("projects")
      .update({
        name: form.name.trim(),
        customer: form.customer.trim() || null,
        cost_budget: Number(form.cost_budget) || 0,
        revenue: Number(form.revenue) || 0,
        status: form.status as ProjectStatus,
      })
      .eq("id", id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["projects"] });
    toast.success("Project updated.");
  }

  async function remove() {
    setBusy(true);
    const { error } = await supabase.from("projects").delete().eq("id", id);
    setBusy(false);
    if (error) {
      toast.error("Unassign this project's receipts first.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["projects"] });
    navigate({ to: "/projects" });
  }

  return (
    <AppShell title={project.name} subtitle={project.customer ?? "No customer"}>
      <div className="space-y-4">
        <div className="panel p-4">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Actual cost" value={money(m.actualCost)} />
            <Stat label="Cost budget" value={money(m.costBudget)} />
            <Stat
              label="Remaining"
              value={money(m.remaining)}
              tone={m.remaining < 0 ? "bad" : "good"}
            />
            <Stat
              label="Gross profit"
              value={money(m.grossProfit)}
              tone={m.grossProfit < 0 ? "bad" : "good"}
              hint={m.revenue > 0 ? `${m.grossMargin.toFixed(1)}% margin` : undefined}
            />
          </div>
          <Progress className="mt-4" value={Math.min(m.budgetUsedPct, 100)} />
          <p className="mt-2 text-xs text-muted-foreground">
            {m.count} approved receipts ·{" "}
            {m.costBudget > 0 ? `${m.budgetUsedPct.toFixed(0)}% of budget used` : "no budget set"}
          </p>
        </div>

        <div className="panel space-y-3 p-4">
          <p className="text-sm font-medium">Project details</p>
          <div className="space-y-1.5">
            <Label htmlFor="pname">Name</Label>
            <Input
              id="pname"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pcust">Customer</Label>
            <Input
              id="pcust"
              value={form.customer}
              onChange={(e) => setForm({ ...form, customer: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pbud">Cost budget</Label>
              <Input
                id="pbud"
                inputMode="decimal"
                value={form.cost_budget}
                onChange={(e) => setForm({ ...form, cost_budget: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prev">Revenue</Label>
              <Input
                id="prev"
                inputMode="decimal"
                value={form.revenue}
                onChange={(e) => setForm({ ...form, revenue: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-1">
            <Button className="flex-1" disabled={busy || !canManage} onClick={save}>
              Save changes
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete project"
              disabled={busy || !canManage}
              onClick={remove}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Receipts on this job</p>
          {projectReceipts.length === 0 ? (
            <p className="panel p-6 text-center text-sm text-muted-foreground">
              No receipts assigned yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {projectReceipts.map((r) => (
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
        </div>
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: "good" | "bad" | undefined;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          tone === "bad"
            ? "text-lg font-semibold text-destructive"
            : tone === "good"
              ? "text-lg font-semibold text-primary"
              : "text-lg font-semibold"
        }
      >
        {value}
      </p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
