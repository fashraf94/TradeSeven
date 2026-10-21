// src/screens/battleView/cockpit2bModel.test.js
//
// Cockpit Build 2b — THE V5 VIEW MODEL, flag on (spec
// docs/COCKPIT_BUILD2B_SPEC_V1_0.md §5, §6, §11 "Client"): the Now card's
// choice on every priority, tie-break, spotlight and the hold after "Confirm
// exit"; each plan, silence and facts sentence; §6.2's buttons from the shared
// table; the step on the card before and after confirm and after "Exit
// instead"; disabled chips; the meter at 7/1/0; the command card's canonical
// text and receipts; the replace confirmation's two lines; the strip's words
// and overflow per shell; the day line; Earlier; the board-row marks.
// The feed is cockpitModel's (buildCockpitFeed with v2) — the cards are its.

import { describe, it, expect } from 'vitest';
import { buildCockpitFeed } from './cockpitModel';
import {
  buildCockpit2bView, chooseNow, nowPriorityOf, planLinesOf, buttonLabelOf, meterOf, cardKeyOf, chipLevelOf,
  stripChipOf, dayLineOf, replaceLineOf, liveCommandOf, rowMarksOf, commandReceiptsOf, STRIP_SHOWN,
  benchSheetOf, agentListsOf, benchNoteOf, pctText,
} from './cockpit2bModel';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';

const T = (iso) => Date.parse(iso);
/** Wed Oct 21 2026, 1:20 PM ET. */
const NOW = T('2026-10-21T17:20:00.000Z');
const CLOSE = T('2026-10-21T20:00:00.000Z');
const at = (hhmmEt) => { const [h, m] = hhmmEt.split(':').map(Number); return T(`2026-10-21T${String(h + 4).padStart(2, '0')}:${String(m).padStart(2, '0')}:20.000Z`); };
const iso = (ms) => new Date(ms).toISOString();
const AGENT = 'Shadow';

let seq = 0;
const call = (over = {}) => {
  seq += 1;
  const minted = over.mintedAt ?? at('12:00') + 40_000;
  return {
    callId: `b:eval_020:call:${String(seq).padStart(3, '0')}`, kind: 'confirmation', battleId: 'b', evalId: 'eval_020', evalSeq: 20, mintedAt: minted, mintedMode: 'on',
    symbol: 'VLO', direction: 'exit', heldAtMint: false, slot: 'core', counterpart: null, counterpartRaw: null,
    condition: { side: 'below', level: 158.4 }, horizon: { phrase: 'this_session', expiresAt: CLOSE, basis: 'this_session' },
    defaultAction: 'act', said: 'x', saidOk: true, evidence: { tickId: null, availability: 'off', priceAsOf: iso(minted - 40_000) },
    hypothesisRef: null, origin: 'agent_initiative', state: 'open', stateChangedAt: minted, stateSource: 'mint',
    playerResponse: null, directiveThreadId: null, outcome: null, refused: null, replacementOptions: null, invalidatedReason: null,
    ...over,
  };
};
const minted = (hhmm) => ({ mintedAt: at(hhmm) + 40_000, evidence: { tickId: null, availability: 'off', priceAsOf: iso(at(hhmm)) } });
const EVALS = [{ evalId: 'eval_020', promptBuiltAt: iso(at('12:00')), evidence: { VLO: { px: 161.22 }, AMD: { px: 158.1 }, ZS: { px: 301.5 }, KO: { px: 61.4 } } }];

/** The battle the step's live test reads (D-7): VLO and KO held; the bench holds XOM, CVX, PSX (locked) and the crypto slot. */
const BATTLE = Object.freeze({
  directive: null,
  portfolio: {
    star: [{ symbol: 'ZS' }], core: [{ symbol: 'VLO' }, { symbol: 'KO' }], support: [{ symbol: 'BTC.CC', isCrypto: true }],
    bench: { stocks: [{ symbol: 'XOM' }, { symbol: 'CVX' }, { symbol: 'PSX', cooldownUntil: iso(CLOSE) }], crypto: { symbol: 'ETH.CC', isCrypto: true } },
  },
  watchlist: { hotBench: ['MPC'] },
});

const feedOf = (calls, over = {}) => buildCockpitFeed({ calls, events: [], evaluations: EVALS, directive: null, nowMs: NOW, nextDecisionAt: iso(at('13:30')), v2: true, ...over });
const view = (calls, over = {}) => {
  const { battle = BATTLE, ui = {}, rawExchanges = [], phone = false, events = [], ...feedOver } = over;
  const feed = feedOf(calls, { directive: battle?.directive ?? null, events, ...feedOver });
  return buildCockpit2bView({ feed, calls, events, rawExchanges, battle, agent: AGENT, nowMs: NOW, phone, evaluations: EVALS, nextDecisionAt: iso(at('13:30')), ui });
};

/** A filed command on `c`, as the endpoint writes it: the call's playerResponse and the battle's slot. */
function file(c, { kind = 'call_hold', answer = 'hold', text = 'Hold VLO through today\'s close.', pickSymbol = null, filedAt = iso(at('13:05')), heardEvalId = null } = {}) {
  const thread = `th-${c.callId}`;
  c.playerResponse = { answer, kind: 'directive', directiveThreadId: thread, callId: c.callId, filedAt, heardEvalId };
  c.directiveThreadId = thread;
  return {
    family: 'call', text, expiry: 'until_ms', expiresAtMs: CLOSE, directiveThreadId: thread, createdAt: filedAt, filedAt,
    callId: c.callId, kind,
    action: pickSymbol ? { direction: 'exit', symbol: c.symbol, slot: c.slot, pickSymbol } : { direction: c.direction, symbol: c.symbol, slot: c.slot },
  };
}
const ack = (c, filedAt = iso(at('13:06'))) => { c.playerResponse = { answer: 'go', kind: 'ack', callId: c.callId, filedAt }; return c; };
const cockpitFiling = (n) => Array.from({ length: n }, (_, i) => ({ source: 'cockpit', hasDirective: true, directiveThreadId: `x${i}` }));

// The four shapes the Now card asks about.
const exitActNoCp = (over = {}) => call({ ...minted('12:00'), replacementOptions: [{ symbol: 'MPC', source: 'agent' }, { symbol: 'XOM', source: 'bench' }, { symbol: 'PSX', source: 'bench' }, { symbol: 'KO', source: 'bench' }], ...over });
const entryAct = (over = {}) => call({ ...minted('12:00'), kind: 'called_shot', symbol: 'AMD', direction: 'entry', heldAtMint: false, slot: 'support', counterpart: 'KO', condition: { side: 'above', level: 163.5 }, ...over });
const holdShot = (over = {}) => call({ ...minted('12:00'), kind: 'called_shot', symbol: 'ZS', direction: 'exit', slot: 'star', defaultAction: 'hold', condition: { side: 'below', level: 290 }, ...over });
const upside = (over = {}) => call({ ...minted('12:00'), kind: 'called_shot', symbol: 'NVDA', direction: 'entry', heldAtMint: true, slot: 'star', defaultAction: 'hold', condition: { side: 'above', level: 625 }, ...over });

describe('§5.2 the Now card — the choice', () => {
  it('priority 1 (exit + act, no counterpart) leads over 2, 3 and the live command', () => {
    const v = view([holdShot(), entryAct(), exitActNoCp({ ...minted('12:45') })]);
    expect(v.now.symbol).toBe('VLO');
    expect(v.strip.count).toBe(2);
  });

  it('priority 2: any other unanswered act-default call; then 3: an unanswered hold-default called shot', () => {
    expect(view([holdShot(), entryAct()]).now.symbol).toBe('AMD');
    expect(view([holdShot()]).now.symbol).toBe('ZS');
    // A hold-default CONFIRMATION is not priority 3.
    const conf = holdShot({ kind: 'confirmation' });
    expect(nowPriorityOf(feedOf([conf]).needsYou[0])).toBeNull();
  });

  it('priority 4: the live command\'s own card when nothing asks', () => {
    const c = holdShot();
    const directive = file(c);
    const v = view([c], { battle: { ...BATTLE, directive } });
    expect(v.now.mode).toBe('command');
    expect(v.now.symbol).toBe('ZS');
  });

  it('within a priority the card whose OLDEST call was minted earliest leads — a newer call never pushes it aside — then the lowest callId', () => {
    const older = entryAct({ ...minted('12:00'), symbol: 'AMD' });
    const newer = entryAct({ ...minted('12:45'), symbol: 'ZS', slot: 'star' });
    expect(view([newer, older]).now.symbol).toBe('AMD');
    // A restatement of the newer card (a later member) does not move its key.
    const restated = entryAct({ ...minted('13:15'), symbol: 'ZS', slot: 'star' });
    expect(view([restated, newer, older]).now.symbol).toBe('AMD');
    // Same mint instant → the lowest callId.
    const a = entryAct({ ...minted('12:00'), symbol: 'AMD', callId: 'b:eval_020:call:a' });
    const b = entryAct({ ...minted('12:00'), symbol: 'ZS', slot: 'star', callId: 'b:eval_020:call:b' });
    expect(view([b, a]).now.callId).toBe('b:eval_020:call:a');
  });

  it('a spotlight leads until its card is answered or resolved; a spotlight on a card that no longer needs you is ignored', () => {
    const vlo = exitActNoCp();
    const zs = holdShot({ ...minted('12:45') });
    const key = cardKeyOf(feedOf([vlo, zs]).needsYou.find((t) => t.call.symbol === 'ZS'));
    expect(view([vlo, zs], { ui: { spotlightKey: key } }).now.symbol).toBe('ZS');
    ack(zs);
    expect(view([vlo, zs], { ui: { spotlightKey: key } }).now.symbol).toBe('VLO');
  });

  it('upside calls never lead, even spotlighted', () => {
    const up = upside();
    const v = view([up], { ui: { spotlightKey: up.callId } });
    expect(v.now).toBeNull();
    expect(v.quietLine).toBe('Nothing needs you · Shadow\'s next check ~1:30 PM');
    expect(v.strip.chips[0].text).toBe('NVDA ↑ 625 · upside');
    expect(v.strip.chips[0].spotlight).toBe(false);
  });

  it('after "Confirm exit" (an acknowledgment) the exit stays the Now card while held, with the step and Done (V5-6)', () => {
    const vlo = ack(exitActNoCp());
    const amd = entryAct({ ...minted('12:45') });
    // Not held: the acknowledged exit no longer needs you — the entry leads.
    expect(view([vlo, amd]).now.symbol).toBe('AMD');
    const held = view([vlo, amd], { ui: { heldKey: vlo.callId } });
    expect(held.now.symbol).toBe('VLO');
    expect(held.now.step.state).toBe('on_card');
    expect(held.now.step.done).toBe('Done');
    expect(held.now.buttons).toEqual([]);
    expect(held.now.tag.text).toBe('You agreed · 1:06 PM');
  });
});

describe('§5.2 the plan, silence and facts sentences — record fields only', () => {
  const lines = (c) => planLinesOf(c, { agent: AGENT, nowMs: NOW, evaluations: EVALS });
  it('exit + act', () => {
    expect(lines(exitActNoCp())).toEqual({
      plan: 'Shadow plans to exit VLO if it goes below $158.40 by today\'s close.',
      silence: 'If you say nothing, it exits.',
      facts: 'by today\'s close · VLO $161.22 · as of the 12:00 PM check',
    });
  });
  it('exit + hold', () => {
    expect(lines(holdShot()).plan).toBe('Shadow calls ZS below $290.00 by today\'s close, and plans to hold it.');
    expect(lines(holdShot()).silence).toBe('If you say nothing, it holds.');
  });
  it('entry + act, with and without a counterpart', () => {
    expect(lines(entryAct()).plan).toBe('Shadow plans to bring in AMD for KO if it goes above $163.50 by today\'s close.');
    expect(lines(entryAct({ counterpart: null })).plan).toBe('Shadow plans to bring in AMD if it goes above $163.50 by today\'s close.');
    expect(lines(entryAct()).silence).toBe('If you say nothing, it brings it in.');
  });
  it('entry + hold', () => {
    const c = entryAct({ defaultAction: 'hold', counterpart: null });
    expect(lines(c).plan).toBe('Shadow calls AMD above $163.50 by today\'s close, and plans to wait.');
    expect(lines(c).silence).toBe('If you say nothing, it waits.');
  });
  it('no cited price → the facts line is the deadline alone ("as of" never stands without its price)', () => {
    expect(planLinesOf(exitActNoCp(), { agent: AGENT, nowMs: NOW, evaluations: [] }).facts).toBe('by today\'s close');
  });
  it('a missing field renders nothing — never a guess', () => {
    expect(lines(exitActNoCp({ condition: { side: 'below', level: null } }))).toEqual({ plan: null, silence: null, facts: null });
    expect(lines(upside())).toEqual({ plan: null, silence: null, facts: null });
  });
});

describe('§6.2 the buttons — the shared table, agreeing first and free, every override one bullet', () => {
  const buttons = (c, over = {}) => view([c], over).now.buttons;
  it('exit + act: Confirm exit · Hold off ·●', () => {
    const b = buttons(exitActNoCp());
    expect(b.map((x) => [x.label, x.dot])).toEqual([['Confirm exit', false], ['Hold off', true]]);
    expect(b[1].aria).toBe('Hold off · 1 command');
    expect(b[0].aria).toBe('Confirm exit');
  });
  it('entry + act: Go if it triggers · Hold off ·●', () => {
    expect(buttons(entryAct()).map((x) => x.label)).toEqual(['Go if it triggers', 'Hold off']);
  });
  it('exit + hold with no counterpart: Hold · Exit instead ·● — which opens the step (V5-4)', () => {
    const b = buttons(holdShot());
    expect(b.map((x) => [x.label, x.dot, x.opensStep])).toEqual([['Hold', false, false], ['Exit instead', true, true]]);
  });
  it('exit + hold with a usable counterpart: Exit instead files directly', () => {
    expect(buttons(holdShot({ counterpart: 'XOM' })).find((x) => x.answer === 'go_now').opensStep).toBe(false);
  });
  it('entry + hold: Hold · Bring it in ·● — never "Add now" or "Go instead" (V5-2)', () => {
    expect(buttons(entryAct({ defaultAction: 'hold' })).map((x) => x.label)).toEqual(['Hold', 'Bring it in']);
    expect(buttonLabelOf({ direction: 'entry', defaultAction: 'hold' }, 'go_now')).toBe('Bring it in');
  });
  it('at zero commands the overrides read "No commands left" and are disabled; agreeing stays', () => {
    const b = buttons(exitActNoCp(), { rawExchanges: cockpitFiling(7) });
    expect(b.map((x) => [x.label, x.disabled, x.dot])).toEqual([['Confirm exit', false, false], ['No commands left', true, false]]);
  });
  it('sending: the pressed one reads "Sending…", both wait (no optimistic state)', () => {
    const c = exitActNoCp();
    const b = view([c], { pending: { callId: c.callId, answer: 'hold' }, ui: { pending: { callId: c.callId, answer: 'hold' } } }).now.buttons;
    expect(b.map((x) => [x.label, x.disabled])).toEqual([['Confirm exit', true], ['Sending…', true]]);
  });
});

describe('§5.3 Who comes in? — the stored options, judged at the server\'s now', () => {
  it('on the card (exit + act): two groups from replacementOptions; locked and held chips are disabled with their word', () => {
    const step = view([exitActNoCp()]).now.step;
    expect(step.title).toBe('Who comes in for VLO?');
    expect(step.browse).toBe('Browse the bench →');
    expect(step.groups.map((g) => g.label)).toEqual(['From Shadow\'s lists', 'From your bench · by rank']);
    expect(step.groups[0].chips.map((c) => [c.symbol, c.disabled, c.note])).toEqual([['MPC', false, null]]);
    expect(step.groups[1].chips.map((c) => [c.symbol, c.disabled, c.note])).toEqual([['XOM', false, null], ['PSX', true, 'locked'], ['KO', true, 'in your book']]);
  });
  it('an empty group is not drawn; a call minted before 2b (no options) shows only "Browse the bench →"', () => {
    const agentOnly = view([exitActNoCp({ replacementOptions: [{ symbol: 'MPC', source: 'agent' }] })]).now.step;
    expect(agentOnly.groups.map((g) => g.key)).toEqual(['agent']);
    const old = view([exitActNoCp({ replacementOptions: undefined })]).now.step;
    expect(old.groups).toEqual([]);
    expect(old.browse).toBe('Browse the bench →');
  });
  it('a cross-class name reads "can\'t come in"', () => {
    const step = view([exitActNoCp({ replacementOptions: [{ symbol: 'ETH.CC', source: 'bench' }] })]).now.step;
    expect(step.groups[0].chips[0]).toMatchObject({ symbol: 'ETH.CC', disabled: true, note: 'can\'t come in' });
  });
  it('at zero commands every chip disables and the step says "No commands left"', () => {
    const step = view([exitActNoCp()], { rawExchanges: cockpitFiling(7) }).now.step;
    expect(step.groups.flatMap((g) => g.chips).every((c) => c.disabled)).toBe(true);
    expect(step.noneLeft).toBe('No commands left');
  });
  it('after "Exit instead" (exit + hold, no counterpart): the step carries "Let Shadow choose" and Cancel', () => {
    const step = view([holdShot({ replacementOptions: [{ symbol: 'XOM', source: 'bench' }] })]).now.step;
    expect(step.state).toBe('after_exit_instead');
    expect(step.letChoose).toBe('Let Shadow choose');
    expect(step.cancel).toBe('Cancel');
    expect(step.done).toBeNull();
  });
  it('after a filed name: the command card keeps the step, every chip disabled, the chosen one marked, "✓ XOM comes in if VLO exits · filed"', () => {
    const c = exitActNoCp();
    const directive = file(c, { kind: 'call_replace', answer: 'replace', pickSymbol: 'XOM', text: 'If you exit VLO by today\'s close, bring in XOM.' });
    const v = view([c], { battle: { ...BATTLE, directive } });
    expect(v.now.mode).toBe('command');
    expect(v.now.text).toBe('If you exit VLO by today\'s close, bring in XOM.');
    expect(v.now.step.filedLine).toBe('✓ XOM comes in if VLO exits · filed');
    const chips = v.now.step.groups.flatMap((g) => g.chips);
    expect(chips.every((x) => x.disabled)).toBe(true);
    expect(chips.filter((x) => x.picked).map((x) => x.symbol)).toEqual(['XOM']);
  });
});

describe('§5.2 the command card — the canonical text verbatim, then the receipts (V5-2, V5-3)', () => {
  it('eyebrow "Your command · on the {t} wording"; the text from the slot; Filed → not yet heard; no buttons, no Change', () => {
    const c = holdShot();
    const directive = file(c, { text: 'Hold ZS through today\'s close, even if it goes below $290.00.' });
    const card = view([c], { battle: { ...BATTLE, directive } }).now;
    expect(card.eyebrow).toBe('Your command · on the 12:00 PM wording');
    expect(card.text).toBe('Hold ZS through today\'s close, even if it goes below $290.00.');
    expect(card.receipts).toEqual(['Filed 1:05 PM', 'not yet heard']);
    expect(card.buttons).toEqual([]);
    expect(JSON.stringify(card)).not.toMatch(/Change/);
  });
  it('the text comes from the thread\'s exchange once the slot holds another thread', () => {
    const c = holdShot();
    const filed = file(c, { text: 'Hold ZS.' });
    const exchanges = [{ source: 'cockpit', hasDirective: true, directiveThreadId: filed.directiveThreadId, directive: filed }];
    const card = view([c], { battle: { ...BATTLE, directive: null }, rawExchanges: exchanges, exchanges }).now;
    expect(card).toBeNull(); // not live → no priority 4; the card is a strip chip
    const v = view([c], { battle: { ...BATTLE, directive: null }, rawExchanges: exchanges, exchanges, ui: { expandedKey: c.callId } });
    expect(v.strip.chips[0].card.text).toBe('Hold ZS.');
    expect(v.strip.chips[0].card.receipts).toEqual(['Filed 1:05 PM', 'not heard']);
  });
  it('heard → "Heard at the {t} check"; the outcome follows (Acted)', () => {
    const c = holdShot();
    const directive = file(c, { heardEvalId: 'eval_020' });
    const tag = { fact: 'event:acted', tone: 'acted', text: 'Acted at the 1:15 PM check' };
    expect(commandReceiptsOf(c, tag, { evaluations: EVALS })).toEqual(['Filed 1:05 PM', 'Heard at the 12:00 PM check', 'Acted at the 1:15 PM check']);
    expect(view([c], { battle: { ...BATTLE, directive } }).now.receipts).toEqual(['Filed 1:05 PM', 'Heard at the 12:00 PM check']);
  });
  it('no check left today → "no check left today"', () => {
    const c = holdShot();
    const tag = { fact: 'answer:directive_no_check', tone: 'yours', text: 'Filed · no check left today' };
    file(c);
    expect(commandReceiptsOf(c, tag)).toEqual(['Filed 1:05 PM', 'no check left today']);
  });
});

describe('§5.1 the commands meter — derived from the raw exchanges', () => {
  it('7 / 1 / 0, with the aria label; acks and chat never count', () => {
    expect(meterOf([])).toMatchObject({ left: 7, zero: false, text: '· 7 left', aria: '7 of 7 commands left' });
    expect(meterOf([...cockpitFiling(6), { source: 'chat', hasDirective: true }, { source: 'cockpit', hasDirective: false }])).toMatchObject({ left: 1, text: '· 1 left' });
    expect(meterOf(cockpitFiling(9))).toMatchObject({ left: 0, zero: true, text: 'No commands left', aria: '0 of 7 commands left' });
  });
  it('no meter in a league battle', () => {
    expect(meterOf([], { league: true })).toBeNull();
  });
});

describe('§6.3 the replace confirmation', () => {
  it('for a cockpit command, from the live slot', () => {
    const c = holdShot();
    const directive = file(c, { text: 'Hold ZS through today\'s close.' });
    const live = liveCommandOf({ directive, nowMs: NOW });
    expect(replaceLineOf({ kind: 'cockpit', symbol: live.symbol, text: live.text, agent: AGENT }))
      .toBe('This replaces your command on ZS — "Hold ZS through today\'s close.". Shadow stops hearing it at its next check.');
  });
  it('for a chat directive (from a 409 replace_unconfirmed body\'s currentText)', () => {
    expect(replaceLineOf({ kind: 'chat', text: 'Sell AMD at the open', agent: AGENT }))
      .toBe('This replaces your chat instruction — "Sell AMD at the open". Shadow stops hearing it at its next check.');
  });
  it('no text → no line', () => {
    expect(replaceLineOf({ kind: 'chat', text: '', agent: AGENT })).toBeNull();
    expect(liveCommandOf({ directive: { family: 'chat', text: 'x', directiveThreadId: 't', expiresAtMs: CLOSE }, nowMs: NOW })).toBeNull();
  });
});

describe('§5.4 Also live — the words and the overflow per shell', () => {
  it('exit / hold / enter / wait for unanswered calls by their default', () => {
    const f = feedOf([exitActNoCp(), holdShot(), entryAct(), entryAct({ symbol: 'MU', defaultAction: 'hold' })]);
    const words = [...f.needsYou, ...f.waiting].map((t) => stripChipOf(t).text);
    expect(words).toEqual(expect.arrayContaining(['VLO ↓ 158.40 · exit', 'ZS ↓ 290 · hold', 'AMD ↑ 163.50 · enter', 'MU ↑ 163.50 · wait']));
  });
  it('"your command" (yours) for the live command\'s card; "you agreed" for an acknowledged call', () => {
    const zs = holdShot();
    const directive = file(zs);
    const vlo = ack(exitActNoCp());
    const v = view([zs, vlo, entryAct({ ...minted('12:45') })], { battle: { ...BATTLE, directive } });
    const byText = Object.fromEntries(v.strip.chips.map((c) => [c.text.split(' ')[0], c]));
    expect(byText.ZS.text).toBe('ZS ↓ 290 · your command');
    expect(byText.ZS.yours).toBe(true);
    expect(byText.VLO.text).toBe('VLO ↓ 158.40 · you agreed');
  });
  it('a moved line adds "· line moved"', () => {
    const a = entryAct({ ...minted('12:00'), condition: { side: 'above', level: 163.5 } });
    const b = entryAct({ ...minted('12:45'), condition: { side: 'above', level: 170 } });
    const t = feedOf([a, b]).needsYou[0];
    expect(stripChipOf(t).text).toBe('AMD ↑ 170 · enter · line moved');
  });
  it('phone shows 4 chips, desktop 6, then "+{n} more"; open → every chip and "fewer"', () => {
    const syms = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'];
    const calls = [exitActNoCp(), ...syms.map((s, i) => entryAct({ symbol: s, ...minted(`12:${String(10 + i).padStart(2, '0')}`) }))];
    const phone = view(calls, { phone: true });
    expect(phone.strip.count).toBe(8);
    expect(phone.strip.chips).toHaveLength(STRIP_SHOWN.phone);
    expect(phone.strip.more).toBe('+4 more');
    const desk = view(calls);
    expect(desk.strip.chips).toHaveLength(STRIP_SHOWN.desktop);
    expect(desk.strip.more).toBe('+2 more');
    const open = view(calls, { ui: { overflow: true } });
    expect(open.strip.chips).toHaveLength(8);
    expect(open.strip.more).toBeNull();
    expect(open.strip.fewer).toBe('fewer');
    expect(open.strip.header).toBe('Also live · 8');
  });
  it('an expanded chip carries its card anatomy; "Spotlight →" only on a card that needs you', () => {
    const amd = entryAct({ ...minted('12:45') });
    const v = view([exitActNoCp(), amd], { ui: { expandedKey: amd.callId } });
    expect(v.strip.chips[0].card.plan).toBe('Shadow plans to bring in AMD for KO if it goes above $163.50 by today\'s close.');
    expect(v.strip.chips[0].spotlight).toBe(true);
  });
});

describe('§5.5 the day line and §5.6 Earlier', () => {
  it('counts every \'on\' record; a zero part is still shown', () => {
    const calls = [exitActNoCp(), holdShot({ state: 'hit' }), entryAct({ state: 'expired_unresolved' }), ack(entryAct({ symbol: 'MU' })), call({ mintedMode: 'shadow' })];
    expect(dayLineOf(calls)).toBe('Today · 4 calls · 1 hit · 1 expired · you answered 1');
    expect(dayLineOf([])).toBe('Today · 0 calls · 0 hit · 0 expired · you answered 0');
  });
  it('Earlier rows read "{SYM} {↑|↓} {level} · {tag}"', () => {
    const v = view([holdShot({ state: 'expired_unresolved', stateChangedAt: at('13:00') })]);
    expect(v.earlier.count).toBe(1);
    expect(v.earlier.rows[0].text).toBe('ZS ↓ 290 · Expired · by today\'s close');
  });
});

describe('§5.8 the board-row marks', () => {
  it('"command" for the live command\'s book symbol, "open" for every other open call\'s; swapOut for a pick', () => {
    const zs = holdShot();
    const directive = file(zs);
    const f = feedOf([zs, entryAct()], { directive });
    expect(rowMarksOf({ feed: f, directive, nowMs: NOW })).toEqual({ ZS: 'command', AMD: 'open' });
    const pick = { family: 'call', text: 'Bring in XOM for KO at the next check.', directiveThreadId: 't', expiresAtMs: CLOSE, kind: 'call_pick', action: { symbol: 'KO', swapOut: 'KO', pickSymbol: 'XOM' } };
    expect(rowMarksOf({ feed: feedOf([]), directive: pick, nowMs: NOW })).toEqual({ KO: 'command' });
  });
});

describe('the chip level and the choice helpers', () => {
  it('chipLevelOf drops "$" and a trailing ".00"', () => {
    expect(chipLevelOf(625)).toBe('625');
    expect(chipLevelOf(412.5)).toBe('412.50');
    expect(chipLevelOf(null)).toBe('');
  });
  it('chooseNow on an empty list → null; the quiet line names the next check', () => {
    expect(chooseNow([])).toBeNull();
    expect(COPY.cockpit2bQuiet(AGENT, null)).toBe('Nothing needs you');
  });
});

describe('§5.7 the bench sheet (6A) — the endpoint\'s rows, as read', () => {
  const ROWS = [
    { symbol: 'XOM', name: 'Exxon', sector: 'Energy', rank: 3, price: 112.4, changePct: 1.24, atrPct: 1.83, status: 'available', lockedUntil: null },
    { symbol: 'PSX', name: null, sector: 'Energy', rank: 1, price: 140, changePct: -0.5, atrPct: 2.1, status: 'locked', lockedUntil: iso(CLOSE) },
    { symbol: 'MPC', name: null, sector: null, rank: null, price: null, changePct: null, atrPct: null, status: 'no_price', lockedUntil: null },
    { symbol: 'CVX', name: 'Chevron', sector: 'Energy', rank: 2, price: 150, changePct: 2.6, atrPct: 1.4, status: 'not_swappable', lockedUntil: null },
    { symbol: 'AAPL', name: 'Apple', sector: 'Tech', rank: 5, price: 230, changePct: 0, atrPct: 1.1, status: 'available', lockedUntil: null },
  ];
  const DATA = { asOf: iso(at('13:15')), out: { symbol: 'VLO', slot: 'core' }, rows: ROWS };
  const sheet = (over = {}) => benchSheetOf({ status: 'ready', data: DATA, call: exitActNoCp(), step: 'on_card', agent: AGENT, agentLists: new Set(['XOM']), benchState: { cards: [{ text: 'XOM keeps **holding** its range.', symbols: ['XOM'] }] }, ...over });

  it('scoped: the title, the sub (names · available · prices as of), Rank first, every status row', () => {
    const s = sheet();
    expect(s.title).toBe('Who comes in for VLO?');
    expect(s.sub).toBe('5 names · 2 available · prices as of 1:15 PM');
    expect(s.sorts.map((x) => [x.key, x.on])).toEqual([['rank', true], ['move', false], ['sector', false]]);
    expect(s.rows.map((r) => [r.symbol, r.rank, r.action.kind, r.action.label])).toEqual([
      ['PSX', '1', 'locked', 'locked until 4:00 PM'],
      ['CVX', '2', 'not_swappable', 'can\'t come in'],
      ['XOM', '3', 'pick', 'Pick'],
      ['AAPL', '5', 'pick', 'Pick'],
      ['MPC', '—', 'no_price', 'no price'],
    ]);
    const xom = s.rows.find((r) => r.symbol === 'XOM');
    expect(xom).toMatchObject({ sector: 'Energy', day: '+1.2%', atr: 'ATR 1.8%', onAgentList: true, note: 'XOM keeps **holding** its range.' });
    expect(xom.action).toMatchObject({ answer: 'replace', dot: true, disabled: false, aria: 'Pick XOM · 1 command' });
    // The note only from the selector: a name no sentence names shows nothing.
    expect(s.rows.find((r) => r.symbol === 'AAPL').note).toBeNull();
    expect(s.rows.find((r) => r.symbol === 'MPC')).toMatchObject({ sector: '—', day: '—', atr: '—', onAgentList: false });
  });
  it('the sorts: today\'s move (unknowns last) and sector then rank', () => {
    expect(sheet({ sort: 'move' }).rows.map((r) => r.symbol)).toEqual(['CVX', 'XOM', 'AAPL', 'PSX', 'MPC']);
    expect(sheet({ sort: 'sector' }).rows.map((r) => r.symbol)).toEqual(['PSX', 'CVX', 'XOM', 'AAPL', 'MPC']);
  });
  it('after "Exit instead" a pick files go_now with the name', () => {
    expect(sheet({ call: holdShot(), step: 'after_exit_instead' }).rows.find((r) => r.symbol === 'XOM').action.answer).toBe('go_now');
  });
  it('browse (the Research pill): "The bench", "available" in place of Pick, the lock alone', () => {
    const s = sheet({ call: null, step: null });
    expect(s.title).toBe('The bench');
    expect(s.rows.find((r) => r.symbol === 'XOM').action).toEqual({ kind: 'available', label: 'available' });
  });
  it('after filing: the bar "✓ Filed · {canonical text}" with Done, every Pick disabled', () => {
    const s = sheet({ filedText: 'If you exit VLO by today\'s close, bring in XOM.' });
    expect(s.filedBar).toBe('✓ Filed · If you exit VLO by today\'s close, bring in XOM.');
    expect(s.done).toBe('Done');
    expect(s.rows.filter((r) => r.action.kind === 'pick').every((r) => r.action.disabled && !r.action.dot)).toBe(true);
  });
  it('at zero commands every Pick waits and the sheet says so', () => {
    const s = sheet({ meter: meterOf(cockpitFiling(7)) });
    expect(s.noneLeft).toBe('No commands left');
    expect(s.rows.filter((r) => r.action.kind === 'pick').every((r) => r.action.disabled)).toBe(true);
  });
  it('loading and error say so; no rows are invented', () => {
    expect(sheet({ status: 'loading', data: null })).toMatchObject({ loading: 'Reading the bench…', rows: [], sub: null });
    expect(sheet({ status: 'error', data: null })).toMatchObject({ error: 'Couldn\'t read the bench right now.', rows: [] });
  });
  it('agentListsOf: the newest evaluation\'s candidates and the newest watching list', () => {
    const e = agentListsOf({ evaluations: [{ candidates: [{ symbol: 'OLD' }] }, { candidates: [{ symbol: 'XOM', direction: 'potential_entry' }] }], monitoring: { symbols: ['MPC'] } });
    expect([...e].sort()).toEqual(['MPC', 'XOM']);
    expect(benchNoteOf(null, 'XOM')).toBeNull();
    expect(pctText(-0.84)).toBe('−0.8%');
  });
});

describe('§7.4 words that never appear — every 2b string', () => {
  it('none of Held off, Holding, Declined, Honored, Superseded, Asking you, Ask me first, suggests, offers', () => {
    const banned = /\b(Held off|Holding|Declined|Honou?red|Superseded|Asking you|Ask me first|suggests|offers)\b/i;
    const strings = Object.entries(COPY).filter(([k]) => k.startsWith('cockpit2b'));
    expect(strings.length).toBeGreaterThan(60);
    for (const [key, value] of strings) {
      const out = typeof value === 'function'
        ? [value('x', 'y', 'z', 'w', 'v', 'u'), value(3), value(null), value(AGENT, 'VLO', 'below', '$158.40', 'by today\'s close'), value(true), value(false)]
        : [value];
      for (const s of out) if (typeof s === 'string') expect(s, key).not.toMatch(banned);
    }
  });
  it('an upside call never says "add": its card is the upside line alone, its chip the word "upside"', () => {
    const up = upside();
    const v = view([up], { ui: { expandedKey: up.callId } });
    const card = v.strip.chips[0].card;
    expect(card.mode).toBe('upside');
    expect(card.buttons).toEqual([]);
    expect(card.step).toBeNull();
    expect(JSON.stringify(v.strip.chips[0])).not.toMatch(/\badd\b/i);
  });
});
