import { Bookmark, Layers, type LucideIcon, MapPin, ScrollText } from "lucide-react";

export interface NavItem {
  label: string;
  href?: string;
  icon: LucideIcon;
  soon?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Grouped, action-oriented nav (the InfraSure shell) — three peer sections mirroring the MGA
 * governance model (see dicsscssion/rules_engine_governance/00): Pricing (policyholder/outward) ·
 * Underwriting Studio (the underwriter's deep-dive + levers) · Rules Engine (the carrier's locked
 * rules table). The Studio's sub-modules (Price Breakdown / Baseline / County Clustering / Location /
 * Forecast / Adjustments) live as tabs inside Risk explorer — not as separate nav items.
 */
export const NAV: NavGroup[] = [
  {
    label: "Pricing",
    items: [
      { label: "Quote an address", href: "/", icon: MapPin },
      { label: "Saved quotes", icon: Bookmark, soon: true },
    ],
  },
  {
    label: "Underwriting Studio",
    items: [{ label: "Risk explorer", href: "/studio", icon: Layers }],
  },
  {
    label: "Rules Engine",
    items: [{ label: "Rules table", href: "/rules-engine", icon: ScrollText }],
  },
];
