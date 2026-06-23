"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { useTheme } from "next-themes";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

/** Theme-aware palette for charts — keep in step with globals.css tokens. */
export function useChartColors() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return {
    dark,
    text: dark ? "#a1a1aa" : "#52525b",
    sub: dark ? "#71717a" : "#a1a1aa",
    axis: dark ? "#3f3f46" : "#e4e4e7",
    grid: dark ? "#27272a" : "#f4f4f5",
    bar: dark ? "#818cf8" : "#6366f1",
    barSoft: dark ? "#4c4f6b" : "#c7d2fe",
    barHover: dark ? "#a5b4fc" : "#4f46e5",
    loc: dark ? "#2dd4bf" : "#14b8a6",
    fwd: dark ? "#c084fc" : "#9333ea",
    tooltipBg: dark ? "#18181b" : "#ffffff",
    tooltipBorder: dark ? "#27272a" : "#e4e4e7",
    tooltipText: dark ? "#e4e4e7" : "#18181b",
    green: "#16a34a",
    amber: "#d97706",
    red: "#dc2626",
  };
}

/** Tooltip styling block to spread into any chart's `tooltip`. */
export function tooltipStyle(c: ReturnType<typeof useChartColors>) {
  return {
    backgroundColor: c.tooltipBg,
    borderColor: c.tooltipBorder,
    borderWidth: 1,
    textStyle: { color: c.tooltipText, fontSize: 12 },
    extraCssText: "box-shadow: 0 4px 16px rgba(0,0,0,0.12); border-radius: 8px;",
  };
}

/** Thin React wrapper over ECharts: init once, setOption on change, resize with container. */
export function EChart({
  option,
  className,
  style,
  height = 200,
}: {
  option: EChartsOption;
  className?: string;
  style?: CSSProperties;
  height?: number | string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={ref} className={className} style={{ height, width: "100%", ...style }} />;
}
