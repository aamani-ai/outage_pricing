"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChart, tooltipStyle, useChartColors } from "@/components/charts/echart";
import type { AnalyticsSummary } from "@/lib/analytics/types";

const usd0 = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const NB = 24; // log-spaced bins

/** Premium distribution across all priced counties — log-binned histogram with p10/median/p90 markers. */
export function PremiumDistribution({ premiums, summary }: { premiums: number[]; summary: AnalyticsSummary }) {
  const c = useChartColors();

  const opt = useMemo<EChartsOption>(() => {
    // clamp the domain to ~p99 so a handful of data-artifact outliers don't flatten the bulk;
    // anything above piles into the top bin (and is surfaced in the QC high-watch regardless).
    const sorted = [...premiums].sort((a, b) => a - b);
    const q99 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * 0.99))]! : summary.max;
    const min = Math.max(1, summary.min);
    const max = Math.max(min * 1.0001, q99);
    const lmin = Math.log10(min);
    const lmax = Math.log10(max);
    const span = lmax - lmin || 1;

    const binOf = (v: number) => {
      const b = Math.floor(((Math.log10(Math.max(v, min)) - lmin) / span) * NB);
      return Math.min(NB - 1, Math.max(0, b));
    };

    const counts = new Array(NB).fill(0);
    for (const p of premiums) counts[binOf(p)]++;

    // geometric center of each bin → $ label
    const labels = Array.from({ length: NB }, (_, i) => {
      const a = Math.pow(10, lmin + (span * i) / NB);
      const b = Math.pow(10, lmin + (span * (i + 1)) / NB);
      return usd0(Math.sqrt(a * b));
    });

    const mark = (v: number, name: string, color: string, pos: "insideStartTop" | "insideMiddleTop" | "insideEndTop") => ({
      xAxis: binOf(v),
      lineStyle: { color, type: "dashed" as const, width: name === "median" ? 2 : 1 },
      label: { formatter: `${name}\n${usd0(v)}`, color, fontSize: 9, position: pos },
    });

    return {
      grid: { left: 6, right: 14, top: 28, bottom: 26, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        valueFormatter: (v) => `${Number(v)} counties`,
        ...tooltipStyle(c),
      },
      xAxis: {
        type: "category",
        data: labels,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: c.axis } },
        axisLabel: {
          color: c.sub,
          fontSize: 9,
          interval: (i: number) => i % 4 === 0,
          hideOverlap: true,
        },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: c.sub, fontSize: 10 },
        splitLine: { lineStyle: { color: c.grid } },
      },
      series: [
        {
          type: "bar",
          barWidth: "92%",
          data: counts,
          itemStyle: { color: c.bar, borderRadius: [2, 2, 0, 0] },
          emphasis: { itemStyle: { color: c.barHover } },
          markLine: {
            silent: true,
            symbol: "none",
            data: [
              mark(summary.p10, "p10", c.sub, "insideStartTop"),
              mark(summary.median, "median", c.text, "insideMiddleTop"),
              mark(summary.p90, "p90", c.sub, "insideEndTop"),
            ],
          },
        },
      ],
    };
  }, [c, premiums, summary]);

  return <EChart option={opt} height={240} />;
}
