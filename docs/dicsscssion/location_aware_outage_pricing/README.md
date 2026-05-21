# Location-Aware Outage Pricing Discussion

This folder is for the fundamental discussion we need before changing pricing:

```text
Can a county-level outage history support a location-based policy?
```

The answer is not a simple yes/no. EAGLE-I is strong for historical national
coverage, but its raw grain is county-level snapshots. A location-based policy
needs a more local trigger, or at least a documented bridge between county
history and local outage probability.

## Files

| File | Purpose |
|---|---|
| `01_problem_framing.md` | First discussion note: what spatial grain we have, what a location-based policy needs, and why this can affect pricing. |
| `02_research_backlog.md` | Questions and research tasks before we redesign pricing or trigger logic. |

## Current Working View

Keep these concepts separate:

```text
historical pricing source  = EAGLE-I county snapshots/events
live payout trigger source = OMS, sensor network, utility map, or licensed outage oracle
policy exposure location   = insured building/address/asset
```

The risk is treating the county event as if it were the policy-location event.
That can overprice some locations, underprice others, and make short-trigger
premiums look commercially strange.

## Near-Term Goal

Use this folder to decide the right v1 architecture before implementing:

1. what spatial level the product promises;
2. what data source can actually support that promise;
3. how county history should be adjusted for a specific policy location;
4. which parts belong in pricing, trigger validation, underwriting, and data
   enrichment.
