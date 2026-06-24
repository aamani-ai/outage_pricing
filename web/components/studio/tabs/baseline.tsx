"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { ExpandBox } from "@/components/ui/expand-box";
import { EChart, tooltipStyle, useChartColors } from "@/components/charts/echart";
import { cn } from "@/components/ui/utils";
import type { StudioData } from "@/components/studio/shared";

const TS = [2, 4, 8, 12, 24] as const;

const rate = (n: number) => {
  if (n >= 0.1) return n.toFixed(2);
  if (n >= 0.001) return n.toFixed(3);
  return n > 0 ? "<0.001" : "0";
};

// TRUST — how hard to lean (data governance)
const trustTone = (t: string) =>
  t === "Strong" ? "text-tier-green" : t === "Medium" ? "text-tier-amber" : "text-tier-red";
const trustDot = (t: string) =>
  t === "Strong" ? "bg-tier-green" : t === "Medium" ? "bg-tier-amber" : "bg-tier-red";
// Cushion claim is established only at long triggers (>=8h); short triggers read "not established".
const CUSHION_MIN_T = 8;
// POSTURE LEVEL — how conservative. well-cushioned = green (established, long T);
// "not established" / "runs close" = amber caution; "(suppressed)" = muted (thin trust).
const levelTone = (l: string) =>
  l === "well-cushioned"
    ? "text-tier-green"
    : l === "some cushion"
      ? "text-foreground/80"
      : l === "(suppressed)"
        ? "text-muted-foreground"
        : "text-tier-amber";
const ROUTE_STYLE: Record<string, string> = {
  Quote: "bg-tier-green/10 text-tier-green",
  Caveat: "bg-tier-amber/10 text-tier-amber",
  Verify: "bg-tier-amber/10 text-tier-amber",
  Suppress: "bg-tier-red/10 text-tier-red",
};
const C_LABELS = ["coverage", "sample", "stability"];

/** The cushion claim by trigger duration — short (2–4h) verify, long (>=8h) cushioned. */
function CushionByTrigger({ T }: { T: number }) {
  return (
    <div>
      <div className="text-muted-foreground mb-1.5 text-[10px] font-medium uppercase tracking-wider">
        Cushion claim by trigger
      </div>
      <div className="flex gap-1">
        {TS.map((t) => {
          const established = t >= CUSHION_MIN_T;
          const isCur = t === T;
          return (
            <div
              key={t}
              className={cn(
                "flex-1 rounded border px-1 py-1.5 text-center",
                established ? "border-tier-green/40 text-tier-green" : "border-tier-amber/40 text-tier-amber",
                isCur && "ring-primary ring-1",
              )}
            >
              <div className="text-[11px] font-medium">{t}h</div>
              <div className="text-[9px] leading-tight">{established ? "cushioned" : "verify"}</div>
            </div>
          );
        })}
      </div>
      <p className="text-muted-foreground/70 mt-2 text-[11px] leading-relaxed">
        Claimed only where it&rsquo;s <b className="text-foreground">robust (≥8h)</b>; 2–4h read{" "}
        <b className="text-tier-amber">verify</b> — rigorous short-trigger treatment is deferred.
      </p>
    </div>
  );
}

/** Why ≥8h carries the cushion — the two pillars, full-width beneath the per-cell detail. */
function WhyCushion() {
  return (
    <div className="border-border/50 border-t pt-3">
      <div className="text-muted-foreground mb-2 text-[10px] font-medium uppercase tracking-wider">
        Why ≥8h carries the cushion
      </div>
      <div className="grid gap-x-5 gap-y-2 text-xs sm:grid-cols-2">
        <div className="text-muted-foreground">
          <b className="text-foreground">Established</b> — long outages are single coherent surges, so the event count
          captures them; hiding an extra short episode would take an event ≥2× the trigger — rare at 8h+.
        </div>
        <div className="text-muted-foreground">
          <b className="text-foreground">Conservative</b> — at long durations the priced mean over-states true
          per-customer exposure (A011, ~2–3×).
        </div>
      </div>
      <p className="text-muted-foreground/60 mt-2 text-[11px] leading-relaxed">
        Short triggers fail both — sub-episodes hide inside longer events and the mean dilutes the peak — so we verify,
        not claim.
      </p>
    </div>
  );
}

export function BaselineTab({ data, T }: { data: StudioData; T: number }) {
  const c = useChartColors();
  const s = data.studio;
  const cells = data.county.T;
  const cur = s?.cell?.[String(T)];

  const series = s?.perT[String(T)] ?? [];
  const years = s?.years ?? [];
  const odT = s?.od?.[String(T)];
  const cone = s?.mult?.[String(T)]; // [median, mean, max]

  const historyOpt = useMemo<EChartsOption>(
    () => ({
      grid: { left: 6, right: 12, top: 18, bottom: 22, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        valueFormatter: (v) => `${Number(v)} outages`,
        ...tooltipStyle(c),
      },
      xAxis: {
        type: "category",
        data: years.map(String),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: c.axis } },
        axisLabel: { color: c.sub, fontSize: 10 },
      },
      yAxis: { type: "value", axisLabel: { color: c.sub, fontSize: 10 }, splitLine: { lineStyle: { color: c.grid } } },
      series: [
        {
          name: `≥${T}h outages`,
          type: "bar",
          data: series,
          barWidth: "60%",
          itemStyle: { color: c.bar, borderRadius: [3, 3, 0, 0] },
          emphasis: { itemStyle: { color: c.barHover } },
        },
      ],
    }),
    [c, series, years, T],
  );

  if (!s)
    return (
      <Card>
        <CardContent className="text-muted-foreground p-6 text-sm">No history for this county.</CardContent>
      </Card>
    );

  const total = series.reduce((a, b) => a + b, 0);
  const minIdx = cur ? cur.C.indexOf(Math.min(...cur.C)) : -1;

  return (
    <div className="space-y-5">
      {/* 1 — the cell read: TRUST + POSTURE, the two-axis read */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-sm">Cell read · trust &amp; posture</CardTitle>
              <CardDescription>two reads per trigger — how much to trust it, and how conservative it is</CardDescription>
            </div>
            <InfoHint title="Trust & Posture — two different questions">
              <p>
                <b>Trust</b> — how hard can I lean on this number? The <b>weakest</b> of three checks: source coverage,
                sample volume, and eventization stability. Strong · Medium · Thin.
              </p>
              <p>
                <b>Posture</b> — how conservative is it, and <b>where does that break down</b>? The built-in A011 cushion
                by duration (thin at 2–4h → <b>runs close</b>; thick at 8h+ → <b>well-cushioned</b>), plus a tilt vs peers.
              </p>
              <p>
                They&rsquo;re <b>independent</b> — never merged into one score — and posture <b>never moves the price</b>;
                it routes and contextualizes.
              </p>
            </InfoHint>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-border border-b text-xs">
                  <th className="py-1.5 text-left font-medium">Trigger</th>
                  <th className="py-1.5 text-right font-medium">λ / customer (typ · priced · peak)</th>
                  <th className="py-1.5 text-right font-medium">Events</th>
                  <th className="py-1.5 pl-5 text-left font-medium">Trust</th>
                  <th className="py-1.5 pl-5 text-left font-medium">Posture</th>
                  <th className="py-1.5 pl-5 text-left font-medium">Route</th>
                </tr>
              </thead>
              <tbody>
                {TS.map((t) => {
                  const cell = cells[String(t)];
                  const cr = s.cell?.[String(t)];
                  const mt = s.mult?.[String(t)];
                  const isCur = t === T;
                  return (
                    <tr key={t} className={cn("border-border/50 border-b last:border-0", isCur && "bg-muted/40")}>
                      <td className="py-2 font-medium">
                        {t}h{isCur && <span className="text-primary"> ◄</span>}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {mt ? (
                          <>
                            <span className="text-foreground/60">{rate(mt[0])}</span> ·{" "}
                            <span className="font-semibold">{rate(mt[1])}</span> ·{" "}
                            <span className="text-foreground/60">{rate(mt[2])}</span>
                          </>
                        ) : cell ? (
                          rate(cell.lam)
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 text-right tabular-nums">{cell?.n != null ? cell.n.toLocaleString() : "—"}</td>
                      <td className="py-2 pl-5">
                        {cr ? (
                          <span className="flex items-center gap-1.5">
                            <span className={cn("size-1.5 rounded-full", trustDot(cr.trust))} />
                            <span className={trustTone(cr.trust)}>{cr.trust}</span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 pl-5">
                        {cr ? (
                          <span>
                            <span className={levelTone(cr.level)}>{cr.level}</span>
                            {cr.level !== "not established" && cr.level !== "(suppressed)" && (
                              <span className="text-muted-foreground/70 text-xs"> · {cr.tilt}</span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 pl-5">
                        {cr ? (
                          <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", ROUTE_STYLE[cr.route])}>
                            {cr.route}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground/70 mt-3 text-xs">
            <b className="text-foreground/80">Trust</b> = believe-it (coverage · sample · stability, weakest link).{" "}
            <b className="text-foreground/80">Posture</b> = how conservative the price is. We claim a cushion only at{" "}
            <b className="text-foreground/80">longer triggers (≥8h)</b>; at <b className="text-foreground/80">2–4h</b> the
            event-average is duration-blind, so the cushion is <b className="text-tier-amber">not established</b> →{" "}
            <b className="text-tier-amber">verify</b>, lead with longer triggers. Neither moves the price.
          </p>

          {/* current-cell detail + orthogonality grid — collapsed by default; expand to dig in */}
          {cur && (
            <div className="mt-4">
              <ExpandBox title={`Trust & posture detail · ${T}h`}>
                <div className="space-y-4">
                  <div className="grid gap-5 md:grid-cols-[1fr_20rem]">
                    <div className="min-w-0 space-y-2 text-xs">
                      <div className="text-sm font-medium">
                        {T}h · <span className={trustTone(cur.trust)}>{cur.trust}</span> ·{" "}
                        <span className={levelTone(cur.level)}>{cur.level}</span>
                      </div>
                      <div className="text-muted-foreground">
                        <b className="text-foreground">Trust {cur.tnum.toFixed(2)}</b> — binds on{" "}
                        {cur.C.map((v, i) => (
                          <span key={i}>
                            {i > 0 && " · "}
                            <span className={i === minIdx ? "text-foreground font-medium" : ""}>
                              {C_LABELS[i]} {v.toFixed(2)}
                              {i === minIdx && " ◄"}
                            </span>
                          </span>
                        ))}{" "}
                        <span className="text-muted-foreground/70">(weakest link wins)</span>
                      </div>
                      {cur.level === "not established" ? (
                        <div className="text-muted-foreground">
                          <b className="text-tier-amber">Cushion not established.</b> A short outage can hide a broad
                          plateau that the full-event average dilutes — the duration-blind peak/mean (
                          <span className="tabular-nums">{cur.p2m}</span>) is analyst-only here. {cur.n_obs} observed
                          years.
                        </div>
                      ) : (
                        <>
                          <div className="text-muted-foreground">
                            <b className="text-foreground">Posture</b> peak/mean {cur.p2m} → {cur.level} · {cur.tilt} than
                            peers ({Math.round(cur.pctile * 100)}th pctile)
                          </div>
                          <div className="text-muted-foreground">
                            {cur.n_obs} observed years
                            {cur.mm != null && <> · mean ≈ {cur.mm}× median (heavy-tailed)</>}
                          </div>
                        </>
                      )}
                    </div>
                    <CushionByTrigger T={T} />
                  </div>
                  <WhyCushion />
                </div>
              </ExpandBox>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2 — per-customer rate spread (the priced number + its distribution) */}
      {cone && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-sm">Per-customer rate · typical → priced → peak-stress</CardTitle>
                <CardDescription>the priced mean and the distribution behind it</CardDescription>
              </div>
              <InfoHint title="Typical · priced · peak-stress">
                <p>
                  We price at the <b>mean</b> across qualifying events. The <b>median</b> is the typical event
                  (outlier-resistant); the <b>max</b> is a peak-impact stress — everyone out at each event&rsquo;s peak,
                  not the single worst event.
                </p>
                <p>
                  How conservative that mean is, and where it thins by duration, is the <b>Posture</b> read above.
                </p>
              </InfoHint>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Typical event" sub="median" val={cone[0]} />
              <Stat label="Priced" sub="mean · charged" val={cone[1]} highlight />
              <Stat label="Peak-impact stress" sub="max" val={cone[2]} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3 — annual history (the raw evidence) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Annual qualifying outages · ≥{T}h / yr</CardTitle>
          <CardDescription>observed events per year — hover any bar for the count</CardDescription>
        </CardHeader>
        <CardContent>
          <EChart option={historyOpt} height={200} />
          <p className="text-muted-foreground/70 mt-1 text-xs">
            {years[0]}–{years[years.length - 1]} · {total} events over {years.length} years
            {odT != null && (
              <>
                {" · "}Var/Mean {odT}× —{" "}
                {odT > 1.5
                  ? "storms cluster, so the confidence band is year-to-year variance, not a tight Poisson interval"
                  : "low year-to-year spread"}
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, sub, val, highlight }: { label: string; sub: string; val: number; highlight?: boolean }) {
  return (
    <div className={cn("rounded-lg border px-3 py-2.5", highlight ? "border-primary bg-primary/5" : "border-border")}>
      <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">
        {rate(val)}
        <span className="text-muted-foreground text-xs font-normal"> /yr</span>
      </div>
      <div className="text-muted-foreground/70 text-[10px]">{sub}</div>
    </div>
  );
}
