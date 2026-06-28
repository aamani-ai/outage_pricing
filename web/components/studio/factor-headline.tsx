import { cn } from "@/components/ui/utils";
import { usd } from "@/components/studio/shared";

const MINUS = "−"; // typographic minus, not a hyphen
const signed = (n: number) => (n > 0 ? "+" : n < 0 ? MINUS : "");

function Tile({ label, value, unit, highlight }: { label: string; value: string; unit?: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-lg border px-3 py-2.5", highlight ? "border-primary bg-primary/5" : "border-border")}>
      <div className="text-foreground text-xl font-semibold tabular-nums">
        {value}
        {unit && <span className="text-muted-foreground text-sm font-normal"> {unit}</span>}
      </div>
      <div className="text-muted-foreground mt-0.5 text-[11px] leading-tight">{label}</div>
    </div>
  );
}

/**
 * The prominent factor headline — the multiplier shown major, alongside its % move and its EXACT
 * dollar effect on this annual premium (computed from the same compose numbers, never re-prosed).
 * One band for both Location and Forecast (communicate_to_share: define once).
 */
export function FactorHeadline({
  factor,
  movePct,
  moveLabel,
  dollar,
}: {
  factor: number;
  movePct: number;
  moveLabel: string;
  dollar: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Tile label="factor" value={`×${factor.toFixed(2)}`} highlight />
      <Tile label={moveLabel} value={`${signed(movePct)}${Math.abs(movePct)}%`} />
      <Tile label="effect on this premium" value={`${signed(dollar)}${usd(Math.abs(dollar))}`} unit="/yr" />
    </div>
  );
}
