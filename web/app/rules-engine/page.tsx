import type { Metadata } from "next";
import { RulesEngineView } from "@/components/rules-engine/rules-engine-view";

export const metadata: Metadata = { title: "Rules Engine" };

export default function RulesEnginePage() {
  return <RulesEngineView />;
}
