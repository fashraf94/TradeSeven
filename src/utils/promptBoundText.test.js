// src/utils/promptBoundText.test.js
//
// Film Room C2 fix round — the shared prompt-bound text policy (Build C Amendment E, CE-1; Astra's C2-F1): exact ids,
// the platform's id shapes (every kind it mints, pinned), and the recorded words' domains. Ordinary prose passes.

import { describe, it, expect } from 'vitest';
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the excerpt (api/) imports this module; this import is the runtime guard
// that it stays Node-clean — never mocked.
import {
  ID_SHAPES, PLATFORM_ID_KINDS, identifiersIn, holdsIdentifier, unmaskedText, TICKER_SHAPE, tickerOk, situationIdOk, cardRouteOk, exitReasonOk, exitMechanismOk,
} from './promptBoundText.js';
import { TICKER_TO_SECTOR } from '../../api/_utils/rankingConfig.js';
import { SITUATION_IDS } from '../data/situationRegistry.js';
import { CARD_ROUTES } from '../data/cardStages.js';
import { EXIT_MECHANISMS } from '../constants/filmTape.js';
import { casualCloneDocId } from '../constants/leagueTournament.js';

describe('CE-1 — the id kinds the platform mints, pinned', () => {
  it('THE LIST: every kind the fix round\'s survey found, each with its shape — or, for the few no shape can tell from prose, the reason (pinned by name)', () => {
    expect(PLATFORM_ID_KINDS.map((k) => [k.kind, k.shape])).toEqual([
      ['battle (agentBattles document)', 'firestore-auto-id'],
      ['agent, client-created', 'firestore-auto-id'],
      ['watchlist (idea list)', 'firestore-auto-id'],
      ['mandate', 'firestore-auto-id'],
      ['other auto-id documents (groups, lobbies, claims, chat and dialogue sessions, theses, season entries, bundles, stories, bug reports, forge rules, plan notes, templates, battles created on the client)', 'firestore-auto-id'],
      ['user (Firebase Auth uid)', 'firebase-uid'],
      ['UUIDs: directive threads, chat exchanges, research sessions and messages, threshold positions, leases, signal drops, client request ids', 'uuid'],
      ['Film Room card (opId = entry = nomination id), finding, backing request, mandate lease, evolution event, backing event, research work id', 'uuid'],
      ['casual clone agent', 'agent-prefix'],
      ['training agent', 'agent-prefix'],
      ['CPU opponent agent', 'agent-prefix'],
      ['Mandate manager agent', 'mandate-manager'],
      ['Practice Field book', 'prefixed-hex'],
      ['Practice Field idea, and the entry and sale-decision ids built on it', 'prefixed-hex'],
      ['Mandate seat; backing stake and debit; solo season', 'prefixed-hex'],
      ['model request id, observation id, news id, narration and deep-dive document ids (bare hex)', 'bare-hex'],
      ['gameplan meeting', 'epoch-ms'],
      ['timestamped ids (risk, gameplan and exit evaluation ids; drafts, training battles, directives on the client; tournament runs; shadow events; accelerated-clock uids)', 'epoch-ms'],
      ['evaluation, trade and proposal sequence ids (and the call, tick, action and verification ids built on the battle id)', 'battle-sequence'],
      ['client base-36 fallbacks for card ops and backing requests', 'base36-fallback'],
      ['live-draft group', 'live-draft-group'],
      ['challenge code (BB + 8)', 'challenge-code'],
      ['hyphen-joined timestamped ids (challenges; signal-drop chat messages; market news items)', 'epoch-ms'],
      ['dev agents and wallets built on a uid (dev-agent-<uid>, dev-<uid>)', 'firebase-uid'],
      ['huddle playback token', 'playback-token'],
      ['bug report display id (CB-NNNN)', null],
      ['six-character lobby join and challenge codes', null],
      ['short sequence ids (cpu-N, epoch-0001, v<n> version documents, r<n>)', null],
      ['date keys (YYYY-MM leaderboards, tick keys, date-and-symbol composites)', null],
      ['base64url composition entry ids', null],
    ]);
  });
  it('every kind with a shape names one that exists, and its example — alone, and inside a sentence — is recognised by that shape', () => {
    for (const k of PLATFORM_ID_KINDS.filter((x) => x.shape)) {
      expect(Object.keys(ID_SHAPES), k.kind).toContain(k.shape);
      expect(ID_SHAPES[k.shape](k.example), `${k.kind}: ${k.example}`).toBe(true);
      expect(identifiersIn(`Recorded ${k.example} here.`), k.kind).toContain(k.shape);
      expect(typeof k.minted, k.kind).toBe('string');
    }
  });
  it('every shape recognises at least one kind, and every kind with no shape says why (it is caught only when known exactly)', () => {
    for (const name of Object.keys(ID_SHAPES)) expect(PLATFORM_ID_KINDS.some((k) => k.shape === name), name).toBe(true);
    for (const k of PLATFORM_ID_KINDS.filter((x) => !x.shape)) expect(k.reason, k.kind).toMatch(/\w/);
  });
  it('the casual clone\'s id, as the platform builds it, is recognised (agent-prefix) — and so are ids BUILT ON an id: a call, a tick, a Practice Field entry, a research work id, a training agent', () => {
    expect(identifiersIn(`Recorded ${casualCloneDocId('owner-1')} here.`)).toContain('agent-prefix');
    for (const composite of [
      'Ab3dEf7hIj9kLm1nOp5q:eval_007:call:0',            // a call id: the battle's auto-id inside
      'Ab3dEf7hIj9kLm1nOp5q:23',                          // a tick id
      'idea_0123456789abcdef01234567__exit__ETN',         // a Practice Field sale decision
      'sr_123e4567-e89b-42d3-a456-426614174000',          // a research work id on a uuid host
      'ws_Ab3dEf7hIj9kLm1nOp5q',                          // a research work id on an auto-id host
      'training-agent-g7-aB3dE5gH7jK9mN1pQ3sT5vW7yZ9b',   // a training agent: the uid inside
    ]) expect(holdsIdentifier(`see ${composite}.`), composite).toBe(true);
  });
});

describe('CE-1 — exact ids, and the shapes\' boundaries', () => {
  it('an id the caller knows, anywhere in the text (a substring), whatever its shape', () => {
    expect(identifiersIn('The b-sep23-excerpt run was dull.', ['b-sep23-excerpt'])).toEqual(['known']);
    expect(identifiersIn('owner-1 wrote this', ['owner-1'])).toEqual(['known']);
    expect(identifiersIn('owner-1 wrote this', [])).toEqual([]);
    expect(identifiersIn('no ids here', ['owner-1', '', null, 7])).toEqual([]);
  });
  it('the 20- and 28-character shapes are exact lengths of letters and digits between non-alphanumerics, each holding a digit, an upper- and a lower-case letter', () => {
    expect(ID_SHAPES['firestore-auto-id']('x Ab3dEf7hIj9kLm1nOp5q y')).toBe(true);
    expect(ID_SHAPES['firestore-auto-id']('x_Ab3dEf7hIj9kLm1nOp5q:y')).toBe(true);     // `_` and `:` bound a token
    expect(ID_SHAPES['firestore-auto-id']('Ab3dEf7hIj9kLm1nOp5qZ')).toBe(false);       // 21
    expect(ID_SHAPES['firestore-auto-id']('ab3def7hij9klm1nop5q')).toBe(false);        // no upper-case letter
    expect(ID_SHAPES['firestore-auto-id']('AbcdefghijklmnopqrsT')).toBe(false);        // no digit — an ordinary mixed-case word
    expect(ID_SHAPES['firebase-uid']('uid aB3dE5gH7jK9mN1pQ3sT5vW7yZ9b.')).toBe(true);
    expect(ID_SHAPES['firebase-uid']('aB3dE5gH7jK9mN1pQ3sT5vW7yZ9')).toBe(false);      // 27
  });
});

describe('CE-1 — ORDINARY PROSE PASSES: tickers, prices, dates, percentages and ordinary words of any length', () => {
  const PROSE = [
    'ETN sat flat for an hour before the rule moved it. I want the agent to rotate sooner.',
    'Sell NVDA, BRK-B and BRK.B if they drop 2.4% below $385.70; buy MU at 127 or better.',
    'On 2026-09-23 at 10:15 AM ET, and again on 9/23/2026 at 13:30, the book trailed by -0.84%.',
    'Industrials and chips lead while the wider market drifts; rotate out of names that stop moving.',
    'Antidisestablishmentarianism, internationalization and counterrevolutionaries are long words.',
    'AnExtraordinarilyLongCamelCaseWordWithoutDigits is still prose, as is SupercalifragilisticExpialidocious.',
    'Q3 2026 guidance: EPS 1.23 vs 1.10, revenue 45,000,000,000 (+12% y/y), the S&P 500 at 6,900.',
    'v3 of the idea; check 15 to 19; a 10-minute bar; 3 checks; tier-2; the 52-week high; 1,758,648,600.',
    // the fix round's review, CX1-4: words that share a prefix or a form with a minted id
    'A training-agent-based approach, a cpu-agent-style rule, and CB-2026 was a rough quarter for chips.',
    'Heard. I will tighten the downside stop for the rest of the session.',
    'Tighten the downside stop.',
  ];
  it('none of these holds an identifier — every shape stays silent', () => {
    for (const p of PROSE) expect(identifiersIn(p), p).toEqual([]);
  });
  it('the fixtures\' own words pass too: every rationale, directive and statement the Sep 23 day carries', async () => {
    const fx = await import('../../api/_utils/filmRoom/__fixtures__/excerptFixtures.js');
    const day = await fx.excerptDay();
    const words = [...day.tape.rationale.flatMap((r) => [r.hypothesis, r.rationale]), ...day.tape.directives.flatMap((d) => [d.playerText, d.canonicalText]), fx.EXCERPT_STATEMENT, fx.EXCERPT_NOTE].filter((x) => typeof x === 'string');
    expect(words.length).toBeGreaterThan(4);
    for (const w of words) expect(identifiersIn(w), w).toEqual([]);
  }, 60_000);
});

describe('CE-1 — recorded words inside their own domains', () => {
  it('a ticker: every symbol the directory holds is one; an id, a lower-case word or a long token is not', () => {
    for (const sym of Object.keys(TICKER_TO_SECTOR)) expect(tickerOk(sym), sym).toBe(true);
    for (const bad of ['Ab3dEf7hIj9kLm1nOp5q', 'etn', 'ETN ', 'TOOLONG', 'A1', '', null, 7, 'BRK-BBB', 'casual-agent-x']) expect(tickerOk(bad), String(bad)).toBe(false);
    expect(String(TICKER_SHAPE)).toBe('/^[A-Z]{1,5}(?:[.-][A-Z]{1,2})?$/');
  });
  it('a situation of the registry; a card route of CARD_ROUTES; an exit reason and mechanism of the writer\'s table — anything else is not', () => {
    for (const id of SITUATION_IDS) expect(situationIdOk(id), id).toBe(true);
    for (const r of CARD_ROUTES) expect(cardRouteOk(r), r).toBe(true);
    for (const [reason, mechanism] of Object.entries(EXIT_MECHANISMS)) { expect(exitReasonOk(reason), reason).toBe(true); expect(exitMechanismOk(mechanism), mechanism).toBe(true); }
    for (const bad of ['Ab3dEf7hIj9kLm1nOp5q', 'drill', 'unrecorded', 'toString', '__proto__', '', null]) {
      expect(situationIdOk(bad), String(bad)).toBe(false);
      expect(cardRouteOk(bad), String(bad)).toBe(false);
      expect(exitReasonOk(bad), String(bad)).toBe(false);
      expect(exitMechanismOk(bad), String(bad)).toBe(false);
    }
  });
});

describe('the refuter\'s CXV-1 — an id in disguise is still an id', () => {
  it('a zero-width space, a soft hyphen or a word joiner inside an id, full-width digits, upper-case hex: each is caught; ordinary text with the same characters is not', () => {
    // Astra's auto-id, Ab3dEf7hIj9kLm1nOp5q (20 characters), split in the middle or written with full-width digits
    for (const disguised of ['Ab3dEf7hIj\u200B9kLm1nOp5q', 'Ab3dEf7hIj\u00AD9kLm1nOp5q', 'Ab3dEf7hIj\u20609kLm1nOp5q', 'Ab３dEf７hIj９kLm１nOp５q', '0F1E2D3C4B5A69788796A5B4']) {
      expect(holdsIdentifier(`Recorded ${disguised} here.`), JSON.stringify(disguised)).toBe(true);
    }
    expect(holdsIdentifier('Recorded b-sep23\u200B-excerpt here.', ['b-sep23-excerpt'])).toBe(true);   // a known id split by a zero-width space
    expect(holdsIdentifier('Hold ＥＴＮ at ＄３８５．７０ for a week\u200B.')).toBe(false);
    expect(unmaskedText('Ａ１\u200B')).toBe('A1');
  });
});

describe('the policy\'s stated limits (build report §11.3) — pinned, so a change to them is seen', () => {
  it('CE-1\'s letter for the auto-id catches a 20-character mixed token holding a digit even when it is a coined word; an underscore sequence token is a sequence id — both left out, never let through', () => {
    expect(identifiersIn('RSI14AboveSMA50Cross held')).toEqual(['firestore-auto-id']);
    expect(identifiersIn('the trade_2026 rally')).toEqual(['battle-sequence']);
  });
  it('a 20-character auto-id with no digit has no shape — it is caught only when it is an id the caller knows exactly', () => {
    expect(identifiersIn('Recorded AbcDefGhiJklMnoPqrSt here.')).toEqual([]);
    expect(identifiersIn('Recorded AbcDefGhiJklMnoPqrSt here.', ['AbcDefGhiJklMnoPqrSt'])).toEqual(['known']);
  });
  it('an unknown auto-id glued to a word, or split across a line break, has no token of its own — caught only when known exactly', () => {
    expect(identifiersIn('battleAb3dEf7hIj9kLm1nOp5q')).toEqual([]);
    expect(identifiersIn('Ab3dEf7hIj\n9kLm1nOp5q')).toEqual([]);
    expect(identifiersIn('battleAb3dEf7hIj9kLm1nOp5q', ['Ab3dEf7hIj9kLm1nOp5q'])).toEqual(['known']);
  });
});
