"use client";

import type { EChartsOption } from "echarts";
import { EChart, useChartColors, tooltipStyle } from "@/components/charts/echart";
import { ReadRow, SubLabel } from "@/components/studio/read-row";
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
 * The statistical forward-factor detail — opened from the Forecast factor row in the Forecast tab.
 * Decision-read first (regime → method → factor), then the annual series with the long-run mean vs the
 * next-year forecast, then honest maturity. This is the statistical frequency expert — it governs the
 * forward factor unless the router picks the weather challenger for this county. (Climate/Weather + Grid
 * live as their own cards in the Forecast tab; the chosen expert is the one that prices.)
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
  const d = fwd.detailByT[String(T)];
  const method = METHOD[fwd.expert] ?? fwd.expert;

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
    <div className="space-y-5 text-sm">
      {/* the decision read — scannable (the factor + $ effect lead in the headline above) */}
      <div>
        <SubLabel>Forward view for {county}</SubLabel>
        <div className="space-y-1.5">
          <ReadRow label="Regime">
            <span className="text-foreground capitalize">{fwd.regime}</span> · {fwd.conf} confidence
          </ReadRow>
          <ReadRow label="Method">
            <span className="text-foreground">{method}</span>
          </ReadRow>
          {d && (
            <ReadRow label="Forecast">
              ~<span className="text-foreground tabular-nums">{Math.round(d.forecast)}</span> events/yr · vs long-run mean{" "}
              <span className="tabular-nums">{Math.round(d.lamFull)}</span>
            </ReadRow>
          )}
        </div>
      </div>

      {/* the annual series: mean vs next-year forecast */}
      {series && (
        <div>
          <SubLabel>Annual qualifying events ≥{T}h · mean vs next-year forecast</SubLabel>
          <EChart option={series} height={160} />
        </div>
      )}

      {/* maturity — honest, split from the factor */}
      <p className="text-muted-foreground/70 text-xs leading-relaxed">
        From this county&rsquo;s own EAGLE-I qualifying-event history. <span className="text-foreground/70">One-directional</span> — it raises the
        forecast where recent years run above the long-run mean and holds otherwise (it never lowers the premium); credibility-weighted
        {d && <> (×{d.cred.toFixed(2)} here)</>} and capped at +50%. Method chosen per behaviour regime. Assumption A020.
      </p>
    </div>
  );
}
