import type { Metadata } from "next";
import { CountyExplorerView } from "@/components/analytics/county-explorer-view";

export const metadata: Metadata = { title: "County explorer" };

/** `?fips=` lets the Analytics QC tables / map deep-link straight into a county dossier (and makes
 *  the view shareable). searchParams is async in Next 16. */
export default async function CountyExplorerPage({
  searchParams,
}: {
  searchParams: Promise<{ fips?: string | string[] }>;
}) {
  const sp = await searchParams;
  const fips = Array.isArray(sp.fips) ? sp.fips[0] : sp.fips;
  return <CountyExplorerView initialFips={fips} />;
}
