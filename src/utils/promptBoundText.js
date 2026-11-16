// src/utils/promptBoundText.js
//
// Film Room C2 fix round — Build C Amendment E, CE-1: NO IDENTIFIER RIDES IN ON SOMEONE'S WORDS (Astra's C2-F1).
//
// Labels keep ids out of the excerpt's own fields; this module keeps them out of the WORDS it quotes — a player's note,
// the agent's rationale, a directive, an idea's statement can each hold a pasted id. Shared contract V2 §5.1: no raw
// identifier reaches a prompt. BC-1: nobody's words are rewritten. So a quotation that holds an identifier is LEFT OUT
// WHOLE — never redacted, never cut. The policy, one module for the excerpt (server) and the subject line (screen):
//   1. EXACT IDS     a text holding any id the caller knows (the battle, the owner's uid, the battle's agent, the
//                    clone and its parent, the card's entry, the idea's watchlist, the nomination, the book).
//   2. ID SHAPES     a text holding a token of any shape the platform mints (ID_SHAPES; the kinds it mints are listed
//                    and pinned in PLATFORM_ID_KINDS, each with its shape or the reason no shape can tell it from
//                    prose). A token is a run of letters and digits; `_`, `-`, `:`, `.` and every other character bound it.
//   3. DOMAINS       a recorded word is carried only inside its own domain: a ticker, a situation of the registry, a
//                    card route, the exit writer's reasons and mechanisms.
// Ordinary prose passes: tickers, prices, dates, percentages and ordinary words of any length (an all-letter word is
// never an id here; an auto-id or uid shape needs a digit, an upper-case and a lower-case letter).
//
// Node-clean, browser-clean and write-free: the excerpt's closure (its write gate) and the screen both import it.

import { SITUATION_IDS } from '../data/situationRegistry.js';
import { CARD_ROUTES } from '../data/cardStages.js';
import { EXIT_MECHANISMS } from '../constants/filmTape.js';

/** The runs of letters and digits in `text` — each bounded by any other character (or the text's ends). */
const tokensOf = (text) => String(text).match(/[A-Za-z0-9]+/g) || [];
/** A digit, an upper-case and a lower-case letter: what an auto-id or a uid holds and an ordinary word never does. */
const mixed = (t) => /[0-9]/.test(t) && /[A-Z]/.test(t) && /[a-z]/.test(t);
const tokenOf = (len) => (text) => tokensOf(text).some((t) => t.length === len && mixed(t));
const hexToken = (text) => tokensOf(text).some((t) => t.length >= 16 && /^[0-9a-f]+$/.test(t) && /[0-9]/.test(t) && /[a-f]/.test(t));
const re = (pattern) => (text) => pattern.test(String(text));

/**
 * THE ID SHAPES the platform mints (CE-1 item 2) — each a test over a text. The 20- and 28-character shapes are
 * exactly that many letters and digits between non-alphanumerics, holding a digit, an upper- and a lower-case letter
 * (CE-1's letter for the auto-id; the uid by the same rule). A composite id (a call id, a tick id, a clone's id, a
 * research work id, a Practice Field entry id) is caught by the id inside it.
 */
export const ID_SHAPES = Object.freeze({
  'firestore-auto-id': tokenOf(20),
  'firebase-uid': tokenOf(28),
  uuid: re(/(?<![0-9A-Za-z])[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?![0-9A-Za-z])/i),
  // the fix round's review, CX1-4: as minted — `casual-agent-<uid>` and `training-agent-<group>-<uid>` hold a digit in
  // their tail, `cpu-agent-<n>` is digits — so prose such as "training-agent-based" or "cpu-agent-style" passes
  'agent-prefix': re(/(?<![0-9A-Za-z])(?:(?:casual-agent|training-agent)-[A-Za-z0-9-]*[0-9]|cpu-agent-\d+(?![0-9A-Za-z]))/),
  'mandate-manager': re(/(?<![0-9A-Za-z])mgr_[a-z0-9_]*?[0-9a-f]{16}(?![0-9A-Za-z])/),
  'prefixed-hex': re(/(?<![0-9A-Za-z])(?:(?:pf|idea|seat|stk|dbt)_[0-9a-f]{16,}|solo-[0-9a-f]{12})(?![0-9A-Za-z])/),
  'bare-hex': hexToken,
  'epoch-ms': re(/(?:[_-]\d{13}(?!\d)|(?<![0-9A-Za-z])\d{13}[_-])/),
  'battle-sequence': re(/(?<![0-9A-Za-z])(?:eval|trade|prop)_\d{3,}(?![0-9A-Za-z])/),
  'base36-fallback': re(/(?<![0-9A-Za-z])(?:op|bk)[-_][a-z0-9]{6,}[-_][a-z0-9]{8,10}(?![0-9A-Za-z])/),
  'live-draft-group': re(/(?<![0-9A-Za-z])lds_[A-Za-z0-9]/),
  'challenge-code': (text) => tokensOf(text).some((t) => /^BB[0-9A-Z]{8}$/.test(t) && /[0-9]/.test(t)),
  'playback-token': re(/\d{4}-\d{2}-\d{2}\.[A-Za-z0-9_-]{43}/),
});

/**
 * EVERY ID KIND THE PLATFORM MINTS (CE-1: "the build lists every id kind the platform mints, and pins the list") — from
 * the fix round's survey of api/ and src/ at the C2 fix round's head (build report §11). Each kind names the ID_SHAPES
 * entry that recognises it in prose (`shape`), an example of it (`example`, which that shape must recognise), and where
 * it is minted (`minted`). A kind no shape can tell from ordinary prose names `shape: null` and the reason: it is
 * caught only when it is one of the ids the caller knows exactly.
 */
export const PLATFORM_ID_KINDS = Object.freeze([
  { kind: 'battle (agentBattles document)', shape: 'firestore-auto-id', example: 'Ab3dEf7hIj9kLm1nOp5q', minted: 'api/_utils/compositionGenerationFence.js:170, :172 (.add / .doc())' },
  { kind: 'agent, client-created', shape: 'firestore-auto-id', example: 'Zx9Yw8Vu7Ts6Rq5Po4Nm', minted: 'src/services/agentService.js:180' },
  { kind: 'watchlist (idea list)', shape: 'firestore-auto-id', example: 'Qw1Er2Ty3Ui4Op5As6Df', minted: 'api/forge/watchlists.js:184, :310, :400; api/_utils/sharedResearch/store.js:645' },
  { kind: 'mandate', shape: 'firestore-auto-id', example: 'Mn7Bv6Cx5Zl4Kj3Hg2Fd', minted: 'api/_utils/mandateCreationService.js:81; api/_utils/mandateEscape.js:89' },
  { kind: 'other auto-id documents (groups, lobbies, claims, chat and dialogue sessions, theses, season entries, bundles, stories, bug reports, forge rules, plan notes, templates, battles created on the client)', shape: 'firestore-auto-id', example: 'Lp0Ok9Ij8Uh7Yg6Tf5Rd', minted: 'every doc() with no argument, every collection add and addDoc — e.g. api/_utils/tournamentGroupService.js:84, src/firebase/firebaseService.js:243' },
  { kind: 'user (Firebase Auth uid)', shape: 'firebase-uid', example: 'aB3dE5gH7jK9mN1pQ3sT5vW7yZ9b', minted: 'Firebase Auth (not this repository)' },
  { kind: 'UUIDs: directive threads, chat exchanges, research sessions and messages, threshold positions, leases, signal drops, client request ids', shape: 'uuid', example: '123e4567-e89b-42d3-a456-426614174000', minted: 'api/agent/chat.js:1082, :1144; api/forge/shared-research.js:177; api/_utils/stockThresholdAdmission.js:64; src/components/SignalDrop/SignalDropEntry.jsx:84' },
  { kind: 'Film Room card (opId = entry = nomination id), finding, backing request, mandate lease, evolution event, backing event, research work id', shape: 'uuid', example: 'op_123e4567-e89b-42d3-a456-426614174000', minted: 'src/screens/filmRoomV2/filmRoomCards.js:70 (op_<uuid>); api/forge/shared-research.js:67 (f_); src/services/backingService.js:122 (bk-); api/_utils/mandateLease.js:24 (inv_); api/_utils/agentConsolidationApply.js:253 (evo_); api/_utils/backingEvents.js:100 (bev_); api/_utils/researchRecords/model.js:152 (sr_/ws_/rs_/as_/wl_ + host id)' },
  { kind: 'casual clone agent', shape: 'agent-prefix', example: 'casual-agent-aB3dE5gH7jK9mN1pQ3sT5vW7yZ9b', minted: 'src/constants/leagueTournament.js:413 (casual-agent-<uid>)' },
  { kind: 'training agent', shape: 'agent-prefix', example: 'training-agent-group7-owner', minted: 'src/constants/leagueTournament.js:397' },
  { kind: 'CPU opponent agent', shape: 'agent-prefix', example: 'cpu-agent-3', minted: 'src/constants/leagueTournament.js:380' },
  { kind: 'Mandate manager agent', shape: 'mandate-manager', example: 'mgr_momentum_chaser_0123456789abcdef', minted: 'api/_utils/mandateSchema.js:62' },
  { kind: 'Practice Field book', shape: 'prefixed-hex', example: 'pf_0123456789abcdef01234567', minted: 'api/_utils/practiceField/ideaBook.js:61' },
  { kind: 'Practice Field idea, and the entry and sale-decision ids built on it', shape: 'prefixed-hex', example: 'idea_0123456789abcdef01234567__entry__ETN', minted: 'api/_utils/practiceField/admission.js:79; entry.js:70; exits.js:88' },
  { kind: 'Mandate seat; backing stake and debit; solo season', shape: 'prefixed-hex', example: 'seat_0123456789abcdef', minted: 'api/_utils/mandateRationale.js:160; api/_utils/backingStake.js:155, :173; api/season/create-entry.js:74' },
  { kind: 'model request id, observation id, news id, narration and deep-dive document ids (bare hex)', shape: 'bare-hex', example: '0f1e2d3c4b5a69788796a5b4', minted: 'api/_utils/mandateModelCall.js:56; api/_utils/intraday/observation.js:50; api/_utils/evidence/eodhdNews.js:47; api/research/correlation-narrate.js:87' },
  { kind: 'gameplan meeting', shape: 'epoch-ms', example: 'gpm_1758648600000', minted: 'api/cron/agent-evaluate.js:6950' },
  { kind: 'timestamped ids (risk, gameplan and exit evaluation ids; drafts, training battles, directives on the client; tournament runs; shadow events; accelerated-clock uids)', shape: 'epoch-ms', example: 'risk_stagnation_ETN_1758648600000', minted: 'api/cron/agent-evaluate.js:2226, :6131, :6527; src/services/draftService.js:87; api/earnings/resolve-tournament.js:159; api/_utils/shadowLogger.js:51; api/_utils/mandateAcceleratedClock.js:185' },
  { kind: 'evaluation, trade and proposal sequence ids (and the call, tick, action and verification ids built on the battle id)', shape: 'battle-sequence', example: 'eval_007', minted: 'api/cron/agent-evaluate.js:3501, :4281; api/_utils/executorMetadata.js:83; api/_utils/callRecords/candidate.js:142' },
  { kind: 'client base-36 fallbacks for card ops and backing requests', shape: 'base36-fallback', example: 'op_m3k9x2_a8b7c6d5', minted: 'src/screens/filmRoomV2/filmRoomCards.js:72; src/services/backingService.js:123' },
  { kind: 'live-draft group', shape: 'live-draft-group', example: 'lds_slot2_2026-09-23', minted: 'api/_utils/liveDraftFormation.js:92' },
  { kind: 'challenge code (BB + 8)', shape: 'challenge-code', example: 'BB4K2Z9QXA', minted: 'src/firebase/firebaseService.js:1065, :1779' },
  { kind: 'hyphen-joined timestamped ids (challenges; signal-drop chat messages)', shape: 'epoch-ms', example: 'challenge-1758648600000-k3j9x2', minted: 'src/services/challengeService.js:187, :291; src/components/SignalDrop/WatchlistChat.jsx:136' },
  { kind: 'dev agents and wallets built on a uid (dev-agent-<uid>, dev-<uid>)', shape: 'firebase-uid', example: 'dev-agent-aB3dE5gH7jK9mN1pQ3sT5vW7yZ9b', minted: 'api/_utils/tournamentAgentBoards.js:329; api/_utils/backingWallet.js:162' },
  { kind: 'huddle playback token', shape: 'playback-token', example: '2026-09-23.abcdefghijABCDEFGHIJ0123456789_-abcdefghijk', minted: 'api/_utils/huddle/playback.js:36' },
  { kind: 'bug report display id (CB-NNNN)', shape: null, reason: 'it reads like a code or a year in prose ("CB-2026"); it names no record a prompt could reach', minted: 'api/bug-report.js:99' },
  { kind: 'six-character lobby join and challenge codes', shape: null, reason: 'six letters and digits read like a ticker or a word', minted: 'api/_utils/tournamentLobbyService.js:85; src/App.jsx:5673' },
  { kind: 'short sequence ids (cpu-N, epoch-0001, v<n> version documents, r<n>)', shape: null, reason: 'a word and a small number read like prose', minted: 'src/constants/leagueTournament.js:355; api/_utils/practiceField/constants.js:161; api/_utils/hypothesisRecords/model.js:91' },
  { kind: 'date keys (YYYY-MM leaderboards, tick keys, date-and-symbol composites)', shape: null, reason: 'a date reads like a date', minted: 'src/constants/leagueTournament.js:941; api/_utils/practiceField/windows.js:104; api/_utils/moverCandidates.js:56' },
  { kind: 'base64url composition entry ids', shape: null, reason: 'no fixed length or prefix to tell them from a mixed-case word', minted: 'api/_utils/compositionStateResolver.js:173' },
]);

/**
 * Every identifier `text` holds: `known` for an id the caller knows exactly (a substring of the text), else each
 * ID_SHAPES name that recognises a token in it. [] for prose.
 */
export function identifiersIn(text, knownIds = []) {
  if (typeof text !== 'string' || !text) return [];
  const out = [];
  for (const id of knownIds) if (typeof id === 'string' && id && text.includes(id)) { out.push('known'); break; }
  for (const [name, test] of Object.entries(ID_SHAPES)) if (test(text)) out.push(name);
  return out;
}
/** Does `text` hold any identifier — one the caller knows, or one of the platform's shapes? */
export const holdsIdentifier = (text, knownIds = []) => identifiersIn(text, knownIds).length > 0;

// ── 3. recorded words, each inside its own domain ──────────────────────────
/** A ticker as the symbol directory writes one: one to five capitals, and at most one `.`/`-` suffix of one or two (BRK-B). */
export const TICKER_SHAPE = /^[A-Z]{1,5}(?:[.-][A-Z]{1,2})?$/;
export const tickerOk = (v) => typeof v === 'string' && TICKER_SHAPE.test(v);
/** A situation the registry holds. */
export const situationIdOk = (v) => typeof v === 'string' && SITUATION_IDS.includes(v);
/** A card route (the stage vocabulary's CARD_ROUTES). */
export const cardRouteOk = (v) => typeof v === 'string' && CARD_ROUTES.includes(v);
/** An exit reason the tape writer's table knows (EXIT_MECHANISMS' keys — any other is written `unrecorded`). */
export const exitReasonOk = (v) => typeof v === 'string' && Object.prototype.hasOwnProperty.call(EXIT_MECHANISMS, v);
/** An exit mechanism the tape writer's table writes (EXIT_MECHANISMS' values; its `unrecorded` sentinel is none). */
export const exitMechanismOk = (v) => typeof v === 'string' && Object.values(EXIT_MECHANISMS).includes(v);
