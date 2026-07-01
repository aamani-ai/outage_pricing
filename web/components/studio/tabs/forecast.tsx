"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { InfoHint } from "@/components/ui/info-hint";
import { FactorHeadline } from "@/components/studio/factor-headline";
import { ForwardDetail } from "@/components/studio/forward-detail";
import { cn } from "@/components/ui/utils";
import { forwardComponents, forwardRouting, type Stack, type StudioData, type WeatherRead } from "@/components/studio/shared";

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

/** Route styling for the weather expert: a green rail + solid dot only where weather actually governs the
 *  price (the durable backtest winners); muted where it's the challenger the router did not pick. */
const WX_ROUTE: Record<WeatherRead["route"], { label: string; rail: string; dot: string }> = {
  weather: { label: "Weather-governed", rail: "border-l-status-active/60", dot: "bg-status-active" },
  statistical: { label: "Challenger · not chosen", rail: "border-l-border", dot: "bg-transparent ring-status-placeholder ring-1" },
  excluded: { label: "Excluded · chronic grid", rail: "border-l-border", dot: "bg-transparent ring-status-placeholder ring-1" },
};

/**
 * Climate / Weather — the weather expert (Sarasi's EOF-XGB event-count forecast) for NE counties. A
 * per-county router picks whichever forecast won the 2023–25 backtest: where weather wins it GOVERNS the
 * forward factor and prices (no shadow — the internal dashboard shows the final premium); elsewhere it's
 * the challenger the router didn't pick, shown for transparency with the verdict.
 */
function WeatherComponent({ weather, T }: { weather: WeatherRead; T: number }) {
  const d = weather.byT[String(T)];
  const meta = WX_ROUTE[weather.route];
  const wf = d?.weatherFactor;
  // weather actually governs the PRICE here only if it's routed to weather AND it covers this trigger.
  const governs = weather.route === "weather" && wf != null;
  return (
    <div className={cn("bg-muted/20 rounded-lg border border-l-2 p-4", governs ? "border-l-status-active/60" : meta.rail)}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn("size-1.5 shrink-0 rounded-full", governs ? "bg-status-active" : meta.dot)} />
          <span className="text-foreground/80 text-sm font-medium">Climate / Weather</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="border-border bg-background/60 text-muted-foreground rounded-full border px-2 py-0.5 text-[11px] font-medium">
            {governs ? "Weather-governed · prices" : meta.label}
          </span>
          <InfoHint title="Routed forecast — statistical vs weather">
            <p>
              Sarasi&rsquo;s EOF-XGB model forecasts the county&rsquo;s annual ≥T outage-event count from weather/climate
              signals. We express it as a forward factor the <b>same way</b> as the statistical one (one-directional,
              credibility-shrunk, capped) so a per-county router can compare them directly.
            </p>
            <p>
              The router picks whichever won the <b>2023–25 backtest</b>. In <b>16 Northeast counties</b> the weather
              forecast wins and <b>governs the forward factor here — it prices</b>; elsewhere the statistical baseline
              governs, and the chronic-grid cluster is excluded by the model. The chosen forecast is the one that
              prices — there is no separate shadow.
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
              <span className="text-muted-foreground">{governs ? "Applies" : "Would apply"}</span>
              <span className={cn("tabular-nums", governs ? "text-foreground font-medium" : "text-muted-foreground/70")}>
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
              <span className="text-muted-foreground">{governs ? "Statistical (runner-up)" : "Statistical (governs here)"}</span>
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
            {governs ? (
              <>
                <b className="text-foreground/70">Governs the price here</b> — the weather forecast is the applied forward
                factor for this county (it won the backtest).
              </>
            ) : weather.route === "excluded" ? (
              <>Outages here are chronic-grid, not weather-driven, so the statistical factor prices.</>
            ) : (
              <>Challenger — the statistical factor governs here, so this doesn&rsquo;t price.</>
            )}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          {weather.route === "weather"
            ? "Weather governs this county at ≥4h; at this trigger it has no forecast, so the statistical factor prices. "
            : "No weather forecast at this trigger — the weather model covers ≥4h events. "}
          {weather.why}
        </p>
      )}
    </div>
  );
}

/**
 * Forecast — the forward-regime FACTOR (Step 5). The frequency forecast is a ROUTED choice between two
 * experts — Statistical (own-history trend) and the Climate/Weather challenger — times Grid (a future
 * overlay). A per-county router picks whichever won the backtest: in 16 NE counties weather governs and
 * prices; elsewhere statistical governs. No shadow — the chosen expert is the one that prices. The other
 * stands down to ×1.00 in the decomposition, so the product equals the composed forward factor exactly.
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

  // which expert the router chose for (county, T) + both experts' model factors — the SAME source of truth
  // the Price Breakdown reads, so the two never drift. The chosen expert carries the applied forward
  // factor; the other stands down to ×1.00, so the decomposition product = the composed forward exactly.
  const routing = forwardRouting(data, T);
  const statGoverns = routing.source === "statistical";
  const components = forwardComponents({
    routedFactor: f,
    source: routing.source,
    statFactor: routing.statFactor,
    weatherFactor: routing.weatherFactor,
    statStatus: stack.forward.status,
  });

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
            <InfoHint title="Routed forecast — statistical vs weather, × grid">
              <p>
                The forward factor is a <b>routed frequency forecast</b> × <b>Grid</b>. Two experts forecast the
                county&rsquo;s next-year outage frequency: <b>Statistical</b> (the county&rsquo;s own outage history vs
                its long-run mean) and the <b>Climate/Weather</b> challenger. A per-county router picks whichever won
                the out-of-sample backtest, and the chosen one <b>governs the price</b>.
              </p>
              <p>
                Statistical governs most counties; in <b>16 Northeast counties</b> the weather forecast wins and governs
                there. The unchosen expert stands down to ×1.00 in the breakdown (it doesn&rsquo;t double-count).
                <b>Grid</b> is a planned overlay, still ×1.00. No shadow — the chosen forecast is the one that prices.
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
            {statGoverns ? (
              <>
                The router chose <b className="text-foreground/70">Statistical</b> here; Climate/Weather stands down to
                ×1.00 (challenger) and Grid is planned — so the forward factor is the statistical forecast.
              </>
            ) : (
              <>
                The router chose <b className="text-foreground/70">Climate/Weather</b> here (it won the backtest);
                Statistical stands down to ×1.00 and Grid is planned — so the weather forecast is the applied forward
                factor and <b className="text-foreground/70">it prices</b>.
              </>
            )}
          </p>
        </div>

        {/* Statistical — the own-history frequency expert (regime → method → annual series). Governs where
            the router picks it; where weather wins it's shown as the runner-up. */}
        <div>
          <div className="text-muted-foreground mb-1.5 text-[10px] font-medium uppercase tracking-wider">
            {statGoverns ? "Statistical · governs" : "Statistical · runner-up (weather won)"}
          </div>
          {fwd ? (
            <ForwardDetail fwd={fwd} studio={data.studio} T={T} county={`${data.county.name} County`} />
          ) : (
            <p className="text-muted-foreground text-sm">
              No statistical forward model for this county — the forecast holds at the county average (×1.00).
            </p>
          )}
        </div>

        {/* Climate/Weather — the weather expert where the model has coverage (NE): governs the price where
            the router picks it, else shown as the challenger. Grid — still a planned overlay. */}
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
