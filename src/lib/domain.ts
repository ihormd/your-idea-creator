import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Business = Database["public"]["Tables"]["businesses"]["Row"];
export type Membership = Database["public"]["Tables"]["memberships"]["Row"];
export type MembershipRole = Database["public"]["Enums"]["membership_role"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type Receipt = Database["public"]["Tables"]["receipts"]["Row"];
export type ExpenseCategory = Database["public"]["Enums"]["expense_category"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type ReviewStatus = Database["public"]["Enums"]["review_status"];
export type ProjectStatus = Database["public"]["Enums"]["project_status"];
export type AppMode = Database["public"]["Enums"]["app_mode"];

export const ROLE_LABELS: Record<MembershipRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  accountant: "Accountant",
  read_only: "Read only",
};
// Accountant can view everything and correct categorization on receipts,
// but doesn't manage projects/budgets or invite other people — matches the
// "sees reports & receipts, can't touch what isn't theirs to touch" ask.
export const canManageBusiness = (role: MembershipRole | null | undefined) =>
  role === "owner" || role === "admin";

export const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "materials", label: "Materials" },
  { value: "fuel", label: "Fuel" },
  { value: "tools", label: "Tools" },
  { value: "equipment", label: "Equipment" },
  { value: "subcontractors", label: "Subcontractors" },
  { value: "permits", label: "Permits & Fees" },
  { value: "travel", label: "Travel" },
  { value: "meals", label: "Meals" },
  { value: "other", label: "Other" },
];

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "credit_card", label: "Credit card" },
  { value: "debit_card", label: "Debit card" },
  { value: "etransfer", label: "e-Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

export const REVIEW_STATUSES: { value: ReviewStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "needs_review", label: "Needs review" },
  { value: "approved", label: "Approved" },
  { value: "exported", label: "Exported" },
];

export const categoryLabel = (v: ExpenseCategory) =>
  CATEGORIES.find((c) => c.value === v)?.label ?? v;
export const statusLabel = (v: ReviewStatus) =>
  REVIEW_STATUSES.find((c) => c.value === v)?.label ?? v;
export const paymentLabel = (v: PaymentMethod | null) =>
  v ? (PAYMENT_METHODS.find((c) => c.value === v)?.label ?? v) : "—";

export function money(value: number | string | null | undefined, currency = "CAD") {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function num(value: number | string | null | undefined) {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return Number.isFinite(n) ? Number(n) : 0;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

/** Job-costing math (approved costs only, per specification). */
export function projectMetrics(project: Project, receipts: Receipt[]) {
  const approved = receipts.filter(
    (r) =>
      r.project_id === project.id &&
      (r.review_status === "approved" || r.review_status === "exported"),
  );
  const actualCost = approved.reduce((sum, r) => sum + num(r.total), 0);
  const costBudget = num(project.cost_budget);
  const revenue = num(project.revenue);
  const remaining = costBudget - actualCost;
  const grossProfit = revenue - actualCost;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const budgetUsedPct = costBudget > 0 ? (actualCost / costBudget) * 100 : 0;
  return {
    actualCost,
    costBudget,
    revenue,
    remaining,
    grossProfit,
    grossMargin,
    budgetUsedPct,
    count: approved.length,
  };
}

export function validateReceipt(
  r: {
    subtotal?: number | null;
    gst_hst?: number | null;
    other_tax?: number | null;
    total?: number | null;
    receipt_date?: string | null;
    vendor?: string | null;
    project_id?: string | null;
  },
  mode: AppMode = "expense",
) {
  const warnings: string[] = [];
  const subtotal = num(r.subtotal);
  const tax = num(r.gst_hst) + num(r.other_tax);
  const total = num(r.total);
  if (subtotal > 0 && Math.abs(subtotal + tax - total) > 0.02) {
    warnings.push("Totals do not add up: subtotal + tax does not equal total.");
  }
  if (total > 0 && num(r.gst_hst) === 0) warnings.push("No GST/HST captured — check the receipt.");
  if (!r.vendor) warnings.push("Vendor is missing.");
  if (!r.receipt_date) warnings.push("Receipt date is missing.");
  if (mode === "job" && !r.project_id) warnings.push("No project assigned.");
  return warnings;
}

export function confidenceOf(conf: unknown, field: string): number | null {
  if (!conf || typeof conf !== "object") return null;
  const v = (conf as Record<string, unknown>)[field];
  return typeof v === "number" ? v : null;
}
