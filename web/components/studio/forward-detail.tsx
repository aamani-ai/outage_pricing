"use client";

import type { EChartsOption } from "echarts";
import { EChart, useChartColors, tooltipStyle } from "@/components/charts/echart";
import type { ForwardRead, CountyStudio } from "@/components/studio/shared";

/** plain-language name for each forecast method (the underwriter shouldn't need the code name). */
const METHOD: Record<string, string> = {
  flat: "long-run average",
  recent_k3: "recent 3-year level",
  recent_k5: "recent 5-year level",
  wtd_recent: "recency-weighted level",
  capped_lin: "recent upward trend (capped)",
  persist: "last observed year",
};

/**
 * The statistical forward-factor detail — opened from the Forward row in Adjusters.
 * Decision-read first (regime → method → factor), then the annual series with the long-run mean vs the
 * next-year forecast, then climate/grid (the challengers) and honest maturity. No "shadow": this is the
 * forward component of the one composed premium.
 */
export function ForwardDetail({
  fwd,
  studio,
  T,
  county,
}: {
  fwd: ForwardRead;
  studio: CountyStudio | null;
  T: number;
  county: string;
}) {
  const c = useChartColors();
  const factor = fwd.factorByT[String(T)] ?? 1;
  const d = fwd.detailByT[String(T)];
  const method = METHOD[fwd.expert] ?? fwd.expert;
  const move = Math.round((factor - 1) * 100);
  const acting = factor > 1.005;

  const years = studio?.years ?? [];
  const counts = studio?.perT?.[String(T)] ?? [];
  const series: EChartsOption | null =
    years.length && counts.length && d
      ? {
          grid: { left: 6, right: 14, top: 26, bottom: 20, containLabel: true },
          legend: { data: ["annual events"], textStyle: { color: c.text }, top: 0, right: 0, itemWidth: 10, itemHeight: 10 },
          tooltip: { trigger: "axis", ...tooltipStyle(c) },
          xAxis: { type: "category", data: years.map(String), axisTick: { show: false }, axisLine: { lineStyle: { color: c.axis } }, axisLabel: { color: c.text } },
          yAxis: { type: "value", splitLine: { lineStyle: { color: c.grid } }, axisLabel: { color: c.sub } },
          series: [
            {
              name: "annual events",
              type: "bar",
              barWidth: "55%",
              itemStyle: { color: c.barSoft },
              data: counts,
              markLine: {
                silent: true,
                symbol: "none",
                data: [
                  { yAxis: d.lamFull, lineStyle: { color: c.sub, type: "dashed" }, label: { formatter: "long-run mean", color: c.sub, fontSize: 9, position: "insideStartTop" } },
                  { yAxis: d.forecast, lineStyle: { color: c.fwd, type: "solid" }, label: { formatter: "forecast", color: c.fwd, fontSize: 9, position: "insideEndTop" } },
                ],
              },
            },
          ],
        }
      : null;

  return (
    <div className="space-y-4 text-sm">
      {/* the decision read */}
      <div>
        <div className="text-foreground/80 font-medium">Forward view for {county}</div>
        <p className="text-muted-foreground mt-1">
          This county reads <span className="text-foreground capitalize">{fwd.regime}</span> ({fwd.conf} confidence). Its own
          outage history forecasts next year by the <span className="text-foreground">{method}</span>
          {d && (
            <>
              {" "}— about <span className="text-foreground tabular-nums">{Math.round(d.forecast)}</span> events/yr vs a long-run mean of{" "}
              <span className="tabular-nums">{Math.round(d.lamFull)}</span>
            </>
          )}
          .
        </p>
        <p className="text-muted-foreground mt-1">
          → forward factor <span className="text-foreground tabular-nums">×{factor.toFixed(2)}</span>{" "}
          {acting ? (
            <>
              (<span className="text-foreground tabular-nums">{move}%</span> above the county&rsquo;s long-run mean)
            </>
          ) : (
            <>(holds at the mean — recent years aren&rsquo;t above it, or the evidence is thin)</>
          )}
        </p>
      </div>

      {/* the annual series: mean vs next-year forecast */}
      {series && (
        <div>
          <div className="text-muted-foreground/80 mb-1 text-xs">annual qualifying events (≥{T}h) · long-run mean vs next-year forecast</div>
          <EChart option={series} height={150} />
        </div>
      )}

      {/* climate + grid — the challengers (box + label carry it; no emoji, no colour literal) */}
      <div className="border-border/60 bg-muted/30 text-muted-foreground rounded-md border p-3 text-xs leading-relaxed">
        <span className="text-foreground/80 font-medium">climate + grid · ×1.00 (not yet wired). </span>
        Weather/climate and utility-reliability signals layer on top later — each must beat this statistical baseline before it earns a place.
      </div>

      {/* maturity — honest, split from the factor */}
      <p className="text-muted-foreground/70 text-xs leading-relaxed">
        From this county&rsquo;s own EAGLE-I qualifying-event history. <span className="text-foreground/70">One-directional</span> — it raises the
        forecast where recent years run above the long-run mean and holds otherwise (it never lowers the premium); credibility-weighted
        {d && <> (×{d.cred.toFixed(2)} here)</>} and capped at +50%. Method chosen per behaviour regime. Assumptions A018.
      </p>
    </div>
  );
}
