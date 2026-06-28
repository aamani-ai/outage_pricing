import type { Metadata } from "next";
import { AnalyticsView } from "@/components/analytics/analytics-view";

export const metadata: Metadata = { title: "Analytics Studio" };

export default function AnalyticsPage() {
  return <AnalyticsView />;
}
