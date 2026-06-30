"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import type { EChartsOption } from "echarts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EChart, tooltipStyle, useChartColors } from "@/components/charts/echart";
import { KpiTile } from "@/components/analytics/kpi-tile";
import { EventSnapshot } from "@/components/analytics/event-snapshot";
import { composePremium } from "@/lib/pricing";
import { useQuoteStore } from "@/lib/quote-store";
import { api } from "@/lib/base-path";
import { money } from "@/lib/analytics/format";
import { stateName } from "@/lib/analytics/states";
import { cn } from "@/components/ui/utils";
import CENTROIDS from "@/lib/data/county-centroids.json";
import { regimeLabel } from "@/components/studio/shared";

const T_OPTS = [2, 4, 8, 12, 24];
const REGIME_OPTS = ["stable", "trend", "shift", "episodic", "insufficient"];
const centroids = CENTROIDS as unknown as Record<string, [number, number]>;
const select = "bg-card border-border h-9 rounded-md border px-2 text-sm outline-none";

// denominator provenance (A018): which customer base the per-customer rate used, and why.
type DenomStatus = "mcc_ok" | "housing_floor" | "peak_floor" | "excluded";
const DENOM_LABEL: Record<DenomStatus, string> = {
  mcc_ok: "MCC kept",
  housing_floor: "housing-units floor",
  peak_floor: "peak floor",
  excluded: "excluded",
};
const DENOM_FILTER = [
  { v: "repaired", label: "Base repaired" },
  { v: "excluded", label: "Excluded (data)" },
  { v: "mcc_ok", label: "MCC kept" },
];

// compact KPI formatters for the build-up
const fEvents = (n: number) => (n >= 10 ? Math.round(n).toLocaleString() : n.toFixed(1)); // events/yr
const fLam = (n: number) => (n >= 0.1 ? n.toFixed(2) : n.toFixed(3)); // λ/customer per yr
const fShare = (n: number) => (n >= 0.0001 ? `${(n * 100).toFixed(2)}%` : "<0.01%"); // share-out

interface CountyLite {
  fips: string;
  name: string;
  state: string;
  regime: string | null;
  conf: string | null;
  denomStatus: DenomStatus;
  excluded: boolean;
}
interface CountyHistory {
  fips: string;
  name: string;
  state: string;
  tier: string | null;
  quotable: boolean | null;
  regime: string | null;
  sub: string | null;
  conf: string | null;
  nObs: number | null;
  total: number | null;
  labelsByT: string | null;
  years: number[];
  perT: Record<string, number[]>;
  /** per-customer build-up per trigger T: lc = λ_county (events/yr), sh = share-out (avg fraction out). */
  chainByT: Record<string, { lc: number; sh: number }>;
  /** next-year forecasted annual event count per trigger (same units as perT). */
  forecastByT: Record<string, number>;
  nextYear: number | null;
  /** denominator provenance (A018): the customer base used and the inputs behind it. */
  customerBase: { status: DenomStatus; base: number | null; mcc: number | null; hu: number | null; excluded: boolean } | null;
}

/** Plain-language provenance for the customer-base denominator (A018). */
function denomNote(cb: NonNullable<CountyHistory["customerBase"]>): string {
  const mcc = cb.mcc?.toLocaleString() ?? "—";
  const hu = cb.hu?.toLocaleString() ?? "—";
  switch (cb.status) {
    case "mcc_ok":
      return `Utility customer count (MCC ${mcc}), consistent with Census housing units (${hu}) — kept as-is.`;
    case "housing_floor":
      return `EAGLE-I's MCC (${mcc}) was below Census housing units, so the base was floored to housing units (${hu}). A customer is a meter — seasonal/vacation homes keep theirs.`;
    case "peak_floor":
      return `Floored to the largest outage ever observed — more customers were once out than MCC (${mcc}) or housing units (${hu}) imply.`;
    case "excluded":
      return `Not priced: the observed peak-out exceeds any plausible base (MCC ${mcc} · housing units ${hu}). The outage count itself looks corrupt, so pricing would under-state the risk.`;
  }
}

// plain-language KPI explainers (every KPI gets one)
const HINTS = {
  regime: (
    <p>
      The county&rsquo;s outage-<b>behaviour pattern</b> from its history: <b>stable</b> (steady), <b>trend</b>{" "}
      (rising/falling), <b>shift</b> (jumped to a new level), <b>episodic</b> (rare spikes), or <b>insufficient</b> (can&rsquo;t
      tell). The classifier abstains rather than force a label.
    </p>
  ),
  conf: <p>How sure the classifier is in the regime label — <b>high</b> or <b>low</b>. Low means the history is borderline or thin.</p>,
  nObs: <p>How many years of observed outage history we have for this county. More years = a more reliable read.</p>,
  total: <p>Total qualifying outages lasting <b>8+ hours</b> across all observed years — the sample the regime is built on.</p>,
  lamCounty: <p>How many qualifying outages of the selected duration this county sees <b>per year</b>, on average (λ_county) — the starting frequency, before we narrow to a single customer.</p>,
  avgOut: <p>The average number of <b>customers without power</b> during one of those events (mean across events) = share-out × customer base.</p>,
  shareOut: (
    <p>
      The share of the county&rsquo;s customers a typical event takes out = <b>avg customers out ÷ customer base</b>. It&rsquo;s
      the multiplier from county frequency to the per-customer rate — and a mean over events, so a few big storms lift it.
    </p>
  ),
  lamCust: <p>Expected qualifying outages <b>per year for a single customer</b> = events/yr × share-out (λ_customer). This is what drives the premium.</p>,
  base: <p>The <b>customer base</b> we divide by (the denominator). How it was chosen is shown as the <i>method</i> — see the note below.</p>,
  mcc: <p>EAGLE-I&rsquo;s modelled max customer count for the utility — the <b>raw source</b> number. We override it when it&rsquo;s implausibly low.</p>,
  hu: <p>Census <b>housing units</b> (B25001) — every home incl. seasonal/vacation. A sanity floor, since each home has a meter.</p>,
  method: <p>How the customer base was chosen: <b>MCC kept</b> · <b>housing-units floor</b> (MCC too low) · <b>peak floor</b> (largest outage seen) · <b>excluded</b> (data invalid).</p>,
  el: <p>The <b>expected loss</b> for a single customer per year = λ/customer × payout (a.k.a. pure premium / loss cost) — the risk cost, before expenses and margin.</p>,
  premium: <p>The <b>indicative annual premium</b> = expected loss ÷ (1 − expenses − margin). County-representative: the within-county <b>location basis</b> and the forward factor are held at ×1.00 here.</p>,
  annualChance: <p>The chance of at least one qualifying outage in a year for a single customer ≈ 1 − e<sup>−λ</sup>.</p>,
  payout: <p>The fixed payout when an outage crosses the trigger — carried over from the Analytics view (change it there).</p>,
};

export function CountyExplorerView({ initialFips }: { initialFips?: string }) {
  const router = useRouter();
  const { current, loadings, setLocation, setT: setStoreT, setStudioTab } = useQuoteStore();
  const c = useChartColors();

  const [list, setList] = useState<CountyLite[]>([]);
  const [q, setQ] = useState("");
  const [stateF, setStateF] = useState("");
  const [regimeF, setRegimeF] = useState("");
  const [confF, setConfF] = useState("");
  const [denomF, setDenomF] = useState("");
  const [sel, setSel] = useState<string | null>(initialFips ?? null);
  const [T, setT] = useState(() => (T_OPTS.includes(current.T) ? current.T : 8));
  const [hist, setHist] = useState<CountyHistory | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(api("/api/counties"))
      .then((r) => r.json())
      .then((j) => setList(j.counties ?? []))
      .catch(() => {});
  }, []);

  // deep-link from Analytics QC (?fips=) — select that county, including on repeat navigations.
  useEffect(() => {
    if (initialFips) setSel(initialFips);
  }, [initialFips]);

  useEffect(() => {
    if (!sel) {
      setHist(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(api(`/api/county-history?fips=${sel}`))
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) {
          setHist(j);
          setLoading(false);
        }
      })
      .catch(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [sel]);

  const states = useMemo(
    () => Array.from(new Set(list.map((c) => c.state))).sort((a, b) => stateName(a).localeCompare(stateName(b))),
    [list],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out = list.filter((cty) => {
      if (stateF && cty.state !== stateF) return false;
      if (regimeF && cty.regime !== regimeF) return false;
      if (confF && (cty.conf ?? "—") !== confF) return false;
      if (denomF === "repaired" && !(cty.denomStatus === "housing_floor" || cty.denomStatus === "peak_floor")) return false;
      if (denomF && denomF !== "repaired" && cty.denomStatus !== denomF) return false;
      if (s && !`${cty.name}, ${cty.state}`.toLowerCase().includes(s)) return false;
      return true;
    });
    return { total: out.length, shown: out.slice(0, 100) };
  }, [q, stateF, regimeF, confF, denomF, list]);

  function openInStudio() {
    if (!hist) return;
    const ll = centroids[hist.fips];
    if (!ll) return;
    setStoreT(T);
    setStudioTab("breakdown"); // land on Price Breakdown — the QC → Explorer → Studio funnel
    setLocation({ lon: ll[0], lat: ll[1], label: `${hist.name} County, ${hist.state}` });
    router.push("/studio");
  }

  const timeline = useMemo<EChartsOption | null>(() => {
    if (!hist || !hist.years.length) return null;
    const series = hist.perT[String(T)] ?? [];
    const fc = hist.forecastByT?.[String(T)];
    const hasFc = fc != null && hist.nextYear != null && series.length > 0;
    const cats = hist.years.map(String).concat(hasFc ? [String(hist.nextYear)] : []);
    // observed years use the standard bar color; the appended forecast bar is the forward/forecast color.
    const data: (number | { value: number; itemStyle: { color: string; borderRadius: number[] } })[] = hasFc
      ? [...series, { value: fc, itemStyle: { color: c.fwd, borderRadius: [3, 3, 0, 0] } }]
      : series;
    return {
      grid: { left: 6, right: 12, top: 16, bottom: 22, containLabel: true },
      tooltip: { trigger: "axis", valueFormatter: (v) => `${Number(v)} events`, ...tooltipStyle(c) },
      xAxis: {
        type: "category",
        data: cats,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: c.axis } },
        axisLabel: { color: c.sub, fontSize: 10 },
      },
      yAxis: { type: "value", axisLabel: { color: c.sub, fontSize: 10 }, splitLine: { lineStyle: { color: c.grid } } },
      series: [
        {
          type: "bar",
          data,
          barWidth: "60%",
          itemStyle: { color: c.bar, borderRadius: [3, 3, 0, 0] },
          emphasis: { itemStyle: { color: c.barHover } },
        },
      ],
    };
  }, [hist, T, c]);

  const cb = hist?.customerBase ?? null;
  const cbExcluded = cb?.excluded ?? false;

  // the single, prominent exclusion reason for the detail banner. Priority: corrupt data (most
  // fundamental) → can't characterize the risk (regime) → red tier. Plain language, no jargon.
  const exclusion = useMemo<{ tag: string; body: string } | null>(() => {
    if (!hist) return null;
    if (cbExcluded && cb) return { tag: "Data not trustworthy", body: denomNote(cb) };
    if (hist.regime === "insufficient") {
      switch (hist.sub) {
        case "recent-change":
          return {
            tag: "Risk pattern recently changed",
            body: "This county has plenty of outage history, but its rate recently shifted — the classifier won't force a label on a pattern that just changed. We decline rather than quote a forward risk we can't stand behind.",
          };
        case "short-history":
          return {
            tag: "Not enough history",
            body: "Too few years of observed outages to characterize this county's risk pattern with confidence — the classifier abstains rather than guess.",
          };
        case "low-volume":
          return {
            tag: "Too few events",
            body: "The county sees too few qualifying outages to build a reliable rate — the classifier abstains rather than over-read a sparse history.",
          };
        default:
          return {
            tag: "Risk not characterizable",
            body: `Insufficient data${hist.sub ? ` · ${hist.sub}` : ""} — the classifier abstains rather than force a label.`,
          };
      }
    }
    if (hist.quotable === false) return { tag: "Not quotable", body: "Flagged not quotable (red tier) — outside the offered book." };
    return null;
  }, [hist, cb, cbExcluded]);

  // per-customer build-up at the selected trigger: events/yr (λ_county) × share-out → λ/customer,
  // and avg customers out per event = share-out × base. Null when this county has no chain at T.
  const buildup = useMemo(() => {
    if (!hist) return null;
    const ch = hist.chainByT?.[String(T)];
    if (!ch) return null;
    const base = hist.customerBase?.base ?? null;
    return { lamCounty: ch.lc, shareOut: ch.sh, lamCust: ch.lc * ch.sh, avgOut: base != null ? ch.sh * base : null };
  }, [hist, T]);

  // indicative pricing at the carried payout — rendered through the ONE engine (composePremium),
  // never re-derived. County-representative: location basis & forward held at ×1.00.
  const pricing = useMemo(() => {
    if (!buildup || cbExcluded) return null;
    const X = current.X;
    try {
      const s = composePremium(
        { baseline: { lambdaCustomer: buildup.lamCust, status: "active" } },
        { T, X, expenseRatio: loadings.ER, targetMargin: loadings.TM },
      );
      const annualPct = buildup.lamCust > 0 ? Math.max(1, Math.round((1 - Math.exp(-buildup.lamCust)) * 100)) : 0;
      return { X, el: s.pure, premium: s.premium.point, annualPct };
    } catch {
      return null;
    }
  }, [buildup, cbExcluded, T, current.X, loadings.ER, loadings.TM]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">County explorer</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Browse every county&rsquo;s outage history and regime — to verify the clustering and decide where we&rsquo;re not
          comfortable pricing.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-5 lg:items-stretch">
        {/* county list + filters */}
        <Card className="flex min-h-[460px] flex-col lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Counties</CardTitle>
            <CardDescription>
              {filtered.total.toLocaleString()} of {list.length.toLocaleString()} CONUS counties
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search county or state…"
              className="bg-card border-border mb-2 h-9 w-full rounded-md border px-3 text-sm outline-none"
            />
            <div className="mb-2 grid grid-cols-2 gap-1.5">
              <select value={stateF} onChange={(e) => setStateF(e.target.value)} className={select} aria-label="state">
                <option value="">All states</option>
                {states.map((s) => (
                  <option key={s} value={s}>
                    {stateName(s)}
                  </option>
                ))}
              </select>
              <select value={regimeF} onChange={(e) => setRegimeF(e.target.value)} className={select} aria-label="regime">
                <option value="">All regimes</option>
                {REGIME_OPTS.map((r) => (
                  <option key={r} value={r} className="capitalize">
                    {r}
                  </option>
                ))}
              </select>
              <select value={confF} onChange={(e) => setConfF(e.target.value)} className={select} aria-label="confidence">
                <option value="">Any conf.</option>
                <option value="high">High conf.</option>
                <option value="low">Low conf.</option>
              </select>
              <select value={denomF} onChange={(e) => setDenomF(e.target.value)} className={select} aria-label="denominator">
                <option value="">Any base</option>
                {DENOM_FILTER.map((d) => (
                  <option key={d.v} value={d.v}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative min-h-0 flex-1">
              <div className="absolute inset-0 space-y-0.5 overflow-y-auto pr-1">
              {filtered.shown.map((cty) => (
                <button
                  key={cty.fips}
                  type="button"
                  onClick={() => setSel(cty.fips)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                    sel === cty.fips ? "bg-primary/10 text-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span className="truncate">
                    {cty.name}
                    <span className="text-muted-foreground">, {cty.state}</span>
                  </span>
                  {cty.denomStatus === "excluded" || cty.excluded ? (
                    <span className="text-tier-amber shrink-0 text-[10px]">excluded</span>
                  ) : cty.denomStatus !== "mcc_ok" ? (
                    <span
                      className="shrink-0 rounded-full"
                      style={{ width: 6, height: 6, background: c.bar }}
                      title={`Customer base repaired — ${DENOM_LABEL[cty.denomStatus]}`}
                    />
                  ) : null}
                </button>
              ))}
              {!filtered.shown.length && <p className="text-muted-foreground p-2 text-sm">No counties match these filters.</p>}
              {filtered.total > filtered.shown.length && (
                <p className="text-muted-foreground/60 px-2 py-1 text-xs">
                  +{(filtered.total - filtered.shown.length).toLocaleString()} more — narrow the filters
                </p>
              )}
              </div>
            </div>
            {/* marker legend — what the row indicators mean */}
            <div className="text-muted-foreground/70 border-border/40 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-[10px]">
              <span className="flex items-center gap-1">
                <span className="inline-block rounded-full" style={{ width: 6, height: 6, background: c.bar }} /> base repaired
              </span>
              <span className="text-tier-amber">excluded = not priced</span>
              <span>· no mark = raw MCC base</span>
            </div>
          </CardContent>
        </Card>

        {/* detail */}
        <div className="lg:col-span-3">
          {!sel && (
            <Card>
              <CardContent className="text-muted-foreground p-6 text-sm">Pick a county to see its history and regime.</CardContent>
            </Card>
          )}
          {sel && loading && (
            <Card>
              <CardContent className="text-muted-foreground p-6 text-sm">Loading…</CardContent>
            </Card>
          )}
          {sel && hist && !loading && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm">
                      {hist.name} County, {hist.state}
                    </CardTitle>
                    <CardDescription>
                      regime {regimeLabel(hist.regime, hist.sub)}
                      {hist.conf && hist.conf !== "—" && ` · ${hist.conf} confidence`}
                    </CardDescription>
                  </div>
                  <button
                    type="button"
                    onClick={openInStudio}
                    className="text-primary hover:bg-muted inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium"
                  >
                    Open in Studio <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* exclusion banner — the headline when a county is NOT priced; bold, plain reason */}
                {exclusion && (
                  <div className="border-tier-amber/40 bg-tier-amber/10 rounded-lg border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-tier-amber text-base font-bold">Excluded — not priced</span>
                      <span className="text-tier-amber bg-tier-amber/15 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        {exclusion.tag}
                      </span>
                    </div>
                    <p className="text-foreground/90 mt-2 text-sm leading-relaxed">{exclusion.body}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <KpiTile label="regime" value={regimeLabel(hist.regime, hist.sub)} hint={HINTS.regime} />
                  <KpiTile label="confidence" value={hist.conf && hist.conf !== "—" ? hist.conf : "—"} hint={HINTS.conf} />
                  <KpiTile label="obs years" value={hist.nObs != null ? String(hist.nObs) : "—"} hint={HINTS.nObs} />
                  <KpiTile label="≥8h events" value={hist.total != null ? hist.total.toLocaleString() : "—"} hint={HINTS.total} />
                </div>

                {/* per-customer build-up — events/yr × share-out → λ/customer (updates with the trigger) */}
                {buildup && !cbExcluded && (
                  <div>
                    <div className="text-muted-foreground mb-2 text-[10px] font-medium uppercase tracking-wider">
                      Per-customer build-up · ≥{T}h
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <KpiTile label="events / yr" value={fEvents(buildup.lamCounty)} hint={HINTS.lamCounty} />
                      <KpiTile
                        label="avg customers out"
                        value={buildup.avgOut != null ? Math.round(buildup.avgOut).toLocaleString() : "—"}
                        hint={HINTS.avgOut}
                      />
                      <KpiTile label="share-out" value={fShare(buildup.shareOut)} hint={HINTS.shareOut} />
                      <KpiTile label="λ / customer" value={fLam(buildup.lamCust)} hint={HINTS.lamCust} />
                    </div>
                  </div>
                )}

                {/* indicative pricing at the carried payout — county-representative (before location/forward basis) */}
                {pricing && (
                  <div>
                    <div className="text-muted-foreground mb-2 text-[10px] font-medium uppercase tracking-wider">
                      Indicative pricing · ≥{T}h · payout {money(pricing.X)}
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <KpiTile label="expected loss / yr" value={money(pricing.el)} hint={HINTS.el} />
                      <KpiTile label="indicative premium" value={money(pricing.premium)} hint={HINTS.premium} highlight />
                      <KpiTile label="annual chance" value={`~${pricing.annualPct}%`} hint={HINTS.annualChance} />
                      <KpiTile label="payout" value={money(pricing.X)} hint={HINTS.payout} />
                    </div>
                    <p className="text-muted-foreground/80 mt-2 text-xs leading-relaxed">
                      County-representative — the within-county <b>location basis</b> &amp; forward factor are held at ×1.00,
                      before underwriter adjustments (ER {Math.round(loadings.ER * 100)}% · TM {Math.round(loadings.TM * 100)}%).
                      Open in Studio for the full breakdown.
                    </p>
                  </div>
                )}

                {/* customer base (denominator) — the exact number we divide by, its inputs, and the method */}
                {cb && !cbExcluded && (
                  <div>
                    <div className="text-muted-foreground mb-2 text-[10px] font-medium uppercase tracking-wider">
                      Customer base (denominator)
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <KpiTile label="customer base" value={cb.base != null ? cb.base.toLocaleString() : "—"} hint={HINTS.base} highlight />
                      <KpiTile label="MCC (raw)" value={cb.mcc != null ? cb.mcc.toLocaleString() : "—"} hint={HINTS.mcc} />
                      <KpiTile label="housing units" value={cb.hu != null ? cb.hu.toLocaleString() : "—"} hint={HINTS.hu} />
                      <KpiTile label="base method" value={DENOM_LABEL[cb.status]} hint={HINTS.method} />
                    </div>
                    <p className="text-muted-foreground/80 mt-2 text-xs leading-relaxed">{denomNote(cb)}</p>
                  </div>
                )}

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                      Annual qualifying events · ≥{T}h
                    </div>
                    <div className="flex gap-1">
                      {T_OPTS.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setT(t)}
                          className={cn(
                            "rounded px-1.5 py-0.5 text-xs tabular-nums transition-colors",
                            t === T ? "bg-primary/10 text-foreground font-medium" : "text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {t}h
                        </button>
                      ))}
                    </div>
                  </div>
                  {timeline ? (
                    <EChart option={timeline} height={210} />
                  ) : (
                    <p className="text-muted-foreground text-sm">No annual series for this county.</p>
                  )}
                  {hist.forecastByT?.[String(T)] != null && hist.nextYear != null && (
                    <p className="text-muted-foreground/70 mt-1.5 flex items-center gap-1.5 text-xs">
                      <span className="inline-block size-2 shrink-0 rounded-sm" style={{ background: c.fwd }} />
                      <span>
                        <b className="text-foreground/70">{hist.nextYear}</b> is the statistical forecast (next-year
                        frequency) — not observed.
                      </span>
                    </p>
                  )}
                  <p className="text-muted-foreground/70 mt-1.5 text-xs">
                    Does the <b className="text-foreground/70">{regimeLabel(hist.regime, hist.sub)}</b> label match the
                    shape above?{hist.labelsByT && <> Cross-T: {hist.labelsByT}.</>} This is the clustering QC read.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* full-width event time series for the selected county — the numerator lens */}
      {sel && hist && !loading && (
        <EventSnapshot fips={sel} T={T} label={`${hist.name} County, ${hist.state}`} />
      )}
    </div>
  );
}
