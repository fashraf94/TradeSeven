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
//                   home; "No moments matched this day's situations." when the
//                   tagger ran and matched none; the coverage reason, quoted as
//                   stored, when stalled is unavailable for the day (RE-1,
//                   acceptance I); an absence sentence when the day's tape has
//                   no situations section at all (R14; review L3-1). It shows
//                   no price, score, result or later fact (RG-6).
//   check detail    a tagged check shows the situation, its count against its
//                   effective threshold (R on the recorded basis, D on the
//                   recomputed — the path decides, RG-3), both as whole counts,
//                   and Take this home — on a day whose situations are ready,
//                   as the prepared case lists them (review L1-3).
//   your-call       (footer) the card form: the moment's facts, the question
//                   menu, the note with its limit, the three routes in RG-5's
//                   words, the open-card count "n of 5" from the counter alone
//                   (words, no number, until it has answered — review L3-6a).
//                   One op id per form (review L4-9): a re-tap after a lost
//                   answer replays the same operation, never files a second.
//   receipt         (footer) the filed card: the note as an R7 quotation bound
//                   to the ledger path by the card's own id ("— you · time"),
//                   the route and stage, what happens next — RG-5's sentence
//                   for an open card, "nothing" for a retired or shelved one
//                   (review L3-3) — and Retire.
//   since-last-time (header) each open Watch card with its recurrences since
//                   the card's date, each opening its battle day and moment
//                   here when it is this battle's, named "in another battle"
//                   otherwise (RG-4; the App has no route to another battle's
//                   Film Room — review L3-4); and My cards: active, shelved,
//                   retired, with shelving explained in plain words.
// Every number carries its marker (BA-42, R4(a): the screen's aggregates are
// declared in SCREEN_AGGREGATE_CLASSES); every instant is marked as one, with
// its date when it is not the shown day's (review L3-7); the note reaches the
// screen only through Quotation (R7); a stage or route word the copy does not
// know renders as the record's own value (Rec), never in the screen's voice
// (review L3-10). Nothing here says or implies that the agent learns from,
// reads or follows a card (RG-5).

import React, { useEffect, useId, useState } from 'react';
import { SITUATIONS } from '../../data/situationRegistry';
import { SITUATION_QUESTIONS } from '../../data/situationQuestions';
import { CARD_SLOTS } from '../../data/cardSlots';
import { etClock, etDateLabel, etWhen, fmtCount } from './filmRoomModel';
import { FILM_ROOM_COPY as COPY } from './filmRoomCopy';
import { C, eyebrow, foot, mono, plain, tint, AggNum, TapeNum, When, Rec, Coverage, Quotation, TextButton, PrimaryButton, Label } from './FilmRoomKit';
import { tagsStateOf, momentsOfTape, momentKey, momentAnchor, tagsAtCheck, countPathOf, ledgerOf, groupCards, watchCardsOf } from './filmRoomCards';

const T = COPY.cards;
const titleOf = (situationId) => SITUATIONS[situationId]?.title ?? situationId;
const questionsFor = (situationId) => SITUATION_QUESTIONS.filter((q) => q.situationId === situationId);
const noteLength = (s) => [...String(s ?? '').trim()].length;
const S10 = CARD_SLOTS.S10.noteMaxChars;
/** The same control-character rule the endpoint applies (Unicode Cc — review L1-5). */
const CONTROL_CHAR = /\p{Cc}/u;
/** A stage or route word: the copy's, or the record's own value where the copy has none (never the screen's voice for an unknown id). */
const wordOf = (table, id) => (Object.prototype.hasOwnProperty.call(table, id) ? table[id] : <Rec>{String(id)}</Rec>);
const OPEN_STAGES = ['card', 'nominated'];

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
  const state = tagsStateOf(tape);
  const moments = state === 'ready' ? momentsOfTape(tape) : [];
  return (
    <section data-cards-region="prepared-case" data-tags-state={state} style={regionStyle}>
      <span style={{ ...eyebrow, color: C.teal }}>{T.preparedCase}</span>
      {/* R14: a tape with no situations section is an absence, said as one — never a coverage the tape does not store */}
      {state === 'absent' ? <span style={foot}>{T.tagsAbsent}</span> : <Coverage doc={tape} at={['coverage', 'tags']} label={T.moments} />}
      {state === 'ready' && !moments.length ? <span style={foot}>{T.momentsNone}</span> : null}
      {moments.length ? <span style={foot}>{T.momentsNote}</span> : null}
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

/** The situation at this check: its count (R or D by its basis) against its effective threshold (D), both whole counts, and Take this home. */
export function CheckTags({ tape, index, onTakeHome }) {
  const tags = tagsAtCheck(tape, index);
  if (!tags.length) return null;
  return (
    <div data-check-tags={index} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ ...eyebrow, color: C.ink3 }}>{T.checkTag}</span>
      {tags.map(({ item, k, moment }) => {
        const count = countPathOf(tape, { k, index, symbol: item.symbol });
        return (
          <div key={`${item.situationId}:${item.symbol}:${k}`} data-check-tag={`${item.situationId}:${item.symbol}`} data-count-basis={count.basis} data-count-source={count.source} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={mono(11, C.ink2)}>{titleOf(item.situationId)} · <Rec>{item.symbol}</Rec> · {T.countAgainst}</span>
            <TapeNum doc={tape} path={count.path} fmt={fmtCount} size={11.5} />
            <span style={mono(11, C.ink2)}>{T.thresholdWord}</span>
            <TapeNum doc={tape} path={['tags', 'items', k, 'effectiveTicksThreshold']} fmt={fmtCount} size={11.5} />
            {moment ? <TextButton onClick={() => onTakeHome(moment)}>{T.takeHome}</TextButton> : null}
          </div>
        );
      })}
    </div>
  );
}

// ── your call (footer): the form ────────────────────────────────────────────

/**
 * @param {object}   props.counter   the hook's counter state `{ status, data }` — the open count and the cap come from
 *                                   the counter ALONE (one source under one name; review L3-8); until it has answered
 *                                   the line is words
 * @param {Function} props.mintOpId  a fresh op id, minted ONCE per form (review L4-9)
 */
export function YourCall({ tape, moment, counter, mintOpId, onFile, onCancel }) {
  const id = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const questions = questionsFor(moment.situationId);
  const [questionId, setQuestionId] = useState(questions[0]?.id ?? null);
  const [route, setRoute] = useState('watch');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState(null);
  // the op id is minted once the form is up for a moment (the same effect that resets the form for a new moment), never per attempt
  const [opId, setOpId] = useState(null);
  useEffect(() => { setQuestionId(questions[0]?.id ?? null); setRoute('watch'); setNote(''); setRefusal(null); setOpId(mintOpId()); }, [moment]);   // eslint-disable-line react-hooks/exhaustive-deps
  const length = noteLength(note);
  const data = counter?.status === 'ready' ? counter.data : null;
  const open = Number.isInteger(data?.open) ? data.open : null;
  const cap = Number.isInteger(data?.cap) ? data.cap : null;
  const countState = open !== null && cap !== null ? 'ready' : counter?.status === 'error' ? 'error' : 'loading';
  const canFile = !busy && Boolean(opId) && Boolean(questionId) && length > 0 && length <= S10 && !CONTROL_CHAR.test(note.trim());
  const submit = async (e) => {
    e.preventDefault();
    if (!canFile) return;
    setBusy(true);
    setRefusal(null);
    const q = questions.find((x) => x.id === questionId);
    const r = await onFile({ opId, battleId: tape.battleId, etDate: tape.etDate, moment, questionId, questionVersion: q?.version ?? null, note: note.trim(), route });
    setBusy(false);
    if (!r?.ok) setRefusal(T.refusals[r?.code] ?? T.refusals.default);
  };
  return (
    <form data-card-form={momentKey(moment)} data-card-op={opId ?? undefined} id="your-call" onSubmit={submit} style={regionStyle}>
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
      {/* the label holds the words and the field alone: the count line, with its markers, sits beside it (review L3-11e) */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ ...eyebrow, color: C.ink3 }}>{T.note}</span>
        <textarea data-note="" value={note} onChange={(e) => setNote(e.target.value)} rows={3} style={{ ...mono(12, C.ink), background: C.wash, border: `1px solid ${C.hair2}`, borderRadius: 8, padding: 8, resize: 'vertical' }} />
      </label>
      <span data-note-count="" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, ...foot }}>
        <AggNum value={length} aggregate="count(characters in the note)" size={10} /> {COPY.countOf} <AggNum value={S10} aggregate="slot(S10 note characters)" size={10} /> {T.noteLimit}
      </span>
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
        <span data-open-count="" data-open-count-state={countState} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, ...mono(10.5, C.ink2) }}>
          {countState === 'ready'
            ? <>{T.openCards} · <AggNum value={open} aggregate="count(plays[] open)" size={10.5} /> {COPY.countOf} <AggNum value={cap} aggregate="slot(S9 open cards per agent)" size={10.5} /></>
            : (countState === 'error' ? T.openCountUnknown : T.openCountLoading)}
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

/** RG-5 — what happens next, as true for the card's state: the route's sentence while it is open; nothing, said so, once retired or while shelved. */
function nextOf(card) {
  if (card.stage === 'retired') return T.stateNotes.retired;
  if (card.shelved) return T.stateNotes.shelved;
  return OPEN_STAGES.includes(card.stage) && Object.prototype.hasOwnProperty.call(T.routeNotes, card.route) ? T.routeNotes[card.route] : null;
}

/**
 * @param {string|null} props.day      the day the screen shows — the instant's date is shown when it is not this day's
 *                                     (review L3-7)
 * @param {object}      props.counter  the hook's counter state `{ status, data }`
 * @param {Function}    props.mintOpId a fresh op id, minted ONCE per receipt (review L4-9)
 */
export function Receipt({ day = null, counter, card, mintOpId, onRetire }) {
  const data = counter?.status === 'ready' || counter?.data ? counter.data : null;
  const cards = ledgerOf(data, card);
  const live = cards.find((c) => c.entryId === card.entryId) ?? card;
  // the ledger document as the quotation reads it: each card under its OWN id (review L3-9a), the shown day's date
  const ledger = { etDate: day, cards: Object.fromEntries(cards.map((c) => [c.entryId, c])) };
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState(null);
  const [opId] = useState(() => mintOpId());
  const retire = async () => {
    setBusy(true);
    setRefusal(null);
    const r = await onRetire(live, opId);
    setBusy(false);
    if (!r?.ok) setRefusal(T.refusals[r?.code] ?? T.refusals.retireDefault);
  };
  const next = nextOf(live);
  const canRetire = OPEN_STAGES.includes(live.stage) && !live.shelved;
  return (
    <section data-card-receipt={live.entryId} data-card-op={opId} id="receipt" style={regionStyle}>
      <span style={{ ...eyebrow, color: C.teal }}>{T.receipt} · {T.filedCard}</span>
      <CardFacts card={live} />
      <Quotation doc={ledger} path={['cards', live.entryId, 'note']} by="you" at={['cards', live.entryId, 'createdAt']} docLabel="ledger" />
      <span style={mono(11, C.ink2)}>{T.route} · {wordOf(T.routes, live.route)} · {T.stage} · {wordOf(T.stageWords, live.stage)}{live.shelved ? ` · ${T.groups.shelved}` : ''}</span>
      {next ? <span data-card-next="" style={foot}>{next}</span> : null}
      {canRetire ? <div style={{ display: 'flex' }}><PrimaryButton onClick={retire} disabled={busy}>{busy ? T.retiring : T.retire}</PrimaryButton></div> : null}
      {refusal ? <span data-card-refusal="" role="alert" style={{ ...foot, color: C.copper }}>{refusal}</span> : null}
    </section>
  );
}

// ── since last time (header) ────────────────────────────────────────────────

const recurrenceKey = (r) => `${r.battleId}:${r.etDate}:${momentKey(r)}`;
const recurrenceRow = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '4px 0' };

/** A recurrence's facts: its day, the symbol, the from–to, its checks (derived). */
function RecurrenceFacts({ r }) {
  return (
    <>
      <When style={mono(10.5, C.ink2)}>{etDateLabel(r.etDate, { short: true }) ?? ''}</When>
      <span style={mono(11.5, C.ink, { fontWeight: 700 })}><Rec>{r.symbol}</Rec></span>
      <span style={mono(10.5, C.ink2)}><When>{etClock(r.from) ?? ''}</When>–<When>{etClock(r.to) ?? ''}</When></span>
      <AggNum value={r.checks} aggregate="count(tags.items[] in a moment)" size={10.5} suffix={` ${COPY.checksIn}`} />
    </>
  );
}

/** RG-4: this battle's recurrence opens its day and moment here; another battle's is named, since this screen opens no other battle. */
function Recurrence({ r, own, onOpenMoment }) {
  if (!own) {
    return (
      <span data-recurrence-row={recurrenceKey(r)} data-recurrence-elsewhere="" style={{ ...recurrenceRow, color: C.ink2 }}>
        <RecurrenceFacts r={r} />
        <span style={foot}>{T.otherBattle}</span>
      </span>
    );
  }
  return (
    <button type="button" data-recurrence-row={recurrenceKey(r)} onClick={() => onOpenMoment(r)} style={{ ...plain, ...recurrenceRow, color: C.teal, textAlign: 'left' }}>
      <RecurrenceFacts r={r} />
    </button>
  );
}

function CardRow({ card, onShow }) {
  return (
    <button type="button" data-my-card={card.entryId} onClick={() => onShow(card)} style={{ ...plain, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '5px 0', width: '100%', borderTop: `1px solid ${C.hair}` }}>
      <span style={mono(11, C.ink2)}>{titleOf(card.situationId)}</span>
      <span style={mono(11.5, C.ink, { fontWeight: 700 })}><Rec>{card.source?.symbol ?? ''}</Rec></span>
      <When style={mono(10.5, C.ink2)}>{etDateLabel(card.source?.etDate, { short: true }) ?? ''}</When>
      <span style={mono(10.5, C.ink2)}>{wordOf(T.routes, card.route)} · {wordOf(T.stageWords, card.stage)}</span>
      <Label style={{ color: C.teal }}>{T.openCard}</Label>
    </button>
  );
}

/**
 * @param {string|null} props.day       the day the screen shows (review L3-7)
 * @param {string|null} props.battleId  this battle — its recurrences open here, another battle's are named (RG-4)
 * @param {object}      props.counter   the hook's counter state `{ status, data }`; data read earlier is kept through
 *                                      a failed re-read (review L4-4), with the error said beside it
 */
export function SinceLastTime({ day = null, battleId = null, agentId = null, counter, onOpenMoment, onShowCard }) {
  const data = counter?.data ?? null;
  const cards = ledgerOf(data);
  const watching = watchCardsOf(data, cards);
  const groups = groupCards(cards);
  const loading = !data && (counter?.status === 'loading' || counter?.status === 'idle');
  // B2.1 B3 (Amendment H RH-6; RJ-7's style): the days in the counter's window whose situations could not be read —
  // neither counted nor listed as recurrences — said as one line with their count (derived)
  const unread = Number.isInteger(data?.unavailableDays?.[agentId]) ? data.unavailableDays[agentId] : 0;
  return (
    <section data-cards-region="since-last-time" style={regionStyle}>
      <span style={{ ...eyebrow, color: C.teal }}>{T.sinceLastTime}</span>
      {loading ? <span style={foot}>{T.loading}</span> : null}
      {counter?.status === 'error' ? <span data-cards-read-error="" style={foot}>{T.readError}</span> : null}
      {unread > 0 ? <span data-unavailable-days="" style={{ ...foot, display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>{T.recurrencesWord} · <AggNum value={unread} aggregate="count(tape days with situations unavailable)" size={10} /> {T.unavailableDays(unread)}</span> : null}
      {data && !watching.length ? <span style={foot}>{T.noWatchCards}</span> : null}
      {watching.map(({ card: c, recurrences }) => (
        <div key={c.entryId} data-watch-card={c.entryId} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 0', borderTop: `1px solid ${C.hair}` }}>
          <span style={mono(11, C.ink2)}>{titleOf(c.situationId)} · <Rec>{c.source?.symbol ?? ''}</Rec> · <When>{etWhen(c.createdAt, day) ?? ''}</When></span>
          <span style={{ ...eyebrow, color: C.ink3 }}>{T.recurrences}</span>
          {recurrences.length ? recurrences.map((r) => <Recurrence key={recurrenceKey(r)} r={r} own={battleId !== null && r.battleId === battleId} onOpenMoment={onOpenMoment} />) : <span style={foot}>{T.noRecurrence}</span>}
        </div>
      ))}
      {data ? (
        <div data-my-cards="" style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
          <span style={{ ...eyebrow, color: C.ink2 }}>{T.myCards}</span>
          {!cards.length ? <span style={foot}>{T.noCards}</span> : null}
          {['active', 'shelved', 'retired', 'other'].map((g) => (groups[g].length ? (
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
