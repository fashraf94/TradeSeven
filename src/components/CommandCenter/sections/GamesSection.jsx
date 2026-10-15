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

import React from 'react';
import { DESKTOP_COMPLETED_LIMIT, splitGames } from '../hub/hubModel';
import { HUB_COPY as COPY } from '../hub/hubCopy';
import { C, HAIR, tint } from '../hub/hubStyle';
import { EmptyNote, HubLink, LoadingLine, Mono, Row, Section, Tag } from '../HubParts';

const OUTCOME_TONE = { pos: C.pos, neg: C.neg };

export function GameRow({ game, onOpen, compact = false }) {
  const live = Boolean(game.live);
  const outcome = game.outcome || null;
  const tags = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      {live && <Tag tone="teal">{game.preOpen ? COPY.strip.deployed(game.clock) : COPY.strip.live(game.clock)}</Tag>}
      {!live && outcome && (outcome.tone === 'pos' || outcome.tone === 'neg') && (
        <Mono style={{ fontSize: 13.5, fontWeight: 700, color: OUTCOME_TONE[outcome.tone] }}>{outcome.text}</Mono>
      )}
      {!live && outcome && outcome.tone !== 'pos' && outcome.tone !== 'neg' && <Tag dim>{outcome.text}</Tag>}
      {!live && game.review && <Tag tone="gold" dim>{COPY.games.reviewTag}</Tag>}
    </div>
  );
  return (
    <Row
      onPress={onOpen ? () => onOpen(game) : undefined}
      ariaLabel={COPY.games.rowLabel(live, game.mode, game.opponent, live ? COPY.strip.live(game.clock) : outcome?.text || '')}
      style={{ background: C.bg, border: `1px solid ${live ? tint('teal', 0.35) : HAIR}`, minHeight: compact ? 48 : 56 }}
    >
      <div data-hub-game-row={live ? 'live' : 'completed'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: C.ink3, letterSpacing: '0.02em' }}>{COPY.games.vs(game.mode)}</div>
          <div style={{ fontSize: compact ? 13.5 : 14.5, fontWeight: 600, color: C.ink, lineHeight: 1.25, textWrap: 'pretty' }}>{game.opponent}</div>
        </div>
        {tags}
      </div>
      {game.detail && <div style={{ fontSize: 12, color: C.ink3, marginTop: 4, lineHeight: 1.4 }}>{game.detail}</div>}
    </Row>
  );
}

export default function GamesSection({ games, onOpenGame, onOpenHistory }) {
  const ready = games?.status === 'ready';
  const { live, completed } = splitGames(games);
  const shown = [...live, ...completed.slice(0, DESKTOP_COMPLETED_LIMIT)];
  let right = null;
  if (ready && live.length) right = <Tag tone="teal">{COPY.games.liveCount(live.length)}</Tag>;
  else if (ready && completed.length) right = <Mono style={{ fontSize: 11, color: C.ink3 }}>{COPY.games.completedCount(completed.length)}</Mono>;
  const history = ready && completed.length > DESKTOP_COMPLETED_LIMIT && onOpenHistory
    ? <HubLink onPress={onOpenHistory} style={{ fontSize: 12.5 }}>{COPY.games.history}</HubLink>
    : null;
  return (
    <Section
      label={COPY.games.label}
      data-hub-section="games"
      right={right || history ? <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{right}{history}</div> : null}
    >
      {!ready && <LoadingLine>{COPY.games.loading}</LoadingLine>}
      {ready && shown.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {shown.map((g) => <GameRow key={g.id} game={g} onOpen={onOpenGame} />)}
        </div>
      )}
      {ready && shown.length === 0 && <EmptyNote icon="sword" title={COPY.games.empty} sub={COPY.games.emptySub} />}
    </Section>
  );
}
