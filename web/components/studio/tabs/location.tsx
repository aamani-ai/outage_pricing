"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { InfoHint } from "@/components/ui/info-hint";
import { FactorHeadline } from "@/components/studio/factor-headline";
import { LocationDetail } from "@/components/studio/location-detail";
import type { Stack, StudioData } from "@/components/studio/shared";

/**
 * Location — the within-county basis-alignment FACTOR (Step 4). Its own open section: a prominent
 * headline (the factor × its dollar effect), then a scannable read + the gradient chart. Model
 * output, not a lever. (Reserve "basis risk" for trigger-vs-loss.)
 */
export function LocationTab({ data, stack, T, X }: { data: StudioData; stack: NonNullable<Stack>; T: number; X: number }) {
  const loc = data.location;
  const relF = stack.location.relativity;
  const baseLam = data.county.T[String(T)]?.lam ?? 0;
  // exact dollar effect of THIS factor on the annual premium (vs holding it at ×1.00)
  const withoutLoc = (baseLam * stack.forward.factor * X) / stack.denom;
  const dollar = stack.premium.point - withoutLoc;
  const movePct = Math.round((relF - 1) * 100);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">Location (within-county)</CardTitle>
            <CardDescription>where in the county the address sits — redistributes risk, never the county total</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge status={stack.location.status} />
            <InfoHint title="Why this is a factor, not a slider">
              <p>
                The <b>location</b> factor is produced by a statistical model (within-county density), so it reads as an{" "}
                <b>output</b>, not a lever. It is mean-1 — it moves risk between addresses inside a county but never changes
                the county total.
              </p>
              <p>This is basis <i>alignment</i> (matching the rate to the spot), not basis <i>risk</i> (trigger vs loss).</p>
            </InfoHint>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <FactorHeadline factor={relF} movePct={movePct} moveLabel="vs county average" dollar={dollar} />
        {loc ? (
          <LocationDetail loc={loc} T={T} county={`${data.county.name} County`} />
        ) : (
          <p className="text-muted-foreground text-sm">
            No within-county data here — this address prices at the county average (×1.00).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
