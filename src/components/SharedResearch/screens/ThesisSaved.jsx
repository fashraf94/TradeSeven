// src/components/SharedResearch/screens/ThesisSaved.jsx
//
// Shared Research — THE THESIS, SAVED: today's state only (B4 build prompt K-14;
// Amendment B DR-7; R3b T6 "Saved, today"). "Thesis saved" with the time the server
// recorded (`session.adoption.at`, never the device's clock), the sentence saved
// (`session.adoption.statement` from B6a X-7, so a reopened sheet shows it too),
// the names and the time frame, REVIEW_HONEST_LINE with the agent's name, and the
// plain line that the idea book does not read saved theses yet. Done, and "Use it
// in my next game" (optional; B2's two existing calls, only with an agentId), with
// the line above it that says what equipping does (B6c X-10, Q-4): from the
// server's `equippedList` first — this thesis already equipped ("Equipped for
// your next game", no offer), another list ("Replaces {list} as your equipped
// list."), none ("This becomes your equipped list for your next game.") — and
// from the caller's `equippedListLabel` only when the answer carries no such key.
// The idea-book ending (T6b) and the watching screen (P1) are not built (§B8).
//
// The count of findings the save carried is not shown: no answer carries it (the
// adopt answer is { watchlistId, version, researchWorkId, idempotent, thesis }), and
// counting it here would mirror the server's carriedIdsOf (K-1: the server wins).

import React from 'react';
import { SR_COPY as COPY } from '../sharedResearchCopy';
import { T, S, wash } from '../sharedResearchStyle';
import { formatWhen, holdsResearchOnlyIn } from '../sharedResearchView';
import { FreeButton, WRAP } from '../builderParts';
import { Notice, Running } from '../parts';

const B = COPY.builder;

export default function ThesisSaved({ sr, agentName, agentId, equippedListLabel = null, onClose }) {
  const { session, thesis } = sr.inv;
  const mine = sr.save.sessionId === session.sessionId && ['saved', 'recovered'].includes(sr.save.status);
  const outcome = mine ? sr.save.outcome ?? {} : { watchlistId: session.adoption?.watchlistId ?? null, idempotent: true };
  const watchlistId = outcome.watchlistId ?? session.adoption?.watchlistId ?? null;
  const when = formatWhen(session.adoption?.at);
  const alreadySaved = mine && sr.save.status === 'saved' && outcome.idempotent === true;
  // the statement saved. B6a X-7: a save records it on the session's adoption (`session.adoption.statement`, what the
  // server saved), so a reopened sheet shows it — and it wins here too, being the server's. A session saved before B6a
  // carries none: then, as before, the player's edit when this page sent one, else the composed sentence this page saved,
  // and nothing on a reopened sheet (review 4A-3).
  const recorded = typeof session.adoption?.statement === 'string' && session.adoption.statement ? session.adoption.statement : null;
  const statement = recorded ?? (!mine ? null : typeof sr.save.input?.statement === 'string' ? sr.save.input.statement : thesis?.sentence ?? null);
  const names = thesis?.parts?.names?.value ?? [];
  const eq = sr.equip;
  const canEquip = typeof agentId === 'string' && agentId.length > 0 && typeof watchlistId === 'string' && watchlistId.length > 0;
  // the read after the save is in flight (K-16): equip waits for it (refuter 2)
  const busy = sr.pending !== null;
  // B6c X-10 and the founder's Q-4: equipping replaces the agent's equipped list, so the offer says so. The server's
  // `equippedList` (GET on a saved thesis) comes first:
  //   - it is this thesis's own list → already equipped: "Equipped for your next game", no offer;
  //   - another list → "Replaces {name} as your equipped list." ("Replaces your equipped list." with no name);
  //   - null (none equipped) → "This becomes your equipped list for your next game."
  // Only when the answer has no `equippedList` key does the caller's equippedListLabel decide: the list by name, else
  // the plain line (true whether one is equipped or not; never "you have none").
  const fromServer = Object.prototype.hasOwnProperty.call(sr.inv, 'equippedList');
  const serverList = fromServer ? sr.inv.equippedList ?? null : null;
  const alreadyEquipped = fromServer && serverList !== null && serverList.id === watchlistId;
  const named = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const label = named(equippedListLabel);
  let offerLine;
  if (fromServer) offerLine = serverList === null ? COPY.becomesList : named(serverList.name) ? COPY.replaces(named(serverList.name)) : COPY.replacesUnnamed;
  else offerLine = label ? COPY.replaces(label) : COPY.becomesList;
  return (
    <section data-screen-label={`Thesis saved · equip ${canEquip ? eq.status : 'not offered'}`} style={{ ...S.col, gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: '50%', background: wash('pos', 0.16), border: `1.5px solid ${T.pos}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.pos, fontWeight: 700, flexShrink: 0 }}>✓</span>
        <h3 style={{ ...S.h3, fontSize: 20 }} data-sr-thesis-saved="">{B.saved}</h3>
        {when && <span style={{ ...S.small, ...WRAP, marginLeft: 'auto' }} data-sr-saved-at="">{when}</span>}
      </div>
      {mine && sr.save.status === 'recovered' && <Notice role="status" tone="teal" attrs={{ 'data-sr-recovered': '' }}>{COPY.recovered}</Notice>}
      {alreadySaved
        ? <p style={{ ...S.body, ...WRAP }} data-sr-saved-already="">{COPY.savedAlready}</p>
        : (statement && <p style={{ ...S.body, ...WRAP, fontSize: 16.5, lineHeight: 1.6, fontWeight: 500 }} data-sr-saved-statement="">{statement}</p>)}
      <p style={{ ...S.meta, ...WRAP }} data-sr-saved-line="">
        <span style={{ fontWeight: 700, color: T.ink }}>{names.join(', ')}</span>
        {thesis?.parts?.timeFrame?.label ? ` · ${thesis.parts.timeFrame.label}` : ''}
      </p>
      {holdsResearchOnlyIn(names, sr.inv.companies?.supported) && <p style={{ ...S.small, ...WRAP }} data-sr-research-only="">{COPY.research.holdsResearchOnly}</p>}
      <div style={{ paddingTop: 16, borderTop: `1px solid ${T.hair}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ ...S.body, ...WRAP, color: T.ink2 }} data-sr-honest="">{B.honestLine(agentName)}</p>
        <p style={{ ...S.body, ...WRAP, color: T.ink2 }} data-sr-idea-book="">{B.ideaBook(agentName)}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <FreeButton label={B.done} trail="" strong onClick={onClose} attrs={{ 'data-sr-done': '' }} />
        {canEquip && eq.status === 'none' && alreadyEquipped && <p style={{ ...S.body, ...WRAP }} data-sr-equipped="" data-sr-equipped-already="">{COPY.equipped}</p>}
        {canEquip && eq.status === 'none' && !alreadyEquipped && <p style={{ ...S.meta, ...WRAP }} data-sr-equip-line="">{offerLine}</p>}
        {canEquip && eq.status === 'none' && !alreadyEquipped && <FreeButton label={COPY.useNext} trail={B.optional} disabled={busy} onClick={() => sr.equipNow({ agentId, watchlistId })} attrs={{ 'data-sr-equip': '' }} />}
        {canEquip && eq.status === 'running' && <Running>{COPY.equipping}</Running>}
        {canEquip && eq.status === 'done' && <p style={{ ...S.body, ...WRAP }} data-sr-equipped="">{COPY.equipped}</p>}
        {canEquip && eq.status === 'failed' && (
          <>
            <Notice role="alert" attrs={{ 'data-sr-equip-failed': eq.code ?? '' }}>{eq.code === 'research_only_list' ? COPY.research.equipRefused : COPY.equipFailed}</Notice>
            <FreeButton label={COPY.retry} trail={B.optional} disabled={busy} onClick={() => sr.equipNow({ agentId, watchlistId })} />
          </>
        )}
      </div>
    </section>
  );
}
