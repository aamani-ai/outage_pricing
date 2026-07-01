/**
 * Server-side WEATHER challenger reader (Step 05 — the "climate/weather" slot in FORWARD).
 * Reads the artifact promoted by build_data.py from
 * notebooks/05_forward_regime/weather_vs_stat_routing/outputs/weather_factor.json.
 *
 * This is Sarasi's EOF-XGB annual event-count forecast expressed as a forward factor (same one-directional
 * / credibility-shrunk / capped construction as the statistical factor) plus the per-county routing verdict
 * from the 2023–25 backtest. A per-county router picks the better forecast: in the 16 `weather`-routed
 * counties the weather factor GOVERNS the composed forward and prices (see routedForward in lib/pricing);
 * elsewhere the statistical factor governs and this is shown as the challenger the router didn't pick. No
 * shadow — the internal dashboard shows the final premium. Coverage is Northeast-only (Sarasi's model
 * scope); non-NE counties return null. Keep SERVER-ONLY (the API route).
 */
import data from "./forward/weather_factor.json";

/** How a county is routed by the weather backtest. */
export type WeatherRoute = "weather" | "statistical" | "excluded";

export interface WeatherReadT {
  /** the weather forward factor (≥1.0, one-directional); governs the price where route === "weather"
   *  and the trigger is covered. null if uncomputable. */
  weatherFactor: number | null;
  /** XGB point forecast of next-year ≥T county event count, + its 90% band. */
  weatherMean: number;
  weatherP5: number;
  weatherP95: number;
  /** the statistical factor for the same T (the routed alternative), for side-by-side. */
  statFactor: number | null;
  /** the long-run baseline mean the factors are expressed against. */
  lamFull: number | null;
}

export interface WeatherRead {
  /** weather governs the price · challenger the router didn't pick · excluded (chronic-grid cluster). */
  route: WeatherRoute;
  /** Sarasi's cluster label — NE_good (weather-scored) or NE_bad (chronic-grid, excluded). */
  cluster: string;
  countyName: string;
  state: string;
  /** plain-language reason for the route, grounded in the backtest WAPE. */
  why: string;
  /** per trigger T. */
  byT: Record<string, WeatherReadT>;
}

type Raw = Record<
  string,
  {
    route: WeatherRoute;
    cluster: string;
    county_name: string;
    state: string;
    why: string;
    T: Record<
      string,
      {
        weather_factor: number | null;
        weather_mean: number;
        weather_p5: number;
        weather_p95: number;
        stat_factor: number | null;
        lam_full: number | null;
      }
    >;
  }
>;
const WX = data as unknown as Raw;

/** county FIPS (5-digit) → its weather read, or null if the county is outside the weather model's scope. */
export function getWeather(fips: string): WeatherRead | null {
  const r = WX[fips];
  if (!r) return null;
  const byT: Record<string, WeatherReadT> = {};
  for (const [t, d] of Object.entries(r.T)) {
    byT[t] = {
      weatherFactor: d.weather_factor,
      weatherMean: d.weather_mean,
      weatherP5: d.weather_p5,
      weatherP95: d.weather_p95,
      statFactor: d.stat_factor,
      lamFull: d.lam_full,
    };
  }
  return { route: r.route, cluster: r.cluster, countyName: r.county_name, state: r.state, why: r.why, byT };
}
