`2_P3_STAGE0_DISCOVERY_REPORT.md:38`.

**The gap.** A sub-second window exists where a battle is `active` but `activeBattleId` is still null — a race in the deploy/lock sequencing.

**Why it's V1-safe (verified).** It cannot alter the already-frozen `battle.agentContext.archetype` snapshot; the next deploy re-syncs; second-battle divergence is structurally blocked. Pre-existing and low-risk; the archetype-integrity feature neither introduces nor worsens it.

**Recommended action.** None required for archetype-integrity. Already tracked in the June discovery report; leave it there unless a separate workstream picks up deploy-sequencing hardening.

**Priority:** low / informational. No archetype-integrity dependency.

---

## **Minor doc correction (no action)**

V2 plan CF-1 fact (c) named `create-profile.js` as an archetype writer — it isn't; it returns the archetype in the HTTP response body, while the real creation write is client-side (`agentService.createAgent`). Harmless (creation-only, on a brand-new doc — not a mid-battle mutation). Noted for accuracy; nothing to fix.

---

**End of backlog. Revisit Item 1 when scheduling post-launch security/data-layer hardening.**

