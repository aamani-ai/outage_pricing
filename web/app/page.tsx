import type { Metadata } from "next";
import { PricingView } from "@/components/pricing/pricing-view";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return <PricingView />;
}
