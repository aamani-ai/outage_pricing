"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, type Status } from "@/components/ui/status-badge";
import { InfoHint } from "@/components/ui/info-hint";
import { AdjustmentsPanel } from "@/components/studio/adjustments-panel";
import type { Stack, StudioData } from "@/components/studio/shared";

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

export function AdjustersTab({ data, stack }: { data: StudioData; stack: NonNullable<Stack> }) {
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
                Overriding a model value (with a written reason) is coming — it will sit on each factor below and be
                clearly flagged as an override, so it never gets confused with the model&rsquo;s own number.
              </p>
            </InfoHint>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <FactorRow
            label="Location (within-county)"
            value={`×${stack.location.relativity.toFixed(2)}`}
            status={stack.location.status}
            note={
              stack.location.status === "placeholder"
                ? "shadow — validated CT/MA/RI only, not in the price yet"
                : "modeled"
            }
          />
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
