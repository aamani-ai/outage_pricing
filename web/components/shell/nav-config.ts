import { Bookmark, Layers, type LucideIcon, MapPin, Settings as SettingsIcon } from "lucide-react";

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
 * Grouped, action-oriented nav (the InfraSure shell). Labels in the audience's words.
 * The Studio's sub-modules (Price Breakdown / Baseline / County Clustering / Adjusters) live as
 * tabs inside Risk explorer — not as separate nav items. Settings (global loadings + data source)
 * sits under the Studio, not as its own section.
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
    items: [
      { label: "Risk explorer", href: "/studio", icon: Layers },
      { label: "Settings", href: "/settings", icon: SettingsIcon },
    ],
  },
];
