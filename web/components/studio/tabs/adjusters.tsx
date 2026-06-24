"use client";

import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, type Status } from "@/components/ui/status-badge";
import { InfoHint } from "@/components/ui/info-hint";
import { AdjustmentsPanel } from "@/components/studio/adjustments-panel";
import { LocationDetail } from "@/components/studio/location-detail";
import type { Stack, StudioData } from "@/components/studio/shared";

/** the ONE canonical maturity string — identical everywhere (FactorRow · detail · waterfall · methodology). */
const SHADOW_NOTE = "shadow — validated CT/MA/RI only, not in the quoted premium";
const TERC_TAG: Record<string, string> = { rural: "rural", mid: "mid", urban: "urban — dense core" };

function FactorRow({ label, value, status, note }: { label: string; value: string; status: Status; note: string }) {
  return (
    <div className="border-border/60 flex items-center justify-between gap-3 border-b pb-3 text-sm last:border-0 last:pb-0">
      <span className="text-foreground/80 min-w-0">
        {label}
        <span className="text-muted-foreground/60 text-xs"> · {note}</span>
      </span>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-muted-foreground tabular-nums">{value}</span>
        <StatusBadge status={status} />
      </div>
    </div>
  );
}

/** Location is a FACTOR (not a diagnostic tab): the one-line read up top, click to open the detail. */
function LocationFactor({ data, stack, T }: { data: StudioData; stack: NonNullable<Stack>; T: number }) {
  const loc = data.location;
  const value = `×${stack.location.relativity.toFixed(2)}`;
  if (!loc) {
    return (
      <FactorRow
        label="Location (within-county)"
        value={value}
        status={stack.location.status}
        note="no within-county data here — county average"
      />
    );
  }
  const tag =
    loc.guardrail.triggered && loc.guardrail.type === "A"
      ? "urban — built-up core (guardrail)"
      : TERC_TAG[loc.tercile] ?? loc.tercile;
  return (
    <details className="group border-border/60 border-b pb-3 last:border-0 last:pb-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm [&::-webkit-details-marker]:hidden">
        <span className="text-foreground/80 hover:text-foreground flex min-w-0 items-center gap-1 transition-colors">
          Location (within-county)
          <span className="text-muted-foreground/60 text-xs"> · {tag}</span>
          <ChevronDown className="text-muted-foreground/50 size-3.5 shrink-0 transition-transform group-open:rotate-180" />
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="text-muted-foreground tabular-nums">{value}</span>
          <StatusBadge status={stack.location.status} />
        </span>
      </summary>
      <p className="text-muted-foreground/60 mt-0.5 text-xs">{SHADOW_NOTE}</p>
      <div className="mt-3">
        <LocationDetail loc={loc} T={T} county={`${data.county.name} County`} />
      </div>
    </details>
  );
}

export function AdjustersTab({ data, stack, T }: { data: StudioData; stack: NonNullable<Stack>; T: number }) {
  return (
    <div className="space-y-5">
      {/* model-driven factors — outputs, not levers */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-sm">Model-driven factors</CardTitle>
              <CardDescription>location &amp; forward come from the models — not hand-set here</CardDescription>
            </div>
            <InfoHint title="Why these aren’t sliders">
              <p>
                The <b>location</b> (within-county) and <b>forward</b> (climate + grid) factors are produced by
                statistical models, so they read here as <b>outputs</b>, not levers.
              </p>
              <p>
                Click <b>Location</b> to open where this address sits in its county, the on-demand commercial-core
                guardrail, and the evidence. Forward is a framed placeholder until a signal is wired.
              </p>
            </InfoHint>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <LocationFactor data={data} stack={stack} T={T} />
          <FactorRow
            label="Forward (climate + grid)"
            value={`×${stack.forward.factor.toFixed(2)}`}
            status={stack.forward.status}
            note={
              stack.forward.status === "placeholder" ? "placeholder — no signal wired yet (shown at 1.00×)" : "modeled"
            }
          />
        </CardContent>
      </Card>

      {/* the legit underwriter lever */}
      <AdjustmentsPanel fips={data.fips} />
    </div>
  );
}
