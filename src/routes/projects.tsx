import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useBusiness } from "@/lib/business";
import { useProjects, useReceipts } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { money, projectMetrics } from "@/lib/domain";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects — JobLedger" },
      {
        name: "description",
        content: "Track budget, actual cost and gross margin for every job you run.",
      },
      { property: "og:title", content: "Projects — JobLedger" },
      { property: "og:description", content: "Real-time job costing from your receipts." },
    ],
  }),
  component: ProjectsLayout,
});

function ProjectsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/projects") return <Outlet />;
  return <ProjectList />;
}

function ProjectList() {
  const { businessId, role } = useBusiness();
  const qc = useQueryClient();
  const { data: projects = [], isLoading } = useProjects(businessId);
  const { data: receipts = [] } = useReceipts(businessId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", customer: "", cost_budget: "", revenue: "" });
  const [busy, setBusy] = useState(false);
  const canManage = role !== "accountant" && role !== "read_only";

  async function create() {
    if (!form.name.trim() || !businessId) {
      toast.error("Give the project a name.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("projects").insert({
      business_id: businessId,
      name: form.name.trim(),
      customer: form.customer.trim() || null,
      cost_budget: Number(form.cost_budget) || 0,
      revenue: Number(form.revenue) || 0,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["projects"] });
    setForm({ name: "", customer: "", cost_budget: "", revenue: "" });
    setOpen(false);
  }

  return (
    <AppShell
      title="Projects"
      subtitle={`${projects.length} tracked`}
      action={
        canManage ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus /> New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New project</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="np">Project name</Label>
                  <Input
                    id="np"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nc">Customer</Label>
                  <Input
                    id="nc"
                    value={form.customer}
                    onChange={(e) => setForm({ ...form, customer: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="nb">Cost budget</Label>
                    <Input
                      id="nb"
                      inputMode="decimal"
                      value={form.cost_budget}
                      onChange={(e) => setForm({ ...form, cost_budget: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nr">Revenue</Label>
                    <Input
                      id="nr"
                      inputMode="decimal"
                      value={form.revenue}
                      onChange={(e) => setForm({ ...form, revenue: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button disabled={busy} onClick={create}>
                  Create project
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null
      }
    >
      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading projects…</p>
      ) : projects.length === 0 ? (
        <div className="panel p-8 text-center">
          <p className="font-medium">No projects yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a job to start tracking costs against a budget.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => {
            const m = projectMetrics(p, receipts);
            return (
              <li key={p.id}>
                <Link to="/projects/$id" params={{ id: p.id }} className="panel block p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.customer || "No customer"}
                      </p>
                    </div>
                    <p className="shrink-0 text-right text-sm font-semibold tabular-nums">
                      {money(m.actualCost)}
                      <span className="block text-xs font-normal text-muted-foreground">
                        of {money(m.costBudget)}
                      </span>
                    </p>
                  </div>
                  <Progress className="mt-3" value={Math.min(m.budgetUsedPct, 100)} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {m.costBudget > 0
                      ? `${m.budgetUsedPct.toFixed(0)}% of budget used`
                      : "No budget set"}{" "}
                    · {m.revenue > 0 ? `${m.grossMargin.toFixed(0)}% margin` : "No revenue set"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
