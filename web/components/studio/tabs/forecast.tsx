"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { InfoHint } from "@/components/ui/info-hint";
import { FactorHeadline } from "@/components/studio/factor-headline";
import { ForwardDetail } from "@/components/studio/forward-detail";
import { cn } from "@/components/ui/utils";
import { forwardComponents, type Stack, type StudioData, type WeatherRead } from "@/components/studio/shared";

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

const num = (n: number) => (n >= 100 ? Math.round(n).toLocaleString("en-US") : n.toFixed(1));

/** Route styling for the weather challenger: a green rail only when weather is the durable backtest
 *  winner; muted otherwise. The pill NEVER reads "active" — this is shadow, it doesn't price. */
const WX_ROUTE: Record<WeatherRead["route"], { label: string; note: string; rail: string; dot: string }> = {
  weather: {
    label: "Weather-governed",
    note: "pilot · shadow",
    rail: "border-l-status-active/50",
    dot: "bg-status-active",
  },
  statistical: {
    label: "Shown · not chosen",
    note: "statistical wins the backtest",
    rail: "border-l-border",
    dot: "bg-transparent ring-status-placeholder ring-1",
  },
  excluded: {
    label: "Excluded",
    note: "chronic-grid cluster",
    rail: "border-l-border",
    dot: "bg-transparent ring-status-placeholder ring-1",
  },
};

/**
 * Climate / Weather — the WIRED-BUT-SHADOW read for NE counties (Sarasi's EOF-XGB event-count forecast).
 * Shows the forecast, the factor it WOULD apply, and the backtest verdict (why chosen / not) — but it does
 * NOT move the price: the composed forward stays on the statistical factor until a live forecast lands.
 * Deliberately un-highlighted (no headline factor, muted rail) so it reads as a challenger under review.
 */
function WeatherComponent({ weather, T }: { weather: WeatherRead; T: number }) {
  const d = weather.byT[String(T)];
  const meta = WX_ROUTE[weather.route];
  const wf = d?.weatherFactor;
  return (
    <div className={cn("bg-muted/20 rounded-lg border border-l-2 p-4", meta.rail)}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn("size-1.5 shrink-0 rounded-full", meta.dot)} />
          <span className="text-foreground/80 text-sm font-medium">Climate / Weather</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="border-border bg-background/60 text-muted-foreground rounded-full border px-2 py-0.5 text-[11px] font-medium">
            {meta.label} · {meta.note}
          </span>
          <InfoHint title="Weather challenger — shadow, not priced">
            <p>
              Sarasi&rsquo;s EOF-XGB model forecasts the county&rsquo;s annual ≥T outage-event count from weather/climate
              signals. We express it as a forward factor the <b>same way</b> as the statistical one (one-directional,
              credibility-shrunk, capped) so the two are directly comparable.
            </p>
            <p>
              It is <b>shadow</b>: the price still uses the statistical factor. On the 2023–25 backtest weather is the
              durable winner in <b>16 Northeast counties</b> — those are flagged &ldquo;weather-governed&rdquo; and will
              actually govern once a <b>live current-year forecast</b> replaces this backtest fit. Everywhere else the
              statistical baseline won, and the chronic-grid cluster is excluded by the model.
            </p>
          </InfoHint>
        </span>
      </div>

      {d ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">Weather forecast</span>
              <span className="text-foreground tabular-nums">{num(d.weatherMean)}/yr</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">Would apply</span>
              <span
                className={cn(
                  "tabular-nums",
                  weather.route === "weather" ? "text-foreground font-medium" : "text-muted-foreground/70",
                )}
              >
                {wf != null ? `×${wf.toFixed(2)}` : "—"}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">90% band</span>
              <span className="text-muted-foreground/80 tabular-nums">
                {num(d.weatherP5)}–{num(d.weatherP95)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">Prices today (statistical)</span>
              <span className="text-foreground/80 tabular-nums">{d.statFactor != null ? `×${d.statFactor.toFixed(2)}` : "—"}</span>
            </div>
            {d.lamFull != null && (
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-muted-foreground">Long-run mean</span>
                <span className="text-muted-foreground/80 tabular-nums">{num(d.lamFull)}/yr</span>
              </div>
            )}
          </div>
          <p className="text-muted-foreground mt-3 text-xs leading-relaxed">{weather.why}</p>
          <p className="text-muted-foreground/60 mt-1 text-[11px] leading-relaxed">
            {weather.route === "weather" ? (
              <>
                <b className="text-foreground/70">Shadow</b> — the price still uses the statistical factor. This
                backtest-durable county flips to weather-governed once a live current-year forecast lands.
              </>
            ) : (
              <>Shown for transparency — this county is <b className="text-foreground/70">not</b> routed to weather, so it doesn&rsquo;t affect the price.</>
            )}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          No weather forecast at this trigger — the weather model covers ≥4h events. {weather.why}
        </p>
      )}
    </div>
  );
}

/**
 * Forecast — the forward-regime FACTOR (Step 5), decomposed into its three intended components:
 * Statistical (own-history trend — the only one that moves the price today) × Climate/Weather × Grid.
 * Climate/Weather is now a wired-but-shadow challenger for Northeast counties (shown + backtested, held at
 * ×1.00 in the price); Grid is still a planned ×1.00 placeholder. Both hold at ×1.00, so the composed
 * forward still equals the statistical factor — no price change.
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
  // carries the whole forward factor today (= stack.forward.factor); Climate/Weather (wired as a shadow
  // read) holds at ×1.00 in the price and Grid isn't wired yet → ×1.00. Their product is the composed
  // forward, so this reconciles to the headline exactly.
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
            <InfoHint title="Statistical baseline + shadow challengers">
              <p>
                The forward view is built from three components: <b>Statistical</b> (the county&rsquo;s own outage history
                forecasting next year vs its long-run mean), <b>Climate/Weather</b>, and <b>Grid</b>.
              </p>
              <p>
                <b>Statistical</b> prices today — one-directional (uplift or hold) and credibility-shrunk.{" "}
                <b>Climate/Weather</b> is now a <b>wired shadow challenger</b> for Northeast counties: its forecast is
                shown and backtested below, but it holds at ×1.00 in the price. <b>Grid</b> is still a planned
                challenger, also at ×1.00. Each must beat the statistical baseline out-of-sample before it moves the
                premium, so neither moves the price today.
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
            Only Statistical moves the price today; Climate/Weather (a shadow challenger on the NE pilot) and Grid hold
            at ×1.00, so the composed forward equals the statistical factor —{" "}
            <b className="text-foreground/70">no change to the price</b>.
          </p>
        </div>

        {/* Statistical — the price-moving component (regime → method → annual series) */}
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

        {/* Climate/Weather — a live shadow read where the weather model has coverage (NE), else planned.
            Grid — still a planned, gated challenger. */}
        <div className="space-y-3">
          {data.weather ? (
            <WeatherComponent weather={data.weather} T={T} />
          ) : (
            <PlannedComponent
              name="Climate / Weather"
              measures="Forward hazard the county's own history can't yet see — storm, wind, heat and a shifting seasonal-climate baseline (e.g. a worsening storm climatology)."
            />
          )}
          <PlannedComponent
            name="Grid"
            measures="Utility & resource reliability — feeder age, vegetation management, restoration performance, and capacity headroom."
          />
        </div>
      </CardContent>
    </Card>
  );
}
