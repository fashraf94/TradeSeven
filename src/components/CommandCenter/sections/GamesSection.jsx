// src/components/CommandCenter/sections/GamesSection.jsx
//
// Command Center hub, slice S1 — Games (the design's GamesSection and
// GameRow, ff-side.jsx; spec V1.2 §3, §7, §8.2). S1 renders the state for "no
// result has resolved": the heading and "Checking your games". S3 supplies
// the owner's games, their outcomes (§7) and the Film Room review state (§6).
//
// A row takes display-ready fields only (its outcome text and tone come from
// S3's selector, so the verdict word, number and colour share one source —
// BUILD_RULES §9). The desktop, tablet and stacked compositions show the live
// rows plus at most two completed rows (§8.2); History opens the whole
// fetched window.
//
// Slice S3: a completed row carries its review line (hub/gamesDisplay.js
// reviewLineOf) under the row — "Open battle tape" when the helper says the
// review is ready, otherwise the review's state in the spec's words. A failed
// read of the window is never an empty history (§3): with nothing retained it
// says so with Retry; with a retained window it says when that was true.

import React from 'react';
import { DESKTOP_COMPLETED_LIMIT, splitGames } from '../hub/hubModel';
import { HUB_COPY as COPY } from '../hub/hubCopy';
import { formatHubTime } from '../hub/hubDate';
import { C, HAIR, tint } from '../hub/hubStyle';
import { EmptyNote, HubLink, Icon, LoadingLine, Mono, Row, Section, Tag } from '../HubParts';

const OUTCOME_TONE = { pos: C.pos, neg: C.neg };

/** A completed row's review line: the tape link when ready, else the review's state. */
function ReviewLine({ game, onOpenTape }) {
  const line = game.reviewLine;
  return (
    <span data-hub-review={line.state} style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 12, fontSize: 12, color: C.ink2, lineHeight: 1.4 }}>
      {line.openable ? (
        <HubLink onPress={onOpenTape ? () => onOpenTape(game) : undefined} ariaLabel={COPY.games.review.openTapeLabel(game.mode, game.opponent, game.detail)} size={12}>
          {line.text}
        </HubLink>
      ) : (
        <>
          {line.state === 'checking' ? null : <span aria-hidden="true" style={{ color: C.ink3, display: 'flex' }}><Icon name="film" size={13} /></span>}
          <span>{line.text}</span>
        </>
      )}
    </span>
  );
}

export function GameRow({ game, onOpen, onOpenTape, compact = false }) {
  const live = Boolean(game.live);
  const outcome = game.outcome || null;
  const tags = (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      {live && <Tag tone="teal">{game.preOpen ? COPY.strip.deployed(game.clock) : COPY.strip.live(game.clock)}</Tag>}
      {!live && outcome && (outcome.tone === 'pos' || outcome.tone === 'neg') && (
        <Mono style={{ fontSize: 13.5, fontWeight: 700, color: OUTCOME_TONE[outcome.tone] }}>{outcome.text}</Mono>
      )}
      {/* A recorded draw wears the design's tinted ink-2 chip; anything without a verdict (No result, Ended) the dim one (ff-side.jsx ResultTag; S1 review L1-10). */}
      {!live && outcome && outcome.tone === 'draw' && <Tag tone="ink-2">{outcome.text}</Tag>}
      {!live && outcome && outcome.tone !== 'pos' && outcome.tone !== 'neg' && outcome.tone !== 'draw' && <Tag dim>{outcome.text}</Tag>}
      {!live && game.review && <Tag tone="gold" dim>{COPY.games.reviewTag}</Tag>}
    </span>
  );
  const row = (
    <Row
      onPress={onOpen ? () => onOpen(game) : undefined}
      ariaLabel={COPY.games.rowLabel(live, game.mode, game.opponent, live ? COPY.strip.live(game.clock) : outcome?.text || '', !live && game.review, game.detail)}
      style={{ background: C.bg, border: `1px solid ${live ? tint('teal', 0.35) : HAIR}`, minHeight: compact ? 48 : 56 }}
    >
      <span data-hub-game-row={live ? 'live' : 'completed'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ display: 'block', minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 11, color: C.ink3, letterSpacing: '0.02em' }}>{COPY.games.vs(game.mode)}</span>
          <span style={{ display: 'block', fontSize: compact ? 13.5 : 14.5, fontWeight: 600, color: C.ink, lineHeight: 1.25, textWrap: 'pretty' }}>{game.opponent}</span>
        </span>
        {tags}
      </span>
      {game.detail && <span style={{ display: 'block', fontSize: 12, color: C.ink3, marginTop: 4, lineHeight: 1.4 }}>{game.detail}</span>}
    </Row>
  );
  if (live || !game.reviewLine) return row;
  return (
    <div data-hub-game={game.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {row}
      <ReviewLine game={game} onOpenTape={onOpenTape} />
    </div>
  );
}

/** A failed read of the window (spec §3): with nothing retained, the failure and Retry; never "No games yet". */
export function GamesReadNote({ games, onRetry }) {
  const at = formatHubTime(games?.nextAttemptAt, { roundUp: true });
  const asOf = formatHubTime(games?.asOf);
  const retained = games?.status === 'ready';
  return (
    <div data-hub-games-note={retained ? 'stale' : 'error'} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.ink2, lineHeight: 1.45 }}>
      <span>{retained ? COPY.games.staleAsOf(asOf ? COPY.time.et(asOf) : '') : COPY.games.loadFailed}</span>
      {at && <span>{COPY.sep}{COPY.games.nextAttempt(COPY.time.et(at))}</span>}
      <span>{COPY.sep}</span>
      <HubLink onPress={onRetry}>{COPY.games.retry}</HubLink>
    </div>
  );
}

export default function GamesSection({ games, onOpenGame, onOpenTape, onOpenHistory, onRetry }) {
  const ready = games?.status === 'ready';
  const failed = games?.status === 'error';
  const stale = ready && games.stale === true;
  const { live, completed } = splitGames(games);
  const shown = [...live, ...completed.slice(0, DESKTOP_COMPLETED_LIMIT)];
  let right = null;
  if (ready && live.length) right = <Tag tone="teal">{COPY.games.liveCount(live.length)}</Tag>;
  // The design shows the completed count whenever no game is live, "0 completed" included (S1 review L1-10).
  else if (ready) right = <Mono style={{ fontSize: 11, color: C.ink3 }}>{COPY.games.completedCount(completed.length)}</Mono>;
  const history = ready && completed.length > DESKTOP_COMPLETED_LIMIT && onOpenHistory
    ? <HubLink onPress={onOpenHistory}>{COPY.games.history}</HubLink>
    : null;
  return (
    <Section
      label={COPY.games.label}
      data-hub-section="games"
      right={right || history ? <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{right}{history}</div> : null}
    >
      {!ready && !failed && <LoadingLine>{COPY.games.loading}</LoadingLine>}
      {(failed || stale) && <GamesReadNote games={games} onRetry={onRetry} />}
      {ready && shown.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {shown.map((g) => <GameRow key={g.id} game={g} onOpen={onOpenGame} onOpenTape={onOpenTape} />)}
        </div>
      )}
      {/* Empty history needs a successful empty read: never after a failed one (spec §3). */}
      {ready && !stale && shown.length === 0 && <EmptyNote icon="sword" title={COPY.games.empty} sub={COPY.games.emptySub} />}
    </Section>
  );
}
