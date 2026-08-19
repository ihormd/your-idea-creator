import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Briefcase, ReceiptText } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useProfile, useUpdateProfile } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { AppMode } from "@/lib/domain";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your business — JobLedger" },
      { name: "description", content: "Tell JobLedger about your business and pick job costing or simple expense tracking." },
      { property: "og:title", content: "Set up your business — JobLedger" },
      { property: "og:description", content: "Choose job costing or expense tracking and start scanning receipts." },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const update = useUpdateProfile(user?.id);

  const [businessName, setBusinessName] = useState("");
  const [mode, setMode] = useState<AppMode>("job");
  const [accounting, setAccounting] = useState("none");
  const [projectName, setProjectName] = useState("");
  const [customer, setCustomer] = useState("");
  const [costBudget, setCostBudget] = useState("");
  const [revenue, setRevenue] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (profile?.business_name) setBusinessName(profile.business_name);
  }, [profile?.business_name]);

  async function finish() {
    if (!businessName.trim()) {
      toast.error("Add your business name first.");
      return;
    }
    setBusy(true);
    try {
      await update.mutateAsync({
        business_name: businessName.trim(),
        mode,
        accounting_software: accounting,
        onboarded: true,
      });
      if (mode === "job" && projectName.trim()) {
        const { error } = await supabase.from("projects").insert({
          user_id: user!.id,
          name: projectName.trim(),
          customer: customer.trim() || null,
          cost_budget: Number(costBudget) || 0,
          revenue: Number(revenue) || 0,
        });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your setup.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Set up your business</h1>
      <p className="mt-1 text-sm text-muted-foreground">Two minutes now saves hours at tax time.</p>

      <div className="panel mt-6 space-y-5 p-5">
        <div className="space-y-1.5">
          <Label htmlFor="bn">Business name</Label>
          <Input id="bn" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Northside Renovations" />
        </div>

        <div className="space-y-2">
          <Label>How do you work?</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <ModeCard
              active={mode === "job"}
              onClick={() => setMode("job")}
              icon={<Briefcase className="size-5" />}
              title="Job mode"
              text="Track costs, budgets and profit per project."
            />
            <ModeCard
              active={mode === "expense"}
              onClick={() => setMode("expense")}
              icon={<ReceiptText className="size-5" />}
              title="Expense mode"
              text="Store receipts and track business expenses."
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Accounting software</Label>
          <div className="flex flex-wrap gap-2">
            {[
              { v: "none", l: "None" },
              { v: "quickbooks", l: "QuickBooks Online" },
              { v: "xero", l: "Xero" },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setAccounting(o.v)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  accounting === o.v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface",
                )}
              >
                {o.l}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Sync is on the roadmap — exports work today.</p>
        </div>

        {mode === "job" ? (
          <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
            <p className="text-sm font-medium">Create your first project (optional)</p>
            <div className="space-y-1.5">
              <Label htmlFor="pn">Project name</Label>
              <Input id="pn" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Kitchen remodel — 42 Elm St" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu">Customer</Label>
              <Input id="cu" value={customer} onChange={(e) => setCustomer(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cb">Cost budget</Label>
                <Input id="cb" inputMode="decimal" value={costBudget} onChange={(e) => setCostBudget(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rv">Contract revenue</Label>
                <Input id="rv" inputMode="decimal" value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="0.00" />
              </div>
            </div>
          </div>
        ) : null}

        <Button className="w-full" disabled={busy} onClick={finish}>
          Start scanning receipts
        </Button>
      </div>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  text,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 text-left transition-colors",
        active ? "border-primary bg-secondary" : "border-border bg-surface hover:border-primary/40",
      )}
    >
      <div className={cn("mb-2 flex size-9 items-center justify-center rounded-lg", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
        {icon}
      </div>
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </button>
  );
}
