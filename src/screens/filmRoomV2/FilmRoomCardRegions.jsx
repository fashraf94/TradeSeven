// src/screens/filmRoomV2/FilmRoomCardRegions.jsx
//
// Film Room B2 — THE CARD ON THE SCREEN (Build B spec §6; Amendment G RG-2 …
// RG-9): the four reserved regions' content, rendered ONLY under
// FILM_ROOM_CARDS_MODE for an admitted owner (FilmRoomScreenV2 mounts these in
// place of its empty Reserved regions), and the tag line a tapped check shows.
//
// (Named apart from filmRoomCards.js, its state module: a name differing by case alone would not resolve on a
// case-insensitive file system.)
//   prepared-case   (header) the day's moments, longest first: the symbol, the
//                   from–to, the number of checks (derived, RG-3) and Take this
//                   home; "No moments matched this day's situations." when
//                   none; the coverage reason, quoted as stored, when stalled
//                   is unavailable for the day (RE-1, acceptance I). It shows
//                   no price, score, result or later fact (RG-6).
//   check detail    a tagged check shows the situation, its count against its
//                   effective threshold (R on the recorded basis, D on the
//                   recomputed — the path decides, RG-3) and Take this home.
//   your-call       (footer) the card form: the moment's facts, the question
//                   menu, the note with its limit, the three routes in RG-5's
//                   words, the open-card count "n of 5".
//   receipt         (footer) the filed card: the note as an R7 quotation bound
//                   to the ledger path ("— you · time"), the route and stage
//                   with RG-5's next-use sentence, and Retire.
//   since-last-time (header) each open Watch card with its recurrences since
//                   the card's date, each linking to its battle day and moment
//                   (RG-4); and My cards: active, shelved, retired, with
//                   shelving explained in plain words.
// Every number carries its marker (BA-42, R4(a): the screen's aggregates are
// declared in SCREEN_AGGREGATE_CLASSES); every instant is marked as one; the
// note reaches the screen only through Quotation (R7). Nothing here says or
// implies that the agent learns from, reads or follows a card (RG-5).

import React, { useEffect, useId, useState } from 'react';
import { SITUATIONS } from '../../data/situationRegistry';
import { SITUATION_QUESTIONS } from '../../data/situationQuestions';
import { CARD_SLOTS } from '../../data/cardSlots';
import { etClock, etDateLabel, etWhen } from './filmRoomModel';
import { FILM_ROOM_COPY as COPY } from './filmRoomCopy';
import { C, card, eyebrow, foot, mono, plain, tint, AggNum, TapeNum, When, Rec, Coverage, Quotation, TextButton, PrimaryButton, Label } from './FilmRoomKit';
import { momentsOfTape, momentKey, momentAnchor, tagsAtCheck, countPathOf, ledgerOf, groupCards, watchCardsOf } from './filmRoomCards';

const T = COPY.cards;
const titleOf = (situationId) => SITUATIONS[situationId]?.title ?? situationId;
const questionsFor = (situationId) => SITUATION_QUESTIONS.filter((q) => q.situationId === situationId);
const noteLength = (s) => [...String(s ?? '').trim()].length;
const S9 = CARD_SLOTS.S9.openCardsPerAgent;
const S10 = CARD_SLOTS.S10.noteMaxChars;

/** A moment's facts: the symbol, its from–to as instants, its number of checks (derived). */
function MomentFacts({ moment, size = 11.5 }) {
  return (
    <span data-moment-facts="" data-moment={momentKey(moment)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
      <span style={mono(size, C.ink, { fontWeight: 700 })}><Rec>{moment.symbol}</Rec></span>
      <span style={mono(size - 1, C.ink2)}><When>{etClock(moment.from) ?? ''}</When>–<When>{etClock(moment.to) ?? ''}</When></span>
      <AggNum value={moment.checks} aggregate="count(tags.items[] in a moment)" size={size - 1} suffix={` ${COPY.checksIn}`} />
    </span>
  );
}

const regionStyle = { display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', borderRadius: 12, background: C.surface, border: `1px solid ${C.hair2}` };

// ── prepared case (header) ──────────────────────────────────────────────────

export function PreparedCase({ tape, onTakeHome }) {
  const unavailable = tape?.coverage?.tags?.status === 'unavailable';
  const moments = unavailable ? [] : momentsOfTape(tape);
  return (
    <section data-cards-region="prepared-case" aria-label={T.preparedCase} style={regionStyle}>
      <span style={{ ...eyebrow, color: C.teal }}>{T.preparedCase}</span>
      <Coverage doc={tape} at={['coverage', 'tags']} label={T.moments} />
      {!unavailable && !moments.length ? <span style={foot}>{T.momentsNone}</span> : null}
      {!unavailable && moments.length ? <span style={foot}>{T.momentsNote}</span> : null}
      {moments.map((m) => (
        <div key={momentKey(m)} id={momentAnchor(m)} data-moment-row={momentKey(m)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderTop: `1px solid ${C.hair}` }}>
          <MomentFacts moment={m} />
          <TextButton onClick={() => onTakeHome(m)}>{T.takeHome}</TextButton>
        </div>
      ))}
    </section>
  );
}

// ── the tag line of a tapped check ──────────────────────────────────────────

/** The situation at this check: its count (R or D by its basis) against its effective threshold (D), and Take this home. */
export function CheckTags({ tape, index, onTakeHome }) {
  const tags = tagsAtCheck(tape, index);
  if (!tags.length) return null;
  return (
    <div data-check-tags={index} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ ...eyebrow, color: C.ink3 }}>{T.checkTag}</span>
      {tags.map(({ item, k, moment }) => {
        const count = countPathOf(tape, { k, index, symbol: item.symbol });
        return (
          <div key={`${item.situationId}:${item.symbol}:${k}`} data-check-tag={`${item.situationId}:${item.symbol}`} data-count-basis={count.basis} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={mono(11, C.ink2)}>{titleOf(item.situationId)} · <Rec>{item.symbol}</Rec> · {T.countAgainst}</span>
            <TapeNum doc={tape} path={count.path} size={11.5} />
            <span style={mono(11, C.ink2)}>{T.thresholdWord}</span>
            <TapeNum doc={tape} path={['tags', 'items', k, 'effectiveTicksThreshold']} size={11.5} />
            {moment ? <TextButton onClick={() => onTakeHome(moment)}>{T.takeHome}</TextButton> : null}
          </div>
        );
      })}
    </div>
  );
}

// ── your call (footer): the form ────────────────────────────────────────────

export function YourCall({ tape, moment, counter, onFile, onCancel }) {
  const id = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const questions = questionsFor(moment.situationId);
  const [questionId, setQuestionId] = useState(questions[0]?.id ?? null);
  const [route, setRoute] = useState('watch');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState(null);
  useEffect(() => { setQuestionId(questions[0]?.id ?? null); setRoute('watch'); setNote(''); setRefusal(null); }, [moment]);   // eslint-disable-line react-hooks/exhaustive-deps
  const length = noteLength(note);
  const open = Number.isInteger(counter?.open) ? counter.open : null;
  const cap = Number.isInteger(counter?.cap) ? counter.cap : S9;
  const canFile = !busy && questionId && length > 0 && length <= S10 && !/[\u0000-\u001F\u007F]/.test(note.trim());
  const submit = async (e) => {
    e.preventDefault();
    if (!canFile) return;
    setBusy(true);
    setRefusal(null);
    const q = questions.find((x) => x.id === questionId);
    const r = await onFile({ battleId: tape.battleId, etDate: tape.etDate, moment, questionId, questionVersion: q?.version ?? null, note: note.trim(), route });
    setBusy(false);
    if (!r?.ok) setRefusal(T.refusals[r?.code] ?? T.refusals.default);
  };
  return (
    <form data-card-form={momentKey(moment)} id="your-call" aria-label={T.yourCall} onSubmit={submit} style={regionStyle}>
      <span style={{ ...eyebrow, color: C.teal }}>{T.yourCall}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={mono(10.5, C.ink2)}>{titleOf(moment.situationId)}</span>
        <MomentFacts moment={moment} />
      </div>
      <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <legend style={{ ...eyebrow, color: C.ink3, padding: 0, marginBottom: 4 }}>{T.question}</legend>
        {questions.map((q) => (
          <label key={q.id} data-question={q.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, ...mono(11.5, C.ink) }}>
            <input type="radio" name={`${id}-question`} value={q.id} checked={questionId === q.id} onChange={() => setQuestionId(q.id)} />
            <span>{q.text}</span>
          </label>
        ))}
      </fieldset>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ ...eyebrow, color: C.ink3 }}>{T.note}</span>
        <textarea data-note="" value={note} onChange={(e) => setNote(e.target.value)} rows={3} style={{ ...mono(12, C.ink), background: C.wash, border: `1px solid ${C.hair2}`, borderRadius: 8, padding: 8, resize: 'vertical' }} />
        <span data-note-count="" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, ...foot }}>
          <AggNum value={length} aggregate="count(characters in the note)" size={10} /> {COPY.countOf} <AggNum value={S10} aggregate="slot(S10 note characters)" size={10} /> {T.noteLimit}
        </span>
      </label>
      <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <legend style={{ ...eyebrow, color: C.ink3, padding: 0, marginBottom: 4 }}>{T.routeTitle}</legend>
        {['watch', 'drill', 'set'].map((r) => (
          <label key={r} data-route={r} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <input type="radio" name={`${id}-route`} value={r} checked={route === r} onChange={() => setRoute(r)} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={mono(11.5, C.ink, { fontWeight: 700 })}>{T.routes[r]}</span>
              <span style={foot}>{T.routeNotes[r]}</span>
              {r === 'set' ? <span style={foot}>{T.setRoute}</span> : null}
            </span>
          </label>
        ))}
      </fieldset>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span data-open-count="" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, ...mono(10.5, C.ink2) }}>
          {T.openCards} · {open === null ? COPY.notRecorded : <AggNum value={open} aggregate="count(plays[] open)" size={10.5} />} {COPY.countOf} <AggNum value={cap} aggregate="slot(S9 open cards per agent)" size={10.5} />
        </span>
        <span style={{ display: 'inline-flex', gap: 8 }}>
          <TextButton onClick={onCancel} color={C.ink3}>{T.cancel}</TextButton>
          <button type="submit" disabled={!canFile} style={{ ...plain, minHeight: 34, padding: '0 14px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: tint('teal', 0.12), border: `1px solid ${tint('teal', 0.4)}`, color: C.ink, opacity: canFile ? 1 : 0.5 }}><Label size={12.5}>{busy ? T.filing : T.file}</Label></button>
        </span>
      </div>
      {refusal ? <span data-card-refusal="" role="alert" style={{ ...foot, color: C.copper }}>{refusal}</span> : null}
    </form>
  );
}

// ── receipt (footer): the filed card ────────────────────────────────────────

/** One card's facts: the situation, the symbol and day, the from–to, the question. */
function CardFacts({ card }) {
  const q = SITUATION_QUESTIONS.find((x) => x.id === card.questionId);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={mono(11, C.ink2)}>{T.situation} · {titleOf(card.situationId)}</span>
      <span style={mono(11.5, C.ink, { fontWeight: 700 })}><Rec>{card.source?.symbol ?? ''}</Rec> <span style={mono(10.5, C.ink2, { fontWeight: 400 })}>{T.on} <When>{etDateLabel(card.source?.etDate, { short: true }) ?? ''}</When></span></span>
      {q ? <span style={mono(11, C.ink2)}>{q.text}</span> : null}
    </div>
  );
}

export function Receipt({ tape, counter, card, onRetire }) {
  const cards = ledgerOf(counter, card);
  const i = cards.findIndex((c) => c.entryId === card.entryId);
  const ledger = { etDate: tape?.etDate ?? null, cards };
  const live = cards[i] ?? card;
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState(null);
  const retire = async () => {
    setBusy(true);
    setRefusal(null);
    const r = await onRetire(live);
    setBusy(false);
    if (!r?.ok) setRefusal(T.refusals[r?.code] ?? T.refusals.retireDefault);
  };
  return (
    <section data-card-receipt={live.entryId} id="receipt" aria-label={T.receipt} style={regionStyle}>
      <span style={{ ...eyebrow, color: C.teal }}>{T.receipt} · {T.filedCard}</span>
      <CardFacts card={live} />
      <Quotation doc={ledger} path={['cards', i, 'note']} by="you" at={['cards', i, 'createdAt']} docLabel="ledger" />
      <span style={mono(11, C.ink2)}>{T.route} · {T.routes[live.route] ?? live.route} · {T.stage} · {T.stageWords[live.stage] ?? live.stage}{live.shelved ? ` · ${T.groups.shelved}` : ''}</span>
      <span style={foot}>{T.routeNotes[live.route] ?? ''}</span>
      {live.stage !== 'retired' && !live.shelved ? <div style={{ display: 'flex' }}><PrimaryButton onClick={busy ? () => {} : retire}>{busy ? T.retiring : T.retire}</PrimaryButton></div> : null}
      {refusal ? <span data-card-refusal="" role="alert" style={{ ...foot, color: C.copper }}>{refusal}</span> : null}
    </section>
  );
}

// ── since last time (header) ────────────────────────────────────────────────

/** The link a recurrence carries: its battle day and moment (RG-4). The screen opens its own battle's day; another battle's is a plain link. */
export const recurrenceHref = (r) => `#film-room/${encodeURIComponent(r.battleId)}/${r.etDate}/${momentAnchor(r)}`;

function Recurrence({ r, onOpenMoment }) {
  return (
    <a data-recurrence-row={`${r.battleId}:${r.etDate}:${momentKey(r)}`} href={recurrenceHref(r)} onClick={(e) => { if (onOpenMoment && onOpenMoment(r) === true) e.preventDefault(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '4px 0', color: C.teal, textDecoration: 'none' }}>
      <When style={mono(10.5, C.ink2)}>{etDateLabel(r.etDate, { short: true }) ?? ''}</When>
      <span style={mono(11.5, C.ink, { fontWeight: 700 })}><Rec>{r.symbol}</Rec></span>
      <span style={mono(10.5, C.ink2)}><When>{etClock(r.from) ?? ''}</When>–<When>{etClock(r.to) ?? ''}</When></span>
      <AggNum value={r.checks} aggregate="count(tags.items[] in a moment)" size={10.5} suffix={` ${COPY.checksIn}`} />
    </a>
  );
}

function CardRow({ card, onShow }) {
  return (
    <button type="button" data-my-card={card.entryId} onClick={() => onShow(card)} style={{ ...plain, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '5px 0', width: '100%', borderTop: `1px solid ${C.hair}` }}>
      <span style={mono(11, C.ink2)}>{titleOf(card.situationId)}</span>
      <span style={mono(11.5, C.ink, { fontWeight: 700 })}><Rec>{card.source?.symbol ?? ''}</Rec></span>
      <When style={mono(10.5, C.ink2)}>{etDateLabel(card.source?.etDate, { short: true }) ?? ''}</When>
      <span style={mono(10.5, C.ink2)}>{T.routes[card.route] ?? card.route} · {T.stageWords[card.stage] ?? card.stage}</span>
      <Label style={{ color: C.teal }}>{T.openCard}</Label>
    </button>
  );
}

export function SinceLastTime({ tape, counter, onOpenMoment, onShowCard }) {
  const data = counter?.data ?? null;
  const cards = ledgerOf(data);
  const watching = watchCardsOf(data, cards);
  const groups = groupCards(cards);
  return (
    <section data-cards-region="since-last-time" aria-label={T.sinceLastTime} style={regionStyle}>
      <span style={{ ...eyebrow, color: C.teal }}>{T.sinceLastTime}</span>
      {counter?.status === 'loading' || counter?.status === 'idle' ? <span style={foot}>{T.loading}</span> : null}
      {counter?.status === 'error' ? <span style={foot}>{T.readError}</span> : null}
      {counter?.status === 'ready' && !watching.length ? <span style={foot}>{T.noWatchCards}</span> : null}
      {watching.map(({ card: c, recurrences }) => (
        <div key={c.entryId} data-watch-card={c.entryId} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 0', borderTop: `1px solid ${C.hair}` }}>
          <span style={mono(11, C.ink2)}>{titleOf(c.situationId)} · <Rec>{c.source?.symbol ?? ''}</Rec> · <When>{etWhen(c.createdAt, tape?.etDate) ?? ''}</When></span>
          <span style={{ ...eyebrow, color: C.ink3 }}>{T.recurrences}</span>
          {recurrences.length ? recurrences.map((r) => <Recurrence key={`${r.battleId}:${r.etDate}:${momentKey(r)}`} r={r} onOpenMoment={onOpenMoment} />) : <span style={foot}>{T.noRecurrence}</span>}
        </div>
      ))}
      {counter?.status === 'ready' ? (
        <div data-my-cards="" style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
          <span style={{ ...eyebrow, color: C.ink2 }}>{T.myCards}</span>
          {!cards.length ? <span style={foot}>{T.noCards}</span> : null}
          {['active', 'shelved', 'retired'].map((g) => (groups[g].length ? (
            <div key={g} data-my-cards-group={g} style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={mono(10, C.ink3, { letterSpacing: '0.12em', textTransform: 'uppercase' })}>{T.groups[g]}</span>
              {groups[g].map((c) => <CardRow key={c.entryId} card={c} onShow={onShowCard} />)}
            </div>
          ) : null))}
          <span style={foot}>{T.shelvedExplainer}</span>
        </div>
      ) : null}
    </section>
  );
}

/** The regions' box as the header and footer mount them. */
export const cardsRegionStyle = { ...card, padding: 0, background: 'transparent', border: 'none', gap: 10 };
