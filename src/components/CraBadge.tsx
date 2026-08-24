import { AlertTriangle, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Confidence badge for Canadian tax capture. Verified = we have a vendor, a date,
 * a total and a GST/HST amount that reconciles with the subtotal.
 */
export function craStatus(r: {
  vendor?: string | null;
  receipt_date?: string | null;
  total?: number | null;
  subtotal?: number | null;
  gst_hst?: number | null;
  other_tax?: number | null;
}) {
  const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const tax = n(r.gst_hst) + n(r.other_tax);
  const reconciles = n(r.subtotal) === 0 || Math.abs(n(r.subtotal) + tax - n(r.total)) <= 0.02;
  return Boolean(r.vendor) && Boolean(r.receipt_date) && n(r.total) > 0 && n(r.gst_hst) > 0 && reconciles;
}

export function CraBadge({ verified, className }: { verified: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium",
        verified
          ? "border-success/40 bg-success/10 text-success"
          : "border-warning/50 bg-warning/15 text-warning-foreground",
        className,
      )}
    >
      {verified ? <BadgeCheck className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
      <span>{verified ? "Tax verified for CRA compliance" : "Tax details need a quick check"}</span>
    </div>
  );
}
