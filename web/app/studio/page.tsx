import type { Metadata } from "next";
import { StudioView } from "@/components/studio/studio-view";

export const metadata: Metadata = { title: "Underwriting Studio" };

export default function StudioPage() {
  return <StudioView />;
}
