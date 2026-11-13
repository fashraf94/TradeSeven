// @vitest-environment jsdom
//
// Shared Research B2 — EVERY STATE of spec §7.2 (with §15–§17 and K-6), rendered
// from the server's own answers (__fixtures__/answers.json, composed by B1's
// functions in srAnswers.test.js). No network: fetchWithAuth is the fake route.
// The flows (the drop modal in a real HubSheet, the corrections, running, the
// uncertain save, the rate limit, previewRev) are in the .flows. file.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchWithAuth = vi.hoisted(() => vi.fn());
vi.mock('../../utils/fetchWithAuth', () => ({ fetchWithAuth }));
const transitionHypothesis = vi.hoisted(() => vi.fn());
vi.mock('../../services/hypothesisVersionService', () => ({ transitionHypothesis }));
const equipLoadoutBook = vi.hoisted(() => vi.fn());
vi.mock('../../services/loadoutService', () => ({ equipLoadoutBook }));

const { default: Body } = await import('./SharedResearchSheetBody');
const { SR_COPY: COPY } = await import('./sharedResearchCopy');
const kit = await import('./__fixtures__/srKit');
const { A, IDS, fakeServer, mount, flush, click, typeInto, $, $$, buttonNamed, textOf, storyOf, deferred } = kit;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let mounted = [];
let server;
const keep = (m) => { mounted.push(m); return m; };
beforeEach(() => {
  server = fakeServer({ list: A.list, get: A.getStepped });
  fetchWithAuth.mockImplementation(server.fetch);
});
afterEach(() => { for (const m of mounted) m.unmount(); mounted = []; vi.clearAllMocks(); vi.useRealTimers(); });

const STORIES5 = [0, 1, 2, 3, 4].map((i) => storyOf({ itemRef: { recordKind: 'fantasyTimesStories', recordId: `${IDS.story.id}-${i}` }, headline: `${IDS.story.headline} ${i}` }));
async function open(props = {}, routes = {}) {
  for (const [k, v] of Object.entries(routes)) server.set(k, v);
  const m = keep(mount(<Body stories={STORIES5.slice(0, 3)} agentName="Atlas" agentId="agent-fixture-1" onClose={vi.fn()} {...props} />));
  await flush();
  return m;
}
const label = (screen) => $(`[data-screen-label="${screen}"]`);

describe('Start (spec §7.2)', () => {
  it('no open work: no Continue section; the stories, Bring your own and Use a SignalDrop', async () => {
    await open({}, { list: A.listEmpty });
    expect(label('Continue your research')).toBeNull();
    expect(label('Recent stories')).not.toBeNull();
    expect(label('Bring your own starting point')).not.toBeNull();
    expect($('[data-sr-use-drop]').textContent).toBe(COPY.signaldrop);
    expect(server.sent('list')).toHaveLength(1);
    expect(server.calls.every((c) => c.key === 'list')).toBe(true); // browsing writes nothing
  });

  it('open work: a Continue row per open investigation; Continue reads it and shows its work', async () => {
    await open({}, { list: A.list, get: A.getShopPay });
    const row = $(`[data-sr-continue="${IDS.spSid}"]`);
    expect(row.textContent).toContain(A.list.body.open[0].question);
    click(row);
    await flush();
    expect(server.sent('get')[0].url).toContain(`sessionId=${IDS.spSid}`);
    expect(label('Work · open')).not.toBeNull();
  });

  it('stories: three of five with "Show more · 2"; Show more shows all five', async () => {
    await open({ stories: STORIES5 });
    expect($$('[data-sr-story]')).toHaveLength(3);
    click(buttonNamed(COPY.more(2)));
    expect($$('[data-sr-story]')).toHaveLength(5);
    expect(buttonNamed(COPY.fewer)).not.toBeNull();
  });

  it('no stories: the empty line, and Bring your own still there', async () => {
    await open({ stories: [] });
    expect($('[data-sr-no-stories]').textContent).toContain(COPY.noStories);
    expect($('#sr-own')).not.toBeNull();
  });

  it('stale stories: every story older than 48 h shows "Stories last updated {date}"', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-14T15:00:00.000Z')); // the newest story is 2026-11-11 13:30Z
    await open();
    expect($('[data-sr-stale]').textContent).toBe(COPY.stale('Nov 11, 2026'));
  });

  it('gated (the prop): the stories stay readable, the gated line shows, nothing can start one', async () => {
    await open({ gated: true });
    expect($('[data-sr-gated]').textContent).toBe(`${COPY.gated}. ${COPY.gatedSub}`);
    expect($$('[data-sr-story]')).toHaveLength(3);
    expect($('#sr-own').disabled).toBe(true);
    expect($('[data-sr-frame]').disabled).toBe(true);
    expect($('[data-sr-use-drop]').disabled).toBe(true);
    click($$('[data-sr-story]')[0]);
    expect(label('Item preview')).not.toBeNull();
    expect($('[data-sr-investigate]')).toBeNull();
    expect($('[data-sr-gated]')).not.toBeNull();
  });

  it('gated (a server 404 disabled): the same — stories, the gated line, no Investigate', async () => {
    await open({ gated: false }, { list: A.disabled });
    expect($('[data-sr-gated]')).not.toBeNull();
    expect($('[data-sr-frame]').disabled).toBe(true);
    click($$('[data-sr-story]')[0]);
    expect($('[data-sr-investigate]')).toBeNull();
  });

  it('daily limit (the quota): the server\'s line; the preview\'s Investigate is held', async () => {
    await open({}, { list: A.listDailyLimit });
    expect($('[data-sr-limit="daily_limit"]').textContent).toBe(COPY.server.daily_limit);
    click($$('[data-sr-story]')[0]);
    expect($('[data-sr-investigate]').disabled).toBe(true);
  });

  it('framing limit (the quota): the server\'s line; Frame my question is held', async () => {
    await open({}, { list: A.listFramingLimit });
    typeInto($('#sr-own'), 'Shop Pay');
    expect($('[data-sr-limit="framing_limit"]').textContent).toBe(COPY.server.framing_limit);
    expect($('[data-sr-frame]').disabled).toBe(true);
  });

  it('budget paused (a refusal): the frame shows the server\'s own line; the words stay in the box', async () => {
    await open({}, { frame: A.budget_paused });
    typeInto($('#sr-own'), 'Shop Pay');
    click($('[data-sr-frame]'));
    await flush();
    expect($('[data-sr-refusal="budget_paused"]').textContent).toBe(A.budget_paused.body.message);
    expect($('#sr-own').value).toBe('Shop Pay');
  });
});

describe('Framing (spec §7.2)', () => {
  it('running only while the call is in flight; then the framed question, what I\'ll check, what it does not establish', async () => {
    const held = deferred();
    await open({}, { frame: held.promise, open: A.openFramed });
    typeInto($('#sr-own'), IDS.observation);
    click($('[data-sr-frame]'));
    await flush();
    expect($('[role="status"]').textContent).toBe(COPY.framing);
    held.resolve(A.framed);
    await flush();
    expect($('[role="status"]')?.textContent ?? '').not.toBe(COPY.framing);
    expect($('#sr-frame-q').value).toBe(IDS.frame.question);
    expect(textOf()).toContain(IDS.frame.check);
    expect(textOf()).toContain(IDS.frame.notEstablished);
    expect(textOf()).toContain(COPY.yourObs);
    click($('[data-sr-investigate]'));
    await flush();
    const sent = server.sent('open')[0].body;
    expect(sent).toEqual({ action: 'open', sessionId: IDS.obsSid, question: IDS.frame.question });
    expect(label('Work · open')).not.toBeNull();
  });

  it('failed: the server\'s frame_failed line (the answer carries no message) and Try again re-sends the same request id', async () => {
    await open({}, { frame: [A.frameFailed, A.framed] });
    typeInto($('#sr-own'), IDS.observation);
    click($('[data-sr-frame]'));
    await flush();
    expect($('[role="alert"]').textContent).toBe(COPY.server.frame_failed);
    click($('[data-sr-retry-frame]'));
    await flush();
    const [first, second] = server.sent('frame').map((c) => c.body);
    expect(second.requestId).toBe(first.requestId);
    expect(second.observation).toBe(first.observation);
    expect($('#sr-frame-q').value).toBe(IDS.frame.question);
  });
});

describe('Item preview (spec §7.2)', () => {
  it('fresh: the headline, "From FantasyTimes · {reporter} · {time}", the beat\'s question editable, direction optional; nothing sent until Investigate', async () => {
    await open({ mode: 'item', item: storyOf(), direction: 'Look at suppliers first' }, { open: A.openStory });
    expect(label('Item preview')).not.toBeNull();
    expect(textOf()).toContain(IDS.story.headline);
    expect(textOf()).toContain('From FantasyTimes · Doug · ');
    expect($('#sr-item-q').value).toBe(storyOf().question);
    expect($('#sr-item-dir').value).toBe('Look at suppliers first');
    expect(server.sent('open')).toHaveLength(0);
    typeInto($('#sr-item-q'), 'Which suppliers earn from this?');
    click($('[data-sr-investigate]'));
    await flush();
    const body = server.sent('open')[0].body;
    expect(body.entry).toEqual({ kind: 'item', itemRef: { recordKind: 'fantasyTimesStories', recordId: IDS.story.id }, question: 'Which suppliers earn from this?', direction: 'Look at suppliers first' });
    expect(typeof body.requestId).toBe('string');
    expect(label('Work · open')).not.toBeNull();
  });

  it('existing: the Continue state — nothing new is created; Continue shows the open one', async () => {
    await open({ mode: 'item', item: storyOf() }, { open: A.openDropExisting });
    click($('[data-sr-investigate]'));
    await flush();
    expect(label('Existing investigation')).not.toBeNull();
    expect(textOf()).toContain(COPY.existingOpen);
    click($('[data-sr-continue-existing]'));
    expect(label('Work · open')).not.toBeNull();
  });
});

describe('Work (spec §7.2)', () => {
  it('the opening (no summary): no answer yet, what the records already hold, the story as "From FantasyTimes", never Source-backed', async () => {
    await open({ mode: 'item', item: storyOf() }, { open: A.openStory });
    click($('[data-sr-investigate]'));
    await flush();
    expect(label('Opening · no answer yet')).not.toBeNull();
    const stored = $('[data-sr-stored]').textContent;
    expect(stored).toContain('Eaton Corporation plc · ETN · Industrials · Ranking score 71');
    const story = A.openStory.body.record.findings.find((f) => f.statusReason === 'reporter_content');
    const card = $(`[data-sr-finding="${story.findingId}"]`);
    expect(card.textContent).toContain('From FantasyTimes');
    expect(card.textContent).not.toContain('Source-backed');
    expect(label('Short answer')).toBeNull();
  });

  it('an answer: the short answer, companies, the four lines, the next step and the steps left', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: A.getStepped });
    expect($('[data-sr-answer]').textContent).toContain(A.getStepped.body.record.summary.text.slice(0, 40));
    expect($('[data-sr-company="ETN"]')).not.toBeNull();
    expect(label('Four lines')).not.toBeNull();
    expect($('[data-sr-next]').textContent).toBe(A.getStepped.body.record.nextAction.fact.split(' — ')[0]);
    expect(textOf()).toContain(COPY.remaining(9));
  });

  it('a failed step (the session records it): the server\'s step_failed line and Try again with the same stepId', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: A.getStepFailed, step: A.stepNext });
    expect($('[data-sr-step-failed]').textContent).toBe(COPY.server.step_failed);
    click($('[data-sr-retry-step]'));
    await flush();
    expect(server.sent('step')[0].body).toMatchObject({ stepId: A.getStepFailed.body.session.lastStep.stepId, intent: 'next' });
  });

  it('a failed step (the answer, 200, no message): the server\'s line; findings_full as the reason shows its own line, no Try again', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: A.getStepped, step: [A.stepFailed, A.stepFindingsFullReason] });
    click($('[data-sr-next]'));
    await flush();
    expect($('[data-sr-step-failed]').textContent).toBe(COPY.server.step_failed);
    click($('[data-sr-retry-step]'));
    await flush();
    expect($('[data-sr-step-failed]').textContent).toBe(COPY.server.findings_full);
    expect($('[data-sr-retry-step]')).toBeNull();
  });

  it('budget spent: the server\'s line; no next step; reading, Turn this into an idea and closing stay', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: A.getSpent });
    expect($('[data-sr-limit="budget_spent"]').textContent).toBe(COPY.server.budget_spent);
    expect($('[data-sr-next]')).toBeNull();
    expect($('[data-sr-examine]')).toBeNull();
    expect($('[data-sr-adopt]').disabled).toBe(false);
    expect($('[data-sr-conclude]').disabled).toBe(false);
  });

  it('step limit (the quota): the server\'s line; steps held', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: { status: 200, body: { ...A.getStepped.body, quota: A.listStepLimit.body.quota } } });
    expect($('[data-sr-limit="step_limit"]').textContent).toBe(COPY.server.step_limit);
    expect($('[data-sr-next]').disabled).toBe(true);
  });

  it('no next step: "No next step is proposed…", never "answered"', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: A.getNoNext });
    expect($('[data-sr-no-next]').textContent).toBe(COPY.noNext);
    expect($('[data-sr-next]')).toBeNull();
    expect(textOf()).not.toMatch(/answered your question|question is answered/i);
  });

  it('concluded: the ended notice, the answer kept, no step and no direction; Return and Start a new investigation', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: A.getConcluded });
    expect(label('Work · completed')).not.toBeNull();
    expect(textOf()).toContain(COPY.concluded);
    expect(label('Short answer')).not.toBeNull();
    expect(label('Direction')).toBeNull();
    expect($('[data-sr-next]')).toBeNull();
    expect(buttonNamed(COPY.returnCC)).not.toBeNull();
    expect(buttonNamed(COPY.newInv)).not.toBeNull();
  });

  it('saved: "Saved as an idea", no actions but Return', async () => {
    await open({ mode: 'session', sessionId: IDS.spSid }, { get: A.getShopPaySaved });
    expect(label('Work · saved')).not.toBeNull();
    expect(textOf()).toContain(COPY.savedNotice);
    expect($('[data-sr-adopt]')).toBeNull();
  });

  it('age + Refresh: an answer older than two days says so; Refresh is a step with intent refresh', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: A.getAged, step: A.stepRefreshSame });
    expect(textOf()).toContain(COPY.older(A.getAged.body.record.age));
    click($('[data-sr-refresh]'));
    await flush();
    expect(server.sent('step')[0].body).toMatchObject({ action: 'step', intent: 'refresh', sessionId: IDS.dcSid });
  });
});

describe('Companies (spec §7.2)', () => {
  it('supported: the server\'s card — name, symbol, role, relationship, the open question, eligibility, Examine, Turn this into an idea', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: A.getStepped });
    const etn = A.getStepped.body.companies.supported[0];
    const card = $('[data-sr-company="ETN"]');
    expect(card.textContent).toContain(etn.name);
    expect(card.textContent).toContain(etn.relationship);
    expect(card.textContent).toContain(etn.openQuestion.fact);
    expect(card.textContent).toContain("In the game's universe");
    expect($('[data-sr-examine="ETN"]')).not.toBeNull();
    expect($('[data-sr-adopt-from="ETN"]')).not.toBeNull();
    // exactly the server's supported list: a lead never becomes a card (Correction A)
    expect($$('[data-sr-company]').map((e) => e.dataset.srCompany)).toEqual(['ETN']);
    expect($$('[data-sr-examine]').map((e) => e.dataset.srExamine)).toEqual(['ETN']);
  });

  it('leads: labelled, "Not an adoption choice until the connection has a source", no Examine', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: A.getStepped });
    const lead = $('[data-sr-lead="Northfield Thermal"]');
    // its own label: the server could not identify it; the sourced fact about it keeps its own label
    expect(lead.firstElementChild.lastElementChild.textContent).toBe("Unresolved · Symbol · not in the app's records");
    expect(lead.textContent).toContain('Source-backed');
    expect(lead.textContent).toContain(COPY.leadNote);
    expect(lead.querySelector('button')).toBeNull();
  });

  it('none yet: "No public company has a supported connection yet"; Turn this into an idea held with the reason', async () => {
    const body = { ...A.getStepped.body, companies: { supported: [], leads: A.getStepped.body.companies.leads }, adoptPreview: null };
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: { status: 200, body } });
    expect(textOf()).toContain(COPY.noCompanies);
    expect($('[data-sr-adopt]').disabled).toBe(true);
    expect(textOf()).toContain(COPY.adoptBlocked);
  });

  it('none (concluded): "No supported public company in this chain…"', async () => {
    const body = { ...A.getConcluded.body, companies: { supported: [], leads: [] } };
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: { status: 200, body } });
    expect(textOf()).toContain(COPY.noCompaniesEnded);
  });
});

describe('K-6: what §15–§17 add to the screens', () => {
  it('(a) previous: "You investigated this on {date} · Open the earlier one" on the new investigation; Open reads it read-only', async () => {
    await open({ mode: 'item', item: storyOf() }, { open: A.openStoryPrevious, get: A.getConcluded });
    click($('[data-sr-investigate]'));
    await flush();
    const line = $(`[data-sr-previous="${IDS.previousSid}"]`);
    expect(line.textContent).toContain(COPY.previous('Nov 9, 2026'));
    click(buttonNamed(COPY.openEarlier));
    await flush();
    expect(server.sent('get')[0].url).toContain(`sessionId=${IDS.previousSid}`);
    expect(textOf()).toContain(COPY.earlierNote);
    expect($('[data-sr-conclude]')).toBeNull();
    expect(buttonNamed(COPY.backToCurrent)).not.toBeNull();
  });

  it('(b) answerStale: "This answer relies on a fact that was corrected. The next step revises it."', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: A.getStale });
    expect($('[data-sr-answer-stale]').textContent).toBe(COPY.answerStale);
  });

  it('(b) no stale flag, no line', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: A.getStepped });
    expect($('[data-sr-answer-stale]')).toBeNull();
  });

  it('(c) summaryWithheld: the note on that step', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: A.getStepped, step: A.stepWithheld });
    expect($('[data-sr-withheld]')).toBeNull();
    click($('[data-sr-next]'));
    await flush();
    expect($('[data-sr-withheld]').textContent).toBe(COPY.withheld);
  });

  it('(d) the replaced reply renders as the partner\'s reply, plain', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: A.getStepped, step: A.stepReplaced });
    click($('[data-sr-next]'));
    await flush();
    const reply = $('[data-sr-reply]');
    expect(reply.textContent).toContain('Atlas');
    expect(reply.textContent).toContain('This step added 3 findings. The answer was not updated.');
    expect(reply.querySelector('[role="alert"], [data-sr-withheld]')).toBeNull();
  });

  it('(g) dates: a Source-backed fact shows its date and "published"; an undated one "Undated · read {date}", never as the fact\'s date', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: A.getStepped });
    click(buttonNamed(COPY.evidence, $('[data-sr-evidence]')) ?? $('[data-sr-evidence] button'));
    const findings = A.getStepped.body.record.findings;
    const undated = findings.find((f) => f.source.label.endsWith(' · undated'));
    const dated = findings.find((f) => f.status === 'verified' && f.asOf && !f.source.label.endsWith(' · undated') && f.at !== f.asOf) ?? findings.find((f) => f.status === 'verified' && f.asOf);
    const u = $(`[data-sr-finding="${undated.findingId}"]`);
    expect(u.querySelector('[data-sr-date]').dataset.srDate).toBe('undated');
    expect(u.querySelector('[data-sr-date]').textContent).toBe(COPY.undated('Nov 12, 2026'));
    expect(u.textContent).not.toContain(' · undated');
    const d = $(`[data-sr-finding="${dated.findingId}"]`);
    expect(d.querySelector('[data-sr-date]').dataset.srDate).toBe('dated');
    expect(d.querySelector('[data-sr-date]').textContent).toMatch(/^Nov \d+, 2026/);
  });

  it('(h) drop labels: player_drop → "Your drop"; from_drop → "From your drop"', async () => {
    await open({ mode: 'session', sessionId: IDS.dropSid }, { get: { status: 200, body: { ...A.openDrop.body, adoptPreview: null, storedRows: [] } } });
    const f = A.openDrop.body.record.findings;
    expect($(`[data-sr-finding="${f.find((x) => x.statusReason === 'player_drop').findingId}"]`).textContent).toContain('Your drop');
    expect($(`[data-sr-finding="${f.find((x) => x.statusReason === 'from_drop').findingId}"]`).textContent).toContain('From your drop');
  });

  it('(i) attribution_unavailable on open: the server\'s line', async () => {
    await open({ mode: 'item', item: storyOf() }, { open: A.attribution_unavailable });
    click($('[data-sr-investigate]'));
    await flush();
    expect($('[data-sr-refusal="attribution_unavailable"]').textContent).toBe(A.attribution_unavailable.body.message);
  });

  it('(i) step_limit and findings_full as refusals: the server\'s lines', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: A.getStepped, step: [A.step_limit, A.findings_full] });
    click($('[data-sr-next]'));
    await flush();
    expect($('[data-sr-step-failed="step_limit"]').textContent).toBe(A.step_limit.body.message);
    expect($('[data-sr-retry-step]')).toBeNull();
  });

  it('the agent\'s name: the prop; "your agent" when absent', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid, agentName: null }, { get: A.getStepped });
    expect($('[data-sr-reply]').textContent).toContain(COPY.agentFallback);
    expect($('[data-sr-reply]').textContent).not.toContain('Shadow');
  });
});
