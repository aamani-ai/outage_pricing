"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { InfoHint } from "@/components/ui/info-hint";
import { FactorHeadline } from "@/components/studio/factor-headline";
import { ForwardDetail } from "@/components/studio/forward-detail";
import type { Stack, StudioData } from "@/components/studio/shared";

/**
 * Forecast — the forward-regime FACTOR (Step 5): where the county's risk is heading. Its own open
 * section: a prominent headline (the factor × its dollar effect), then a scannable read + the annual
 * series. Statistical today (the county's own outage history); climate + grid layer on later.
 * (Internal keys stay `forward`; the UI label is "Forecast".)
 */
export function ForecastTab({ data, stack, T, X }: { data: StudioData; stack: NonNullable<Stack>; T: number; X: number }) {
  const fwd = data.forward;
  const f = stack.forward.factor;
  const baseLam = data.county.T[String(T)]?.lam ?? 0;
  // exact dollar effect of THIS factor on the annual premium (vs holding it at ×1.00)
  const withoutFwd = (baseLam * stack.location.relativity * X) / stack.denom;
  const dollar = stack.premium.point - withoutFwd;
  const movePct = Math.round((f - 1) * 100);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">Forecast (stat + climate + grid)</CardTitle>
            <CardDescription>where the county total is heading vs its long-run mean — moves the level, not the spread</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge status={stack.forward.status} />
            <InfoHint title="Why this is a factor, not a slider">
              <p>
                The <b>forecast</b> factor is produced by a statistical model — the county&rsquo;s own outage history
                forecasting next year vs its long-run mean — so it reads as an <b>output</b>, not a lever. One-directional
                (uplift or hold) and credibility-shrunk.
              </p>
              <p>Climate + grid challengers layer on later; they must beat this statistical baseline before they activate.</p>
            </InfoHint>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <FactorHeadline factor={f} movePct={movePct} moveLabel="vs long-run mean" dollar={dollar} />
        {fwd ? (
          <ForwardDetail fwd={fwd} studio={data.studio} T={T} county={`${data.county.name} County`} />
        ) : (
          <p className="text-muted-foreground text-sm">
            No forward model for this county — the forecast holds at the county average (×1.00).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
