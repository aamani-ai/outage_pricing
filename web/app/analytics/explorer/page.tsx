import type { Metadata } from "next";
import { CountyExplorerView } from "@/components/analytics/county-explorer-view";

export const metadata: Metadata = { title: "County explorer" };

export default function CountyExplorerPage() {
  return <CountyExplorerView />;
}
