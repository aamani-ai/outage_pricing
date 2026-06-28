"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { money } from "@/lib/analytics/format";
import { cn } from "@/components/ui/utils";

export interface PremiumFilter {
  min: number | null;
  max: number | null;
  includeExcluded: boolean;
}

export const EMPTY_FILTER: PremiumFilter = { min: null, max: null, includeExcluded: false };

const PRESETS: { label: string; min: number | null; max: number | null }[] = [
  { label: "all", min: null, max: null },
  { label: "< $200", min: null, max: 200 },
  { label: "$200–$1k", min: 200, max: 1000 },
  { label: "$1k–$5k", min: 1000, max: 5000 },
  { label: "> $5k", min: 5000, max: null },
];

const STEPS = 100;
function logMap(lo: number, hi: number) {
  const lmin = Math.log10(Math.max(lo, 1));
  const lmax = Math.log10(Math.max(hi, Math.max(lo, 1) * 1.01));
  const span = lmax - lmin || 1;
  return {
    toPremium: (pos: number) => Math.round(Math.pow(10, lmin + (pos / STEPS) * span)),
    toPos: (v: number) => Math.round(((Math.log10(Math.max(v, Math.max(lo, 1))) - lmin) / span) * STEPS),
  };
}

/** Premium filter — drag the range (or tap a preset); matching counties light up on the map, the rest dim. */
export function FilterPanel({
  value,
  onChange,
  domain,
  matchCount,
  matchMedian,
}: {
  value: PremiumFilter;
  onChange: (f: PremiumFilter) => void;
  domain: { lo: number; hi: number };
  matchCount: number;
  matchMedian: number | null;
}) {
  const set = (patch: Partial<PremiumFilter>) => onChange({ ...value, ...patch });
  const { toPremium, toPos } = logMap(domain.lo, domain.hi);
  const clamp = (n: number) => Math.min(STEPS, Math.max(0, n));
  const minPos = value.min == null ? 0 : clamp(toPos(value.min));
  const maxPos = value.max == null ? STEPS : clamp(toPos(value.max));

  const onMin = (pos: number) => {
    const p = Math.min(pos, maxPos);
    set({ min: p <= 0 ? null : toPremium(p) });
  };
  const onMax = (pos: number) => {
    const p = Math.max(pos, minPos);
    set({ max: p >= STEPS ? null : toPremium(p) });
  };
  const isActivePreset = (pr: (typeof PRESETS)[number]) => pr.min === value.min && pr.max === value.max;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm">Filter the book</CardTitle>
          <InfoHint title="Filter & explore">
            <p>
              Drag the range (or tap a preset) — matching counties light up on the map and the rest dim. A fast way to ask
              &ldquo;where are the cheap / expensive ones?&rdquo; or to spot-check a band.
            </p>
          </InfoHint>
        </div>
      </CardHeader>
      <CardContent className="space-y-3.5">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => set({ min: p.min, max: p.max })}
              className={cn(
                "rounded-md border px-2 py-1 text-xs transition-colors",
                isActivePreset(p) ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* dual-range premium slider (log scale) */}
        <div>
          <div className="text-muted-foreground mb-1.5 flex justify-between text-xs tabular-nums">
            <span>{value.min == null ? money(domain.lo) : money(value.min)}</span>
            <span>{value.max == null ? `${money(domain.hi)}+` : money(value.max)}</span>
          </div>
          <div className="relative h-4">
            <div className="bg-muted absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full" />
            <div
              className="bg-primary absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
              style={{ left: `${minPos}%`, right: `${100 - maxPos}%` }}
            />
            <input
              type="range"
              min={0}
              max={STEPS}
              value={minPos}
              onChange={(e) => onMin(Number(e.target.value))}
              aria-label="minimum premium"
              className="dual-range absolute inset-0 h-4 w-full"
              style={{ zIndex: minPos > STEPS - 6 ? 5 : 3 }}
            />
            <input
              type="range"
              min={0}
              max={STEPS}
              value={maxPos}
              onChange={(e) => onMax(Number(e.target.value))}
              aria-label="maximum premium"
              className="dual-range absolute inset-0 h-4 w-full"
              style={{ zIndex: 4 }}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.includeExcluded}
            onChange={(e) => set({ includeExcluded: e.target.checked })}
            className="accent-primary size-4"
          />
          <span className="text-muted-foreground">include excluded counties</span>
        </label>

        <div className="border-border/60 border-t pt-2 text-sm">
          <span className="font-semibold tabular-nums">{matchCount.toLocaleString()}</span>{" "}
          <span className="text-muted-foreground">counties match</span>
          {matchMedian != null && <span className="text-muted-foreground"> · median {money(matchMedian)}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
