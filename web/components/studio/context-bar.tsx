"use client";

import { MapPin } from "lucide-react";
import { Segmented } from "@/components/pricing/segmented";
import { usd } from "@/components/studio/shared";

const TRIGGERS = [4, 8, 12, 24] as const;
const PAYOUTS = [500, 1000, 2500, 5000, 10000] as const;

/** low —●— high : the indicative band as a compact bar (point marked). */
function RangeBar({ low, point, high }: { low: number; point: number; high: number }) {
  const span = Math.max(1, high - low);
  const frac = Math.min(1, Math.max(0, (point - low) / span));
  return (
    <div className="mt-2 flex items-center justify-end gap-2">
      <span className="text-muted-foreground text-xs tabular-nums">{usd(low)}</span>
      <div className="bg-muted relative h-1.5 w-32 rounded-full">
        <div
          className="bg-foreground/80 absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full"
          style={{ left: `calc(${frac * 100}% - 5px)` }}
        />
      </div>
      <span className="text-muted-foreground text-xs tabular-nums">{usd(high)}</span>
    </div>
  );
}

const ctl = "text-muted-foreground text-[10px] font-medium uppercase tracking-wider";

/** The deal anchor — location + controls beneath the address; the price stays top-right. */
export function ContextBar({
  county,
  state,
  address,
  regime,
  T,
  X,
  setT,
  setX,
  premium,
  band,
}: {
  county: string;
  state: string;
  address: string;
  regime: string | null;
  T: number;
  X: number;
  setT: (t: number) => void;
  setX: (x: number) => void;
  premium: number;
  band: { low: number; high: number } | null;
}) {
  return (
    <div className="bg-card mb-5 flex flex-wrap items-start justify-between gap-x-8 gap-y-4 rounded-lg border px-5 py-4 shadow-sm">
      {/* location + controls right under the address */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <MapPin className="text-muted-foreground size-3.5 shrink-0" />
          <span className="truncate">
            {county}, {state}
          </span>
          {regime && (
            <span className="border-border text-muted-foreground ml-1 rounded-full border px-2 py-0.5 text-[10px] font-normal">
              {regime}
            </span>
          )}
        </div>
        <div className="text-muted-foreground mt-0.5 truncate text-xs">{address}</div>

        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <span className={ctl}>Trigger</span>
            <Segmented options={TRIGGERS} value={T} onChange={setT} render={(v) => `${v}h`} />
          </div>
          <div className="flex items-center gap-2">
            <span className={ctl}>Payout</span>
            <Segmented options={PAYOUTS} value={X} onChange={setX} render={(v) => usd(v)} />
          </div>
        </div>
      </div>

      {/* the answer — stays top-right */}
      <div className="shrink-0 text-right">
        <div className={ctl}>Premium · indicative</div>
        <div className="flex items-baseline justify-end gap-1">
          <span className="text-4xl font-semibold tabular-nums leading-none">{usd(premium)}</span>
          <span className="text-muted-foreground text-sm">/ yr</span>
        </div>
        {band && <RangeBar low={band.low} point={premium} high={band.high} />}
      </div>
    </div>
  );
}
