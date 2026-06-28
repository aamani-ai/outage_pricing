import type { ReactNode } from "react";
import { InfoHint } from "@/components/ui/info-hint";
import { cn } from "@/components/ui/utils";

/**
 * A KPI tile with a built-in info button. Every KPI must explain itself in plain language
 * (see feedback: an "i" on every metric) — so `hint` is a first-class, expected prop.
 */
export function KpiTile({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border px-3 py-2.5", highlight ? "border-primary bg-primary/5" : "border-border")}>
      <div className="text-foreground truncate text-lg font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 flex items-center justify-between gap-1">
        <span className="text-muted-foreground text-[11px] leading-tight">{label}</span>
        {hint && <InfoHint title={label} className="-mr-1.5 size-5">{hint}</InfoHint>}
      </div>
    </div>
  );
}
