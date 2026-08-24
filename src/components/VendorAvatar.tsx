import {
  Car,
  Fuel,
  Hammer,
  MapPinned,
  Package,
  Receipt,
  Stamp,
  Truck,
  Utensils,
  Wrench,
} from "lucide-react";
import type { ExpenseCategory } from "@/lib/domain";
import { cn } from "@/lib/utils";

const ICONS: Record<ExpenseCategory, typeof Receipt> = {
  materials: Package,
  fuel: Fuel,
  tools: Hammer,
  equipment: Wrench,
  subcontractors: Truck,
  permits: Stamp,
  travel: MapPinned,
  meals: Utensils,
  other: Receipt,
};

const TONES: Record<ExpenseCategory, string> = {
  materials: "bg-primary/10 text-primary",
  fuel: "bg-accent/15 text-accent",
  tools: "bg-chart-5/15 text-chart-5",
  equipment: "bg-chart-5/15 text-chart-5",
  subcontractors: "bg-success/15 text-success",
  permits: "bg-warning/20 text-warning-foreground",
  travel: "bg-chart-5/15 text-chart-5",
  meals: "bg-warning/20 text-warning-foreground",
  other: "bg-muted text-muted-foreground",
};

/** Friendly category glyph shown beside a vendor name in lists. */
export function VendorAvatar({
  category,
  className,
}: {
  category: ExpenseCategory;
  className?: string;
}) {
  const Icon = ICONS[category] ?? Receipt;
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl",
        TONES[category] ?? TONES.other,
        className,
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}

export { Car };
