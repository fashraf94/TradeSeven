# FantasyTrades Voice Layer Product Stance — Addendum A

**Companion to:** FANTASYTRADES_VOICE_LAYER_PRODUCT_STANCE_V1_1.docx
**Date:** May 4, 2026
**Subject:** Implementation sequencing refinement (post-Technical Context Exposure Audit)

---

## What this addendum covers

The V1.1 product stance document is unchanged. The four-surface model, three-mode authority structure, handoff artifact schema, and grading principles all remain locked as documented.

This addendum captures one downstream change: the implementation sequencing in V1.1 Section 7 (engineering bridge). The V1.1 doc described Tier 0 → Sprint 2 → Tier 1 → Tier 2 sequencing with Layer 1 (Technical Context Bundle) as a sub-item of Tier 1. After a focused Technical Context Exposure Audit, Layer 1 has been promoted to its own block, sequenced before Sprint 2.

This is a sequencing change, not a stance change. The V1.1 document does not need a V1.2 bump because nothing about the product stance itself has shifted.

---

## What changed

### Original V1.1 sequencing (Section 7)

```
Tier 0 (~1 sprint)
    ↓
Sprint 2 (~2 sprints)
    ↓
Tier 1 (~2.5-3 sprints, including Layer 1 as first item)
    ↓
Tier 2 (post-launch)
```

### Updated sequencing (V2 of Sprint 2 + Tiers Roadmap)

```
Tier 0 (~1 sprint, parallel chat)
    +
Layer 1 (~1.5 sprints, main chat — parallel to Tier 0)
    ↓
Sprint 2 (~2 sprints, main chat)
    ↓
Rest of Tier 1 (~2-2.5 sprints)
    ↓
Tier 2 (post-launch)
```

### Why the change

The Technical Context Exposure Audit (TECHNICAL_CONTEXT_EXPOSURE_AUDIT.md) found that the Voice Layer and trading brain both operate on impoverished technical context. RSI, MACD, SMA distances, support/resistance, divergences — these are either computed and discarded, or never computed at all. Bucket-prose summaries reach the prompts; raw numbers do not.

This finding is structurally important for Sprint 2. Sprint 2's conviction writer extracts patterns from veto events. Without rich technical context per veto, the patterns extracted are coarse ("user vetoes things"). With Layer 1's per-veto technical snapshot, the patterns become concrete ("user vetoes when RSI is above 75 AND price is more than 5% above the 50-day").

Building Sprint 2 against thin technical context would mean shipping the conviction writer twice — once on thin data, then re-running it after Layer 1 ships to extract better patterns. That's wasted work and produces transient writer outputs that confuse downstream consumers.

Sequencing Layer 1 before Sprint 2 means the writers ship against the strongest possible foundation from day one.

### What stays the same

- Voice Layer is meaning-making layer, not advice — unchanged
- Three authority modes (Auto-pilot, Co-pilot, Manual) — unchanged
- Four conversational surfaces (pre-battle gameplan, mid-battle conversation, mid-battle research, film room) — unchanged
- Handoff artifact schema (six fields) — unchanged
- Funnel principle extended to partnerProfile — unchanged
- User directional-clarity grading principles — unchanged

### Total timeline impact

Total floor grew from ~5.5-6 sprints (V1.1 estimate) to ~6-7 sprints (V2 estimate) because Layer 1's ~1.5 sprints is now sequential before Sprint 2 rather than running as part of Tier 1.

This is honest scoping, not scope creep. Layer 1 was always going to be built; the question was sequencing.

---

## What this means for implementers

Anyone reading the V1.1 product stance for technical implementation guidance should:

1. **Read V1.1 for product stance** — the four-surface model, three-mode authority, handoff artifact schema, grading principles
2. **Read this addendum for current sequencing**
3. **Read FANTASYTRADES_SPRINT2_TIERS_ROADMAP.md (V2) for full sequencing detail and effort estimates**
4. **Read FANTASYTRADES_LAYER_1_TECHNICAL_CONTEXT_SPEC.md for Layer 1 implementation**

The V1.1 document Section 7 (engineering bridge) should be read as historical sequencing. The V2 roadmap and this addendum are current.

---

## When this addendum becomes obsolete

If a future significant change to the product stance is needed, that warrants a V1.2 of the Word document. Sequencing-only changes get addendums rather than version bumps. If the four-surface model, three-mode authority, or handoff artifact schema changes substantively, that's a V1.2 trigger.

If Layer 1 ships and reveals something that changes the product stance itself — for instance, if real numerical evidence in user-facing responses requires reconsidering the "research partner not advisor" framing — that would also be a V1.2 trigger. We don't expect this; the audit suggests Layer 1 is exposure work, not stance-shifting work.

---

**End of Addendum A.**
