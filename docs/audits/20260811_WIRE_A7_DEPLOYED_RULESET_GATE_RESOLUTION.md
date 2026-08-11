# FantasyTimes Wire — V1.6 A7 Deployed-Ruleset Gate: RESOLUTION

**Date:** 2026-08-11
**Gate:** Wire Spec V1.6 **A7 / A5-1** — the pre-flip *deployed-ruleset run*: confirm every Wire-collection and `wireEditorial` client denial fires on the **live** ruleset, with positive controls.
**Branch of record:** `claude/wire-a7-rules-harness` (F-1 harness fix + this record).
**Verdict:** ✅ **SATISFIED** — by **console-publish provenance + repo-ruleset suite run**. An independent emulator run against *fetched* live text was not performed; limitation recorded below (Drift Ledger D-6).

---

## Verdict table

| Item | Result | Basis |
|---|:--:|---|
| All four Wire collections deny every client verb, **live** | ✅ | provenance chain below |
| Positive controls (proof the suite isn't vacuously denying) | ✅ 2/2 | suite run |
| Live ruleset == the text the suite validated | ✅ | sha byte-identity + verbatim console publish |
| Independent emulator run vs. *fetched* deployed text | ⚠️ not performed | no JVM (founder/Windows) **and** no creds (CC harness) — see Limitation / D-6 |

---

## Provenance chain

Gate satisfaction is a byte-identity argument. Each link is marked **VERIFIED** (by Claude, this session) or **ATTESTED** (by founder):

1. **[ATTESTED — founder]** The repo's `firestore.rules` was published **verbatim** to the Firebase console and **deployed 2026-08-11 ≈22:27** (founder local — "Today 10:27 PM"). The console shows all four Wire blocks as `allow read, write: if false` plus the default-deny catch-all. ⇒ **live text = repo text.**
2. **[VERIFIED — Claude]** Repo `firestore.rules` sha256 = **`42b2620276bc83378253713087741416556dae410997ae04d7f2a6cb5a67964d`**.
3. **[VERIFIED — Claude]** The repo's four Wire blocks are deny-all — `fantasyTimesWire` (`firestore.rules:664-665`), `fantasyTimesWireEnvelopes` (`:667-668`), `wireMetrics` (`:670-671`), `wireEditorial` (`:673-674`) — each `allow read, write: if false`, beneath the catch-all `match /{document=**} { allow read, write: if false; }` (`:1001-1002`).
4. **[VERIFIED — Claude]** The Wire denials suite (`test/rules/wireDenials.rules.mjs`), with positive controls, passed **15/15** in the Firestore emulator against exactly that text — the suite's self-printed rules sha256 == (2). Emulator denial logs cited `@ L674` (`wireEditorial`) and `@ L1002` (catch-all), confirming the exact lines fired.

**Conclusion:** live text (1) = repo text (2,3) = the text the suite exercised (4). The suite proves that text denies all four Wire collections for unauthenticated, ordinary-auth, and privileged-claims identities, with the public/authed positive controls succeeding. ∴ the **live** ruleset satisfies the A7 denial requirement.

---

## Per-collection result (suite, against sha `42b2620…`)

| Collection | unauth | ordinary auth | privileged claims | live rule |
|---|:--:|:--:|:--:|---|
| `fantasyTimesWire` | deny ✓ | deny ✓ | deny ✓ | `if false` (`firestore.rules:665`) |
| `fantasyTimesWireEnvelopes` | deny ✓ | deny ✓ | deny ✓ | `if false` (`:668`) |
| `wireMetrics` | deny ✓ | deny ✓ | deny ✓ | `if false` (`:671`) |
| `wireEditorial` | deny ✓ | deny ✓ | deny ✓ | `if false` (`:674`) |

Each cell = all four verbs (`get`/`create`/`update`/`delete`) denied. **Positive controls:** public `fantasyTimesStories` read (unauth) ✓ succeeds; authed `voiceLayerCache` read ✓ succeeds. `agentFacts` client-write onto a story doc ✓ blocked. **Total 15/15.**

---

## Limitation (recorded, not hidden)

The deployed-ruleset run was **not** executed as an independent emulator run against **fetched** live text (the mechanism `docs/composition/RULES_DEPLOY_RECORD.json._howToFill` describes). Two environments, each missing one half:

- **CC harness** — has a JVM (emulator runs), but **no prod credentials / project id** (Drift Ledger D-5): cannot fetch live text.
- **Founder machine (Windows)** — has console + credential access, but **no JVM**: cannot host the Firestore emulator.

So satisfaction rests on **console-verified byte-identity (provenance)** + the **repo-ruleset suite run** — not on an emulator execution of independently-fetched live text. For *this* deploy that is sound: a verbatim publish makes live = repo by construction, and the founder confirmed the four `if false` blocks + catch-all in the console. It would **not** catch a future deploy whose console text was hand-edited or transformed away from the repo. That gap is registered as **Drift Ledger D-6**.

---

## Harness readiness for next time

`test/rules/wireDenials.rules.mjs` now (F-1, this branch) honors `COMPOSITION_RULES_TEXT_PATH` and prints the loaded text's sha256, so once a runner exists (a JVM on the founder's machine, or a credentialed CI job) the deployed run is a one-liner and self-proving:

```
COMPOSITION_RULES_TEXT_PATH=<fetched-deployed-text> npm run test:rules -- test/rules/wireDenials.rules.mjs
# then: assert the printed "rules text sha256" == the deployed ruleset's sha256
```

---

## References
- F-1 fix + self-proving sha — `test/rules/wireDenials.rules.mjs` (branch `claude/wire-a7-rules-harness`).
- `.firebaserc` absence — Drift Ledger **D-5**.
- Independent-runnability requirement — Drift Ledger **D-6**.
- Spec — `docs/FANTASYTIMES_WIRE_SPEC_V1_6_POINT_AMENDMENT.md` §A5-1 / §A7.
- Deployed-run mechanism — `docs/composition/RULES_DEPLOY_RECORD.json._howToFill`.
