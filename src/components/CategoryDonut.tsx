import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { money } from "@/lib/domain";

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export type DonutSlice = { label: string; value: number };

/** Compact donut with a centred total, used on the cash-flow report. */
export function CategoryDonut({
  title,
  data,
  emptyLabel = "Nothing yet",
}: {
  title: string;
  data: DonutSlice[];
  emptyLabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="panel p-4">
      <p className="text-sm font-medium">{title}</p>
      {data.length === 0 || total === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <>
          <div className="relative h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="92%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.map((d, i) => (
                    <Cell key={d.label} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number | string) => money(Number(v))}
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "0.75rem",
                    color: "var(--color-popover-foreground)",
                    fontSize: "0.8rem",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
              <p className="metric text-lg font-semibold">{money(total)}</p>
            </div>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {data.map((d, i) => (
              <li key={d.label} className="flex items-center gap-2 text-xs">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: COLORS[i % COLORS.length] }}
                  aria-hidden
                />
                <span className="truncate text-muted-foreground">{d.label}</span>
                <span className="ml-auto metric font-medium">{money(d.value)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
