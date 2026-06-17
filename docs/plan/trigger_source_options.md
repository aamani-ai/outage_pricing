# Trigger Source Options for the Live Parametric Product

- **Status:** strategy / decision-framing doc — no implementation yet
- **First written:** 2026-06-16
- **Audience:** internal product + partner/LP conversations
- **Companion to:** [`trigger_source_implications.md`](trigger_source_implications.md) (pricing-vs-trigger architecture) and [`../dicsscssion/utility_oms_and_trigger_sources.md`](../dicsscssion/utility_oms_and_trigger_sources.md) (utility-OMS deep dive)

## Why this doc exists

A live parametric outage product needs a **trigger**: an objective signal that
says "an outage of duration ≥ T happened at the insured location," which fires
the payout. Choosing that source is a distinct, foundational decision — every
client, partner, and regulator will ask "what's your trigger, and why should we
trust it?" This doc lays out the full option space and a recommendation.

## The reframe that changes everything

**A trigger is not a pricing source.** They are different problems with different
best answers, and conflating them is the most common mistake:

| | Pricing source | Trigger source |
|---|---|---|
| Needs | **national, multi-year history** | **live signal at insured sites only** |
| Coverage bar | every county, 10+ years | the locations you actually write |
| Best answer | EAGLE-I (historical, county) | *(this doc)* |
| Grows with | the country | **your book** |

The consequence: "you'd have to deploy sensors everywhere" is a false objection.
A trigger only has to cover **insured sites**, and those are added one policy at a
time. Per-site approaches scale with the book, not the nation.

## The standard a parametric trigger must meet

A trigger index must be:

1. **Objective** — computed from data, not adjudicated.
2. **Independent / non-manipulable by any party with a stake in the *peril***
   — not just neutral between insurer and insured, but independent of the
   *utility whose outage causes the payout*.
3. **Auditable** — raw records retained for the policy + dispute window.
4. **Low basis risk** — the signal matches the insured's *actual* power status,
   not a proxy area.
5. **Timely** — detects and resolves within the contract's time resolution.

Dimension (2) is the one utility-sourced data scores *worst* on — but it is a
factor to **manage**, not an automatic disqualifier (see the utility option and
the "neutrality, honestly" note below).

## The options

### 1. Independent premise sensor network — PARTNER (e.g. Whisker Labs / Ting)

- **How:** rent an existing third-party sensor network already deployed in homes/businesses. (Ting is sold as a fire-prevention device; outage detection is a derived capability — so the hardware is already in the field.)
- **Neutral?** ✅ Third-party, tamper-resistant, independent of the utility.
- **Granularity:** premise (lowest basis risk).
- **Hardware:** none to deploy — you partner.
- **Cons:** coverage limited to where sensors already exist; commercial dependency on the network owner; per-reading cost.
- **Verdict:** **segment-proven primary trigger** — this is what Adaptive Insurance uses. Strongest default.

### 2. Deploy-your-own premise sensors

- **How:** ship a simple power-presence sensor to each insured site.
- **Neutral?** ✅ Third-party (you/your device, not the utility).
- **Granularity:** premise.
- **Hardware:** yours — logistics, battery/connectivity maintenance, install friction. (A power sensor must still phone home *during* an outage → needs cellular + independent power, like Ting does.)
- **Verdict:** full control, scales with the book, but the **logistics/maintenance burden is the real cost.** Use only if no partner network covers your footprint.

### 3. Customer-authorized AMI / smart-meter data (Green Button Connect)

- **How:** the **insured consents** to share their smart-meter data; AMI meters emit a "last gasp" signal on power loss.
- **Neutral?** ✅ The utility-neutrality problem **evaporates via customer consent** — the insured authorizes their own data.
- **Granularity:** **per-meter** (the best possible — it *is* the insured's power status).
- **Hardware:** none.
- **Cons:** requires the utility to have AMI + a working Green Button Connect / data-sharing path; data latency varies; not all utilities expose it.
- **Verdict:** **underrated sleeper option.** Where AMI + consent flow exists, it's per-meter truth with clean neutrality and no hardware. Evaluate seriously.

### 4. Connected-device heartbeat / IoT proxy

- **How:** watch devices already at the site (router, thermostat, alarm panel, smart-home hub) — they go silent when power drops.
- **Neutral?** ⚠️ Indirect — a silence could be an *internet* outage, not a *power* outage.
- **Granularity:** per-site.
- **Hardware:** none (reuses existing devices).
- **Verdict:** cheap and clever, but the power-vs-connectivity ambiguity makes it a **secondary/corroborating** signal, not a clean primary trigger.

### 5. Satellite night-lights (NASA VIIRS / Black Marble)

- **How:** satellite detects lit-vs-dark areas at night.
- **Neutral?** ✅✅ Fully independent (NASA), no commercial dependency.
- **Granularity:** coarse (~500 m), **night-only**, cloud-obscured.
- **Hardware:** none; national; free.
- **Verdict:** too coarse + night-only to be a **primary** trigger, but a free, fully-independent **corroborating** signal for large-area events.

### 6. Licensed aggregator (PowerOutage.US commercial)

- **How:** licensed feed of scraped utility-map data, live, sub-county.
- **Neutral?** ◑ Independent *aggregator*, but it ultimately reflects utility self-reported map data (inherits utility reporting quality).
- **Granularity:** city / per-outage (live API has OutageId + geometry).
- **Hardware:** none; national (licensed).
- **Cons:** duration is *derived* not delivered; sub-county not premise; basis risk vs the actual address; needs commercial-grade SLA/audit terms.
- **Verdict:** viable **national fallback / consensus input**, weaker on basis risk than a premise sensor.

### 7. Utility outage data (the operator's own record) — three access modes

The utility's OMS is the **authoritative record of what actually happened on its
grid** — the best raw truth. It comes in three very different access modes, and
they are not equally hard. Treating them as one "utility self-report" lump (and
calling it non-viable) is the mistake.

**7a · Scraped public outage map (DIY).**
- **How:** poll the utility's public outage map / address tool yourself.
- **Pros:** premise/area-level, live, free, no partner needed; the utility's own admitted status (defensible "your operator says you were out").
- **Cons:** ToS often restricts commercial/payout use; ~1,000+ different sites to integrate and maintain; anti-bot fragility; no SLA/audit by default.
- **Verdict:** **hard and legally fraught at national scale, but not impossible** — workable for a *specific* utility with permissive terms. The weak form of utility data.

**7b · Contracted / licensed utility feed (single-utility or via aggregator).**
- **How:** a formal data agreement with a utility for its OMS/AMI feed, or a license through an aggregator (PoUS, DataCapable) that already carries utility-provided shapes.
- **Pros:** best raw truth; premise/feeder granularity; a **contract** brings SLA, audit retention, and methodology-change notice — which is exactly what manages the neutrality concern; auditable records (arguably *more* auditable than a proprietary sensor network).
- **Cons:** per-utility business development; coverage grows utility-by-utility; still the operator's own report (manage via audit + consensus).
- **Verdict:** **strong** — the right way to use utility data. Best for a **utility-backed pilot market**, and the audit terms neutralize most of the independence objection.

**7c · Standardized national utility feed — ODIN (emerging).**
- **How:** the **Outage Data Initiative Nationwide (ODIN)**, led by ORNL + DOE Office of Electricity, is building a *common digital reporting standard* for utility-provided near-real-time outage data (county-level today).
- **Pros:** if it matures, it directly answers the "1,000 different sites" scale objection — one standard, utility-provided, with government backing (which strengthens auditability/defensibility).
- **Cons:** county-level today (not premise); coverage and adoption still growing; timeline uncertain.
- **Verdict:** **a track to watch** — could move utility data from "hard to scale" toward "standard and licensable." Needs a research note (below).

**Neutrality, honestly (applies to all of 7a–7c):** the utility is the party
whose failure triggers the payout, *and* it controls the "restored"
declaration a duration trigger hinges on — that's the real con. But it is
**manageable**, and the picture is more balanced than "fails neutrality":
- The utility has **no stake in the insurance contract** itself (doesn't care who gets paid) and **doesn't know which premises are insured** — so it cannot manipulate reporting *contract-specifically*; any bias is systemic, not targeted.
- The likely bias direction (utilities **under-report** to protect reliability metrics) is **conservative for the insurer** — fewer/shorter triggered events — which is the safe direction.
- Regulated utilities report under **PUC/regulatory oversight**, so reporting is not unconstrained self-interest.
- A **contract** (7b) or **multi-source consensus** (option 8) manages what remains.

### 8. Multi-source consensus

- **How:** trigger only when **two independent sources agree** (e.g. Ting + PoUS).
- **Neutral?** ✅✅ Cross-checks kill single-source manipulation and false positives.
- **Granularity:** the min of its inputs.
- **Verdict:** the **robustness architecture** a mature product likely adopts — defensible to regulators and reinsurers.

## The weakest form (not "non-viable," but the hardest)

The only option that is genuinely *hard to recommend* is **DIY-scraping public
utility maps at national scale** (7a) — and even that is an *execution* problem
(ToS, 1,000+ sites, no SLA), not a fundamental one. The same underlying utility
data becomes viable the moment you **license it** (7b, via aggregator),
**contract for it** (7b, single utility), or it gets **standardized** (7c, ODIN).
So the honest statement is: *self-scraping is the weak form; utility data itself
is very much in play* through the other access modes.

## The comparison

```
                      neutrality        granularity      hardware   scale path           role
sensor (partner)      ✅ third-party    premise          none       rent network         PRIMARY ✓
deploy sensors        ✅ third-party    premise          yours      grows with book      primary (if no partner)
AMI (Green Button)    ✅ via consent    per-meter        none       utility-by-utility   primary (evaluate) ✓
device heartbeat      ⚠️ indirect       per-site         reuse      per-site             secondary
satellite VIIRS       ✅✅ independent   coarse / night   none       national, free       corroborating
PoUS commercial       ◑ aggregator      city / per-outage none      national (licensed)  fallback / consensus
utility OMS — licensed ◑ manage-by-     premise/feeder   none       per-utility / aggr.  strong (pilot) ✓
  / contracted (7b)      contract
utility OMS — ODIN (7c) ◑ govt-backed    county (today)   none       national (emerging)  watch / research
utility map scraped (7a)◑ manage / ToS   premise/area     none       1,000+ sites (hard)  weak form, not dead
consensus             ✅✅              min of inputs    depends    hybrid               robustness layer
```
*(Utility modes share the same neutrality profile — the operator is the peril
party, but it's contract-blind, likely conservative-biased, and under regulatory
oversight; manage via contract + consensus rather than treating it as fatal.)*

## Recommendation / sequencing

1. **Primary:** partner with an **independent premise sensor network** (Ting-style) — premise-level + neutral + no deployment. Segment-proven.
2. **Evaluate in parallel:** **customer-authorized AMI (Green Button)** — per-meter, neutral via consent, no hardware.
3. **Robustness (mature product):** **multi-source consensus** (sensor + aggregator must agree).
4. **Corroborating:** satellite for large events.
5. **Strong for a utility-backed pilot:** a **contracted/licensed utility OMS feed (7b)** — best raw truth, premise-level, neutrality managed by the contract's audit terms.
6. **Watch:** **ODIN (7c)** standardization — could turn utility data into a national, licensable, government-backed feed; revisit as it matures.
7. **Weak form (not rejected, just hardest):** DIY-scraping public utility maps at national scale — an execution problem (ToS / scale), viable for a single permissive utility but not as a national primary.

## How this connects to the rest of the project

- **Pricing stays on EAGLE-I** (national history). The trigger is a *separate* layer — this doc is only about the trigger.
- **The bridge factor** in [`trigger_source_implications.md`](trigger_source_implications.md) calibrates the gap between the EAGLE-I-priced event frequency and whatever trigger source is chosen here.
- **Duration** from any of these is *derived*, and is a **location/site** duration, not per-customer — see the PoUS lab's deriving-duration note for the mechanics and the per-customer ceiling.

## Research notes / open questions

These are genuine unknowns to resolve before a vendor decision — flagged rather
than asserted:

1. **ODIN trajectory.** Coverage, granularity roadmap (does it go sub-county?),
   adoption rate, and licensing/commercial-use terms of the ORNL/DOE ODIN feed.
   This is the single biggest swing factor for utility data as a *national*
   trigger. Source to track: [ORNL ODIN](https://ornl.opendatasoft.com/explore/dataset/odin-real-time-outages-county/api/).
2. **Legal use of utility outage data for payouts.** How existing parametric /
   business-interruption products legally reference utility outage or restoration
   records as a trigger basis — is there precedent and standard contract language?
3. **State mandates.** Which states require utilities to publish standardized /
   API-accessible real-time outage data (and on what commercial terms).
4. **Aggregator payout-grade terms.** Whether PoUS / DataCapable will license
   their utility-shape feeds specifically for *payout determination* (vs
   situational awareness), with the SLA / audit / methodology-change clauses a
   trigger needs.
5. **Restoration-definition control.** For a duration trigger, how to contractually
   pin the "restored" definition so it isn't unilaterally set by the operator
   (e.g. require raw timestamped records, or a consensus rule).

## Caveats

- This is a **framing** doc, not a vendor selection. Each option needs its own commercial/technical diligence (SLA, audit, latency, coverage, cost).
- Neutrality and basis-risk are the two dimensions partners/regulators probe hardest — lead with those, but treat neutrality as a factor to **manage** (contract, consensus, regulatory backing), not a binary pass/fail.
- "Best raw truth" (utility) and "best trigger" (independent + premise) are different rankings — but they are **not mutually exclusive**: a contracted/consensus architecture can combine utility truth with independent verification.

## Cross-references

- [Trigger Source Implications](trigger_source_implications.md) — pricing-vs-trigger architecture + the bridge factor
- [Utility OMS and Trigger Sources](../dicsscssion/utility_oms_and_trigger_sources.md) — the utility-OMS deep dive
- [Competitive Landscape](../methodology/competitive_landscape.md) — Adaptive/Ting and why the segment uses sensors
- Green Button Connect My Data — https://www.greenbuttonalliance.org/green-button-connect-my-data-cmd
- NASA Black Marble / VIIRS nighttime lights — https://blackmarble.gsfc.nasa.gov/
- ODIN — Outage Data Initiative Nationwide (ORNL / DOE) — https://ornl.opendatasoft.com/explore/dataset/odin-real-time-outages-county/api/
