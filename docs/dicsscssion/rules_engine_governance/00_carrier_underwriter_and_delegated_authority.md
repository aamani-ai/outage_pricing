# 00 — Carrier vs. Underwriter, and Delegated Authority

**Type:** primer (domain learning that grounds a design decision)
**Status:** reference — written to ground the Settings → Rules Engine redesign
**Why this exists:** the dashboard's three sections (Pricing · Underwriting Studio · Rules Engine)
are not arbitrary UI groupings — they mirror how risk actually gets carried in the insurance
industry. You can't decide *which control lives where* until you know *who owns what and why.*
This is the concept; the design decisions it feeds live in the rest of this folder.

> Sibling fundamentals: [`insurance_basics/05_reinsurance_and_capital.md`](../../extra/outage_modeling_us/ideas/insurance_basics/05_reinsurance_and_capital.md)
> (where the capital comes from) and [`insurance_basics/06_distribution_and_regulatory.md`](../../extra/outage_modeling_us/ideas/insurance_basics/06_distribution_and_regulatory.md)
> (how it's sold + the MGA legal frame). This doc is the missing middle: the carrier ↔ underwriter contract.

---

## The one-paragraph version

A **carrier** has the capital and the license — it *carries* the risk and pays the claims. An
**underwriter** decides which risks to accept and at what price. When a carrier lets an underwriter
bind policies on its behalf without approving each one, that underwriter is an **MGA** operating under
**delegated (binding) authority**. The authority is not unlimited — it comes with a **rules table**: the
*bounds* the underwriter must stay inside. Inside the bounds, the underwriter uses judgment to pick the
actual numbers; outside the bounds, it must **refer** back to the carrier. **InfraSure is the
underwriter/MGA.** The rules table is what our dashboard calls the **Rules Engine.**

---

## The chain of risk

Premium flows up; risk and payouts flow back down. Everyone in the middle takes a cut for the job they do.

```text
   POLICYHOLDER            energy customer / SMB — buys cover, pays premium, gets paid on outage ≥ T
        │  premium ▲   ▼ payout
   DISTRIBUTION           energy supplier / broker / embedded partner — sells it, takes commission
        │
   UNDERWRITER (MGA)  =  INFRASURE — designs + PRICES the product, selects risks, binds policies
        │                            on the carrier's behalf. Earns a fee. Does NOT hold the capital.
        │  ← delegated authority, exercised *within the rules table*
   CARRIER / CAPACITY    the (re)insurer with the balance sheet + license. Holds the capital,
   PROVIDER              ultimately PAYS the claims, eats the loss if claims > premium.
                         Therefore sets the RULES (the bounds) InfraSure must stay inside.
```

---

## The four words, defined

```text
  CARRIER / CAPACITY PROVIDER
     has the capital + the license. "Carries" the risk: if claims exceed premium, the carrier loses money.
     "Capacity" = how much risk they will let you write on their paper. Often a fronting carrier with a
     reinsurer behind it (see basics 05). This is the balance sheet.

  TO UNDERWRITE
     to evaluate a risk, price it, and agree to cover it. (An underwriter literally wrote their name
     UNDER the risk on the old Lloyd's slips, accepting a share.) The underwriter is whoever accepts
     and prices the risk — the pricing + selection brain, not necessarily the capital.

  MGA (Managing General Agent)
     an underwriter that a carrier has DELEGATED authority to, so it can bind policies without asking
     the carrier each time. InfraSure is the MGA. (MGA registration is a real per-state filing — basics 06.)

  DELEGATED / BINDING AUTHORITY
     the contract: "you may bind policies for me, as long as you stay inside these rules." The rules =
     the RULES TABLE (a.k.a. underwriting guidelines + rating table). Pricing must follow the carrier's
     rating rules; risks outside the guidelines must be REFERRED back to the carrier.
```

---

## The key idea: rules are BOUNDS, the underwriter picks VALUES

This is the insight the whole Rules-Engine design hangs on, so it gets its own section.

The carrier eats the big downside, so it does **not** hand you the exact price — it hands you
**guardrails** that protect its capital. *Within* those guardrails, you (the underwriter) do the actual
pricing work and pick the real numbers. Step outside, and you must refer.

```text
                   CARRIER  (Rules Engine)            UNDERWRITER  (Underwriting Studio)
                   the BOUND — locked                 the VALUE — chosen within the bound
  ─────────────────────────────────────────────────────────────────────────────────────
  Margin           target margin ≥ X%   (a floor)  →  the chosen target margin (≥ floor)
  Expense          expense allowance ≤ Y% (a cap)  →  the chosen expense ratio (≤ cap)
  Discretion       max manual load ±L%             →  the actual per-county load + reason
  Eligibility      excluded territories             →  (cannot override — can only refer / decline)
  Limit            max line / location, min premium →  the quoted payout (within the cap)
```

Read the table left-to-right: the carrier sets the *edge of the box*; the underwriter moves *inside the
box*. So a parameter like the expense ratio is **not** "owned" wholesale by one side — the carrier caps
it, InfraSure sets the working value beneath the cap. Most rating parameters work this way.

---

## Why this asymmetry exists (the intuition)

```text
  WHO HOLDS THE DOWNSIDE sets the conservative defaults.

  carrier   → loses real capital if the book runs hot → wants FLOORS on margin, CAPS on expense + line
              size, hard eligibility limits, and a referral tripwire. Conservative by structure.
  underwriter (InfraSure) → earns a fee for good selection + pricing → works the levers inside the box
              to write profitable business the carrier is happy to have carried.
```

It is the same "who bears the cost of being wrong" logic as the
[`model_to_the_consequence`](../../principles/model_to_the_consequence.md) principle — the party on the
hook for the expensive error gets to set the conservative guardrail.

---

## How it maps to the dashboard (three sections = three actors)

```text
   ACTOR                         DASHBOARD SECTION       MUTABILITY
   ───────────────────────────────────────────────────────────────────────────────────
   CARRIER / capacity provider   Rules Engine            LOCKED — uploaded; change = governance process
   UNDERWRITER / InfraSure       Underwriting Studio     ADJUSTABLE — pick values within the bounds
   POLICYHOLDER / distribution   Pricing                 READ-ONLY — the public quote that results
```

This is the governance model agreed in the 2026-06-25 Data & Modeling Framework Sync (Prashant): what we
were calling **Settings** is, in insurance terms, the **rules engine / rules table** the capacity
provider hands you — *"the table they want you to follow… that nobody can change"* — while the
Underwriting Studio holds *"other factors that we can actually change."*

A consequence worth stating plainly (and a correction to a literal reading of that meeting): a
**manual load is an underwriter lever, not a carrier rule** — it is discretion, the thing we change. So
it belongs in the **Studio**, while the **limit on** that discretion (the max ± load) belongs in the
Rules Engine. The earlier instinct to "move manual load into Settings" conflates the *bound* with the
*value*.

---

## An honest-scaffold note

Today no carrier has handed InfraSure a rules table — we are pre-capacity. So the Rules Engine should
render the **full shape** of a binding-authority rules table (eligibility · limits · rating bounds ·
triggers allowed · referral · reporting) with each field marked **real / house-default / scaffold**,
and say plainly *"no carrier rules table loaded — showing InfraSure house defaults."* Showing a locked,
authoritative-looking "carrier rules" panel when nothing is uploaded would violate
[`communicate_to_share`](../../principles/communicate_to_share.md). Scaffold honestly; fill it when a
capacity provider is signed.

---

## Glossary quick-reference

| Term | Plain meaning |
|---|---|
| Carrier / capacity provider | Holds the capital + license; pays the claims; sets the rules. |
| Capacity | How much risk the carrier lets you write on its paper. |
| Underwriter | Whoever evaluates, prices, and accepts a risk. |
| MGA | An underwriter with delegated authority to bind on a carrier's behalf (InfraSure). |
| Binding / delegated authority | The contract letting the MGA bind within stated rules. |
| Rules table / rules engine | The bounds: eligibility, limits, rating constraints, referral triggers. |
| Bordereaux | The periodic report (policies + claims) the MGA owes the carrier. |
| Referral | Sending an out-of-guidelines risk back to the carrier for a decision. |
| Fronting carrier | A licensed carrier that issues the paper; reinsurer carries most of the risk (basics 05). |

---

## Sources

- Self Insurance Market — *Setting up a Delegated Binding Authority Arrangement*: https://selfinsurancemarket.com/articles/setting-up-a-delegated-authority-insurance-program
- Regure — *What is Binding Authority?*: https://www.getregure.com/glossary/binding-authority/ · *Delegated Authority*: https://www.getregure.com/glossary/delegated-authority/
- Lloyd's — *Code of Practice: Delegated Underwriting*: https://assets.lloyds.com/assets/pdf-code-of-practice-delegated-underwriting-v2/1/pdf-code-of-practice-delegated-underwriting-v2.pdf
- IRMI Insurance Glossary (MGA, fronting, surplus lines): https://www.irmi.com/glossary
- Internal: 2026-06-25 Data & Modeling Framework Sync (Prashant — "rules table / rules engine"); [`insurance_basics/`](../../extra/outage_modeling_us/ideas/insurance_basics/) 05–06.
