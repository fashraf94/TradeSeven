// src/data/situationRegistry.js
//
// Film Room Build B (spec docs/specs/FILM_ROOM_BUILD_B_CARD_SPEC_V1_20261010.md
// §1; shared contract docs/design/20261010_PRACTICE_FIELD_FILM_ROOM_SHARED_CONTRACT_V1.md
// §2) — THE SITUATION REGISTRY: the one list of situations every tag, card,
// drill and play names, so the Film Room and the Practice Field can never
// disagree about what "our stocks are not moving" means.
//
// Zero-import, Node-clean and browser-clean — after the src/data/archetypeAdjustments.js
// precedent — so the tape writer (api/_utils/filmTape/tapeTags.js) and, in B2,
// the screen read the same entries. DEFINITIONS AND SLOT VALUES ONLY: no
// arithmetic lives here. The count `stalled` reads is the platform's own
// (updateStagnationCounter, api/_utils/agentRiskManager.js), run by the tagger.
//
// VERSION RULE (spec §1): a definition or a slot value changes only by a PR
// that bumps that entry's `version` (and REGISTRY_VERSION). Records written
// under an old version keep it. A tag is a fact, never a verdict.

/** The registry's own version — stored on every tape's `tags.registryVersion`. */
export const SITUATION_REGISTRY_VERSION = 1;

/**
 * Each entry: `{ id, version, title, definition, slots, playerCallable }`.
 * A reserved entry has its id and title only: no version, no definition and
 * no slots until a PR defines it (founder slots S6–S8, its thresholds, are unset).
 */
export const SITUATIONS = Object.freeze({
  stalled: Object.freeze({
    id: 'stalled',
    version: 1,
    title: 'Our stocks are not moving',
    definition: 'Per holding, per check. The platform\'s stagnation count is recomputed from the price the agent was shown at each check (checks[].evidence.px), with the platform\'s own arithmetic (updateStagnationCounter), the archetype\'s forced-rotation thresholds from the registry adapter, the battle\'s tempo dial, and the rule\'s tick-age guard. A check with no price for the holding pauses the count, as the age guard does. The count starts at zero at the day\'s first check. A run is the stretch since the holding came into the book or since a timely move reset its count. The holding is stalled at a check when the count is at or above the effective threshold less S1 (and at least 1), the rule has not fired for it in the run, and it is below the rule\'s winner threshold. When the archetype\'s forced rotation is switched off, the count runs at S2\'s move threshold and the holding is stalled at S2\'s check count.',
    slots: Object.freeze({
      // S1 — how many checks before the stagnation rule fires that `stalled` goes live.
      S1: Object.freeze({ checksBeforeRule: 2 }),
      // S2 — `stalled` for an archetype with the rule switched off: 6 checks at 0.30%.
      S2: Object.freeze({ checks: 6, pctThreshold: 0.003 }),
    }),
    playerCallable: false,
  }),
  down: Object.freeze({
    id: 'down',
    version: null,
    title: 'We are down',
    definition: null,
    slots: Object.freeze({}),
    playerCallable: true,
  }),
  good_lead: Object.freeze({
    id: 'good_lead',
    version: null,
    title: 'We have a good lead',
    definition: null,
    slots: Object.freeze({}),
    playerCallable: true,
  }),
});

/** The situation ids, in registry order. */
export const SITUATION_IDS = Object.freeze(Object.keys(SITUATIONS));

/** The ids with a definition — the only ones a tagger may tag. */
export const LIVE_SITUATION_IDS = Object.freeze(SITUATION_IDS.filter((id) => SITUATIONS[id].definition !== null));
