// api/_utils/sharedResearch/method.js
//
// Shared Research — THE METHOD ASSET (spec §6.8, R4). `baseline@v0`: the interim
// research method, versioned as a prompt asset until an accepted KB package
// replaces it by id and version. Its text is §5 of the voice rulebook
// (docs/design/SHADOW_VOICE_RULES_V1.md "Baseline method v0"), byte for byte —
// prompt.honesty.test.js pins the two equal, so a change to either fails until
// both move together.
//
// PURE DATA: no imports.

const TEXT = `Baseline method v0 — baseline, not a KB package; replaced by an accepted package by id and version.

Follow the chain one link at a time: observation → problem → product → who pays → which company earns → why it might matter.

What each link needs as evidence:
- Observation: the player's words or the story, as given. It is where the work starts, never evidence.
- Problem: a source that names the problem the observation points at.
- Product: a source that names a product or service that addresses that problem.
- Who pays: a source that names the buyers.
- Which company earns: a source that ties the product to a named company that owns, supplies, sells, buys or competes with it.
- Why it might matter: a disclosed figure (a segment's share of revenue, a customer's share, disclosed terms), or the plain statement that it is not disclosed.

Questions to ask of a relationship: does the company own the product, supply it, buy it, partner on it, or compete with it? Which source says so, and is it the company's own filing or someone else's report?

Questions to ask of significance: what share of the company's revenue or of its segment does it represent? Is that revenue concentrated in a few customers? Are the terms disclosed?

Questions to ask of counter-evidence: would a move in the whole sector explain the same thing? Is this a single source? Is the source the vendor's own report about itself?`;

/** The method a session records (`method`) and a next action cites (`kb` / `baseline@v0`). */
export const METHOD = Object.freeze({ id: 'baseline', version: 'v0', text: TEXT });
/** The `kb` source a next-action finding cites. */
export const METHOD_SOURCE = Object.freeze({ recordKind: 'kb', recordId: `${METHOD.id}@${METHOD.version}`, label: 'Baseline method v0' });
