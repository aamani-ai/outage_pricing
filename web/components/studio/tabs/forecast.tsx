"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { InfoHint } from "@/components/ui/info-hint";
import { FactorHeadline } from "@/components/studio/factor-headline";
import { ForwardDetail } from "@/components/studio/forward-detail";
import { cn } from "@/components/ui/utils";
import { forwardComponents, type Stack, type StudioData } from "@/components/studio/shared";

/** A forward sub-component that isn't wired yet — a quiet "planned" card: what it will measure and why
 *  it's gated. Honest by design: shown at ×1.00, never implying the model already exists. */
function PlannedComponent({ name, measures }: { name: string; measures: string }) {
  return (
    <div className="border-border/60 bg-muted/20 rounded-lg border border-dashed p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-foreground/70 text-sm font-medium">{name}</span>
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground/50 text-sm tabular-nums">×1.00</span>
          <StatusBadge status="placeholder" />
        </span>
      </div>
      <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">{measures}</p>
      <p className="text-muted-foreground/60 mt-1 text-[11px] leading-relaxed">
        Planned — not yet wired. A <b className="text-foreground/70">gated challenger</b>: it activates only once it beats
        the statistical baseline out-of-sample; until then it holds at ×1.00 and doesn&rsquo;t move the price.
      </p>
    </div>
  );
}

/**
 * Forecast — the forward-regime FACTOR (Step 5), decomposed into its three intended components:
 * Statistical (own-history trend, the only one wired today) × Climate/Weather × Grid. The latter two
 * are honest ×1.00 placeholders, so the composed forward equals the statistical factor — no price change.
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

  // the three intended forward sub-components (shared with the Price Breakdown expansion). Statistical
  // carries the whole forward factor today (= stack.forward.factor); Climate/Weather and Grid are not
  // wired → ×1.00. Their product is the composed forward, so this reconciles to the headline exactly.
  const components = forwardComponents(f, stack.forward.status);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">Forecast · forward regime</CardTitle>
            <CardDescription>where the county total is heading — decomposed into statistical · climate/weather · grid</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge status={stack.forward.status} />
            <InfoHint title="Statistical baseline + gated challengers">
              <p>
                The forward view is built from three components: <b>Statistical</b> (the county&rsquo;s own outage history
                forecasting next year vs its long-run mean), <b>Climate/Weather</b>, and <b>Grid</b>.
              </p>
              <p>
                Only <b>Statistical</b> is wired today — one-directional (uplift or hold) and credibility-shrunk. Climate
                and Grid are <b>gated challengers</b>: each must beat the statistical baseline out-of-sample before it
                activates, so they hold at ×1.00 for now and don&rsquo;t move the price.
              </p>
            </InfoHint>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <FactorHeadline factor={f} movePct={movePct} moveLabel="vs long-run mean" dollar={dollar} />

        {/* component decomposition — the three intended pieces + their product (= the composed forward) */}
        <div>
          <div className="text-muted-foreground mb-1.5 text-[10px] font-medium uppercase tracking-wider">Forward components</div>
          <div>
            {components.map((comp) => (
              <div
                key={comp.name}
                className="border-border/60 flex items-center justify-between gap-3 border-b py-2.5 text-sm last:border-0"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      comp.active ? "bg-status-active" : "ring-status-placeholder bg-transparent ring-1",
                    )}
                  />
                  <span className="text-foreground/80 shrink-0">{comp.name}</span>
                  <span className="text-muted-foreground/60 truncate text-xs">· {comp.blurb}</span>
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={cn("tabular-nums", comp.active ? "text-foreground" : "text-muted-foreground/50")}>
                    ×{comp.factor.toFixed(2)}
                  </span>
                  <StatusBadge status={comp.status} />
                </div>
              </div>
            ))}
          </div>
          <div className="border-border mt-2 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <span className="text-muted-foreground">Statistical × Climate/Weather × Grid</span>
            <span className="font-semibold tabular-nums">×{f.toFixed(2)}</span>
          </div>
          <p className="text-muted-foreground/60 mt-1.5 text-xs leading-relaxed">
            Only Statistical is wired today; Climate/Weather and Grid hold at ×1.00, so the composed forward equals the
            statistical factor — <b className="text-foreground/70">no change to the price</b>.
          </p>
        </div>

        {/* Statistical — the only wired component (regime → method → annual series) */}
        <div>
          <div className="text-muted-foreground mb-1.5 text-[10px] font-medium uppercase tracking-wider">Statistical · wired</div>
          {fwd ? (
            <ForwardDetail fwd={fwd} studio={data.studio} T={T} county={`${data.county.name} County`} />
          ) : (
            <p className="text-muted-foreground text-sm">
              No statistical forward model for this county — the forecast holds at the county average (×1.00).
            </p>
          )}
        </div>

        {/* Climate/Weather + Grid — planned, gated challengers (quiet cards) */}
        <div className="space-y-3">
          <PlannedComponent
            name="Climate / Weather"
            measures="Forward hazard the county's own history can't yet see — storm, wind, heat and a shifting seasonal-climate baseline (e.g. a worsening storm climatology)."
          />
          <PlannedComponent
            name="Grid"
            measures="Utility & resource reliability — feeder age, vegetation management, restoration performance, and capacity headroom."
          />
        </div>
      </CardContent>
    </Card>
  );
}
