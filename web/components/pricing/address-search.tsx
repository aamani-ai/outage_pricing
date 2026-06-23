"use client";

import { useEffect, useRef, useState } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Building, Building2, Home, Loader2, type LucideIcon, MapPin, Search, Signpost } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/components/ui/utils";
import { api } from "@/lib/base-path";
import COUNTIES from "@/lib/data/counties-by-state.json";

const COUNTY_BY_STATE = COUNTIES as Record<string, string[]>;

export interface ResolvedLocation {
  lon: number;
  lat: number;
  label: string;
}

interface Suggestion {
  id: string;
  name: string;
  place: string;
  type: string;
}

type FilterType = "all" | "address" | "poi";

const TYPE_PARAM: Record<FilterType, string> = { all: "", address: "address,street", poi: "poi" };

const STATES: Array<[string, string]> = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
  ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
  ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
  ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
];
const STATE_NAME: Record<string, string> = Object.fromEntries(STATES);

/** Color + icon by place type — scannable like a fuel-type legend. */
function typeStyle(t: string): { Icon: LucideIcon; color: string; label: string } {
  switch (t) {
    case "poi":
      return { Icon: Building2, color: "text-violet-500", label: "business" };
    case "address":
      return { Icon: Home, color: "text-emerald-500", label: "address" };
    case "street":
      return { Icon: Signpost, color: "text-sky-500", label: "street" };
    case "place":
    case "locality":
    case "neighborhood":
    case "district":
      return { Icon: Building, color: "text-amber-500", label: "place" };
    case "postcode":
      return { Icon: MapPin, color: "text-rose-500", label: "zip" };
    default:
      return { Icon: MapPin, color: "text-muted-foreground", label: t || "place" };
  }
}

const fieldCls =
  "bg-card border-border h-9 min-w-0 flex-1 rounded-lg border px-2.5 text-sm font-medium outline-none transition-colors";

/**
 * Address / business autocomplete via the Mapbox Search Box API (proxied through
 * /api/geocode). cmdk keyboard nav; results we supply. Debounced, abortable,
 * session-scoped, color-coded, quiet after select. Filters: type · state · county
 * (county cascades from our real priced coverage) — laid out to fill the bar.
 */
export function AddressSearch({
  onResolve,
  autoFocus,
}: {
  onResolve: (loc: ResolvedLocation) => void;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [ftype, setFtype] = useState<FilterType>("all");
  const [stateCode, setStateCode] = useState("");
  const [county, setCounty] = useState("");
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const session = useRef("");
  if (!session.current) session.current = crypto.randomUUID();
  const suppress = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (suppress.current) {
      suppress.current = false;
      setSugs([]);
      setLoading(false);
      return;
    }
    if (q.trim().length < 3) {
      setSugs([]);
      setLoading(false);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      abort.current?.abort();
      const ac = new AbortController();
      abort.current = ac;
      setLoading(true);
      try {
        const scope = [county, stateCode ? STATE_NAME[stateCode] : ""].filter(Boolean).join(", ");
        const queryText = scope ? `${q}, ${scope}` : q;
        const typesParam = TYPE_PARAM[ftype] ? `&types=${encodeURIComponent(TYPE_PARAM[ftype])}` : "";
        const r = await fetch(
          api(`/api/geocode?q=${encodeURIComponent(queryText)}&session=${session.current}${typesParam}`),
          { signal: ac.signal },
        );
        const j = (await r.json()) as { suggestions?: Array<Record<string, any>> };
        const out: Suggestion[] = [];
        for (const s of j.suggestions ?? []) {
          const id = s.mapbox_id as unknown;
          const name = (s.name ?? s.full_address) as unknown;
          if (typeof id === "string" && typeof name === "string") {
            out.push({
              id,
              name,
              place: (s.place_formatted ?? s.full_address ?? "") as string,
              type: (s.feature_type ?? "address") as string,
            });
          }
        }
        setSugs(out);
        setOpen(true);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setSugs([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q, ftype, stateCode, county]);

  async function choose(s: Suggestion) {
    suppress.current = true;
    setOpen(false);
    setSugs([]);
    // interim: show the place, never the user's raw typed text
    setQ(s.place || s.name);
    try {
      const r = await fetch(api(`/api/geocode?id=${encodeURIComponent(s.id)}&session=${session.current}`));
      const j = (await r.json()) as { features?: Array<Record<string, any>> };
      const f = j.features?.[0];
      const coords = f?.geometry?.coordinates as unknown;
      if (Array.isArray(coords) && typeof coords[0] === "number" && typeof coords[1] === "number") {
        const label = (f?.properties?.full_address ?? f?.properties?.name ?? s.place ?? s.name) as string;
        onResolve({ lon: coords[0], lat: coords[1], label });
        // reflect the resolved location in the box (suppress re-search)
        suppress.current = true;
        setQ(label);
      }
    } catch {
      /* ignore — user can retry */
    }
    session.current = crypto.randomUUID();
  }

  const counties = stateCode ? (COUNTY_BY_STATE[stateCode] ?? []) : [];

  return (
    <div>
      {/* filters — fill the bar; county cascades from our real priced coverage */}
      <div className="mb-2 flex items-center gap-2 text-left">
        <select
          aria-label="Result type"
          value={ftype}
          onChange={(e) => setFtype(e.target.value as FilterType)}
          className={cn(fieldCls, "text-muted-foreground hover:text-foreground cursor-pointer")}
        >
          <option value="all">All places</option>
          <option value="address">Addresses</option>
          <option value="poi">Businesses</option>
        </select>
        <select
          aria-label="State"
          value={stateCode}
          onChange={(e) => {
            setStateCode(e.target.value);
            setCounty("");
          }}
          className={cn(fieldCls, "text-muted-foreground hover:text-foreground cursor-pointer")}
        >
          <option value="">Any state</option>
          {STATES.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="County"
          value={county}
          onChange={(e) => setCounty(e.target.value)}
          disabled={!stateCode}
          className={cn(fieldCls, "text-muted-foreground hover:text-foreground cursor-pointer disabled:cursor-not-allowed disabled:opacity-50")}
        >
          <option value="">{stateCode ? "All counties" : "County"}</option>
          {counties.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <Command
        shouldFilter={false}
        className="relative overflow-visible"
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          if (sugs.length) setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 140);
        }}
      >
        <div className="bg-card border-border focus-within:ring-ring/60 flex h-12 items-center gap-2.5 rounded-lg border px-3.5 text-left shadow-sm focus-within:ring-2">
          <Search className="text-muted-foreground size-4 shrink-0" />
          <CommandPrimitive.Input
            value={q}
            onValueChange={setQ}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus={autoFocus}
            placeholder={ftype === "poi" ? "Search a business…" : "Search an address or business…"}
            className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none"
          />
          {loading && <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" />}
        </div>

        {open && q.trim().length >= 3 && (
          <div className="bg-card absolute left-0 top-full z-30 mt-1 w-full overflow-hidden rounded-lg border shadow-lg">
            <CommandList>
              {sugs.length === 0 ? (
                <CommandEmpty>{loading ? "Searching…" : "No matches."}</CommandEmpty>
              ) : (
                <CommandGroup>
                  {sugs.map((s) => {
                    const ts = typeStyle(s.type);
                    const Icon = ts.Icon;
                    return (
                      <CommandItem key={s.id} value={s.id} onSelect={() => choose(s)}>
                        <Icon className={cn("mt-0.5 size-4 shrink-0", ts.color)} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{s.name}</span>
                          {s.place && <span className="text-muted-foreground block truncate text-xs">{s.place}</span>}
                        </span>
                        <span className="text-muted-foreground/60 mt-0.5 shrink-0 text-[10px] uppercase tracking-wide">
                          {ts.label}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </div>
        )}
      </Command>
    </div>
  );
}
