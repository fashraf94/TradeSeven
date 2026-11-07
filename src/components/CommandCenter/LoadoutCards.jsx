// src/components/CommandCenter/LoadoutCards.jsx
//
// Build A2 — the per-game loadout surfaces of the hub (docs/design/loadout-v1/, boards 1 and 2, with the founder's
// adjustments of Nov 4 recorded in the A1 report §14), behind PER_GAME_LOADOUT_ENABLED and AGENT_FORM_ARMORY_ENABLED:
//   - LoadoutCards: the Loadout tab's two cards, BaggerBomb first and League second (board 7 #1), side by side where
//     the panel is wide enough, stacked otherwise. Each card: the set as a 48 px still, the book (its name and its count
//     of names), one state tag, a door on each half (the whole 60 px row, a chevron; board 7 #4), the running strip in
//     the armor the game deployed with, and the line that says when a change lands. Locked (League, for the week):
//     lock glyphs; the armor row still opens the armory to look; the book row is no door. No book: "No book · open
//     market", and Deploy keeps working (#6 reversed). The boards' "record facts · later" slot is not rendered.
//   - DeployLoadoutLine: board 2's line on the Deploy card, "Next deploy carries" with the 40 px still, the book and its
//     count, split by the running game; its door leads to the BaggerBomb card.
// The figures are stills of Shadow wearing the set (N1: the cards' and lines' stills are among the few places a figure
// wears a loadout outside a game). Everything comes from PerGameLoadoutScope.jsx's context; the words are LOADOUT_COPY's,
// the names hub/archetypeLines.js's (through the model). No effect, timer or listener lives here.

import React, { use } from 'react';
import LoadoutStill, { STILL_PX } from '../AgentForm/LoadoutStill';
import { CARD_STATE, bookSubOf, lineOf, tagOf } from './hub/perGameLoadoutModel';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { LOADOUT_COPY } from '../../constants/loadoutCopy';
import { C, HAIR, LOADOUT_CARD_MIN, MONO, tint } from './hub/hubStyle';
import { Card, Eyebrow, HubLink, Icon, LoadingLine, Tag } from './HubParts';
import { PerGameLoadoutContext, cardsOf } from './hub/perGameLoadoutContext';

/** The book's glyph: a list, dashed and dim when there is no book. */
function BookGlyph({ size, none }) {
  return (
    <span aria-hidden="true" data-loadout-book-glyph={none ? 'none' : 'book'} style={{ width: size, height: size, borderRadius: Math.round(size / 4), background: C.bg, border: `1px ${none ? 'dashed' : 'solid'} ${none ? tint('gold', 0.45) : HAIR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: none ? C.ink3 : C.teal }}>
      <svg width={Math.round(size / 2)} height={Math.round(size / 2)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
        <path d="M5 6h1.5M10 6h9M5 12h1.5M10 12h9M5 18h1.5M10 18h9" />
      </svg>
    </span>
  );
}

/** A row's door: a chevron, the lock glyph while locked, or nothing. */
function Door({ locked }) {
  return (
    <span aria-hidden="true" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: locked ? C.ink3 : C.ink2 }}>
      <Icon name={locked ? 'lock' : 'chevR'} size={locked ? 15 : 16} />
    </span>
  );
}

/** The two halves of a card, as their data attribute names them. */
const ROW = Object.freeze({ ARMOR: 'armor', BOOK: 'book' });

const rowStyle = (dashed) => ({
  appearance: 'none', font: 'inherit', color: C.ink, textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 60,
  padding: '6px 4px 6px 6px', borderRadius: 14, background: 'transparent',
  border: dashed ? `1px dashed ${tint('gold', 0.45)}` : '1px solid transparent',
});

/** One half of a card: the whole row is the door when it has one (board 7 #4). */
function LoadoutRow({ icon, name, sub, locked, dashed = false, ariaLabel, onPress, data }) {
  const body = (
    <>
      {icon}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.005em', color: dashed ? C.ink2 : C.ink, overflowWrap: 'anywhere' }}>{name}</span>
        <span style={{ display: 'block', fontSize: 12, color: dashed ? C.gold : C.ink3, fontWeight: dashed ? 600 : 400, marginTop: 3, lineHeight: 1.3 }}>{sub}</span>
      </span>
      <Door locked={locked} />
    </>
  );
  if (!onPress) {
    return <div data-loadout-row={data} aria-label={ariaLabel} style={{ ...rowStyle(dashed), cursor: 'default' }}>{body}</div>;
  }
  return (
    <button type="button" data-loadout-row={data} aria-label={ariaLabel} onClick={onPress} style={{ ...rowStyle(dashed), cursor: 'pointer' }}>
      {body}
    </button>
  );
}

/** The running strip: the game, in the armor it deployed with (its own snapshot). */
function RunningStrip({ running }) {
  return (
    <div data-loadout-running={running.archetype} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, padding: '7px 10px', borderRadius: 12, background: C.bg, border: `1px solid ${HAIR}` }}>
      <LoadoutStill archetype={running.archetype} size={STILL_PX.line} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 3, background: C.teal }} />
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.teal }}>{LOADOUT_COPY.runningNow}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, lineHeight: 1.25, color: C.ink }}>{running.name}</div>
      </div>
    </div>
  );
}

/** The card's last line: when a change lands, or why it cannot and until when. */
function StateLine({ card }) {
  const locked = card.state === CARD_STATE.LOCKED || card.state === CARD_STATE.CHECKING;
  const nobook = card.state === CARD_STATE.NOBOOK && card.kind === 'baggerbomb';
  return (
    <div data-loadout-line={card.state} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginTop: 8, paddingTop: 10, borderTop: `1px solid ${HAIR}`, fontSize: 12.5, lineHeight: 1.4, color: C.ink2, textWrap: 'pretty' }}>
      <span style={{ flexShrink: 0, marginTop: 2, color: locked ? C.ink3 : nobook ? C.gold : C.teal }}><Icon name={locked ? 'lock' : nobook ? 'info' : 'dot'} size={14} /></span>
      <span>{lineOf(card)}</span>
    </div>
  );
}

/** One loadout's card (board 1). */
export function LoadoutCard({ card, onArmor, onBook }) {
  const tag = tagOf(card);
  const locked = card.locked;
  const book = card.book;
  return (
    <section
      aria-label={LOADOUT_COPY.card(card.game)}
      id={`hub-loadout-card-${card.kind}`}
      data-loadout-card={card.kind}
      data-loadout-state={card.state}
      tabIndex={-1}
      style={{ background: C.surface, border: `1px solid ${locked ? HAIR : tint('teal', 0.22)}`, borderRadius: 18, padding: '12px 14px', minWidth: 0, outline: 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 24 }}>
        <Eyebrow color={locked ? C.ink3 : C.teal}>{card.game}</Eyebrow>
        <Tag tone={tag.tone} dim={tag.dim}>{tag.label}</Tag>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 4 }}>
        <LoadoutRow
          data={ROW.ARMOR}
          icon={<LoadoutStill archetype={card.archetype} size={STILL_PX.card} />}
          name={card.name}
          sub={LOADOUT_COPY.set}
          locked={locked}
          ariaLabel={locked ? LOADOUT_COPY.lookArmor(card.game) : LOADOUT_COPY.changeArmor(card.game)}
          onPress={onArmor}
        />
        {book.id ? (
          <LoadoutRow
            data={ROW.BOOK}
            icon={<BookGlyph size={STILL_PX.card} />}
            name={book.name}
            sub={bookSubOf(book)}
            locked={locked}
            ariaLabel={locked ? LOADOUT_COPY.bookLocked(card.game) : LOADOUT_COPY.changeBook(card.game)}
            onPress={locked ? undefined : onBook}
          />
        ) : (
          <LoadoutRow
            data={ROW.BOOK}
            icon={<BookGlyph size={STILL_PX.card} none />}
            name={LOADOUT_COPY.noBook}
            sub={LOADOUT_COPY.chooseBook}
            locked={locked}
            dashed={!locked}
            ariaLabel={locked ? LOADOUT_COPY.bookLocked(card.game) : LOADOUT_COPY.changeBook(card.game)}
            onPress={locked ? undefined : onBook}
          />
        )}
      </div>
      {card.running && <RunningStrip running={card.running} />}
      <StateLine card={card} />
    </section>
  );
}

/**
 * The Loadout tab's cards, with the agent's own adjustments card (where the shells have the slot) and the Forge line
 * (FD-10: the strategy stays on the agent and rides into both games). `onOpenArchetype` / `onOpenBook` are the hub's
 * sheet openers (useHubRuntime: the archetype and watchlist sheets); a door sets which loadout they open for, then
 * opens them, so the opener is the row that was pressed.
 */
export default function LoadoutCards({ onOpenArchetype, onOpenBook, adjustmentsCard = null, onOpenForge }) {
  const scope = use(PerGameLoadoutContext);
  const cards = cardsOf(scope);
  if (!cards) return <LoadingLine style={{ marginTop: 10 }}>{COPY.loadout.loading}</LoadingLine>;
  const door = (open, setKind, kind) => (typeof open === 'function' ? (event) => { setKind(kind); open(event); } : undefined);
  return (
    <>
      <div data-loadout-cards="" style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${LOADOUT_CARD_MIN}px, 1fr))`, gap: 10 }}>
        {[cards.baggerbomb, cards.league].map((card) => (
          <LoadoutCard
            key={card.kind}
            card={card}
            onArmor={door(onOpenArchetype, scope.setArmoryKind, card.kind)}
            onBook={door(onOpenBook, scope.setBookKind, card.kind)}
          />
        ))}
        {adjustmentsCard}
      </div>
      <div data-loadout-forge-line="" style={{ fontSize: 12.5, color: C.ink3, lineHeight: 1.55 }}>
        <span>{LOADOUT_COPY.forgeLine}</span>
        <span>{' '}</span>
        <HubLink onPress={onOpenForge}>{COPY.loadout.changeInForge}</HubLink>
      </div>
    </>
  );
}

/** Bring the BaggerBomb card into view and focus it (the Deploy line's door, on the Loadout tab). */
export function focusLoadoutCard(kind) {
  const el = typeof document !== 'undefined' ? document.getElementById(`hub-loadout-card-${kind}`) : null;
  if (!el) return false;
  el.scrollIntoView?.({ block: 'nearest' });
  el.focus?.({ preventScroll: true });
  return true;
}

/** One loadout line: the still, an eyebrow, the set and the book. */
function LineBody({ eyebrow, archetype, name, book, noBookTone }) {
  return (
    <>
      <LoadoutStill archetype={archetype} size={STILL_PX.line} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.ink3, marginBottom: 3 }}>{eyebrow}</span>
        <span style={{ display: 'block', fontSize: 14, lineHeight: 1.3, color: C.ink, textWrap: 'pretty' }}>
          <span style={{ fontWeight: 700 }}>{name}</span>
          {book ? (
            <span style={{ color: noBookTone ? C.gold : C.ink2, fontWeight: noBookTone ? 600 : 400 }}>{COPY.sep}{book}</span>
          ) : null}
        </span>
      </span>
    </>
  );
}

/**
 * Board 2: the Deploy card's loadout line. "Next deploy carries" the BaggerBomb set (40 px still), its book and its
 * count; a running game splits it ("Running now", in the armor it deployed with). The line is a door to the BaggerBomb
 * card (`onOpen`: the wide hub selects the Loadout area; the phone's card is on the same tab, so it is brought into
 * view). With no book it reads "No book · open market", and Deploy keeps working.
 */
export function DeployLoadoutLine({ onOpen = null }) {
  const scope = use(PerGameLoadoutContext);
  const cards = cardsOf(scope);
  if (!cards) return null;
  const bb = cards.baggerbomb;
  const book = bb.book.id ? (bb.book.count === null ? bb.book.name : `${bb.book.name}${COPY.sep}${COPY.loadout.names(bb.book.count)}`) : LOADOUT_COPY.noBook;
  const open = () => { if (typeof onOpen === 'function') onOpen(); else focusLoadoutCard(bb.kind); };
  return (
    <div data-loadout-deploy-line="" style={{ marginTop: 8 }}>
      {bb.running && (
        <div data-loadout-deploy-running={bb.running.archetype} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '6px 4px', opacity: 0.75 }}>
          <LineBody eyebrow={LOADOUT_COPY.runningNow} archetype={bb.running.archetype} name={bb.running.name} book={null} />
        </div>
      )}
      <button
        type="button"
        onClick={open}
        aria-label={LOADOUT_COPY.openCard}
       
        data-loadout-deploy-next={bb.archetype || ''}
        style={{ appearance: 'none', font: 'inherit', color: C.ink, textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '6px 4px', borderRadius: 12, background: 'transparent', border: '1px solid transparent', borderTop: bb.running ? `1px solid ${HAIR}` : '1px solid transparent', cursor: 'pointer' }}
      >
        <LineBody eyebrow={LOADOUT_COPY.nextCarries} archetype={bb.archetype} name={bb.name} book={book} noBookTone={!bb.book.id} />
        <Door locked={false} />
      </button>
    </div>
  );
}

/** The adjustments card the Loadout tab keeps (the shells' traits slot; the agent's, not a loadout's). */
export function AdjustmentsCard({ adjustments, onChange, onOpenForgeCharacter, doorLabel }) {
  return (
    <Card data-hub-card="adjustments" style={{ background: C.bg, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <Eyebrow>{COPY.loadout.adjustments}</Eyebrow>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginTop: 8, overflowWrap: 'anywhere' }}>{adjustments.name}</div>
      <div style={{ fontSize: 13, color: C.ink2, marginTop: 6, lineHeight: 1.5 }}>{adjustments.sub}</div>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        <HubLink onPress={onChange}>{COPY.loadout.changeAdjustments}</HubLink>
        {typeof onOpenForgeCharacter === 'function' && <HubLink onPress={onOpenForgeCharacter}>{doorLabel}</HubLink>}
      </div>
    </Card>
  );
}
