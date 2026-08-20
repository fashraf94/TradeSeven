// src/components/Tournament/awaitingOpen/AwaitDraftBoard.jsx
//
// Awaiting-the-Open redesign — the draftboard, made to dominate (build spec
// §4.1: full width, the loudest panel on the page). Seat lanes rather than the
// classic round-major rows: YOUR lane is raised, washed and glowing in the
// ownership blue; CPU seats recede but stay scannable. The four-seat structure
// is unchanged — only the reading direction and the treatment.
//
// Both boards derive from the same buildDraftGrid via buildSeatLanes, so the
// classic and redesigned bodies can never show different picks (BUILD_RULES §9).
// Every ticker is a real button into AssetResearchModal (spec §6.3) on both the
// board and the wire.
//
// Glow discipline (spec §7): the ownership WASH and the lane bloom are on YOUR
// lane only — CPU lanes get a flat surface and a hairline. The sector-spine
// light on a ticker plate is the plate's own grammar and is present on every
// plate, yours and theirs alike.

import React, { useMemo } from 'react';
import { Layers, User, Cpu } from 'lucide-react';
import { buildSeatLanes, sectorSpread } from './podBoard';
import { alpha, wSec, WPOD } from './awaitTokens';
import { Mono, WSurf, BandHead, TickerPlate, useAwaitPalette } from './awaitPrimitives';

/** Sector spread of your three — what the book adds up to. */
export function BookSpread({ picks, compact = false }) {
  const pal = useAwaitPalette();
  const list = useMemo(() => sectorSpread(picks), [picks]);
  if (!list.length) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <Mono style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.22em', color: pal.ink3 }}>YOUR BOOK</Mono>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {list.map(({ sector, n }) => {
          const c = wSec(sector);
          return (
            <span key={sector} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: 999,
              background: alpha(c, 0.11), border: `1px solid ${alpha(c, 0.3)}`,
            }}>
              <span aria-hidden="true" style={{
                width: 4.5, height: 4.5, borderRadius: '50%', background: c, boxShadow: `0 0 6px ${alpha(c, 0.8)}`,
              }} />
              <Mono style={{ fontSize: compact ? 9.5 : 10, fontWeight: 700, color: c, letterSpacing: '0.04em' }}>{sector}</Mono>
              <Mono style={{ fontSize: compact ? 9.5 : 10, fontWeight: 700, color: alpha(c, 0.6) }}>×{n}</Mono>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function SeatHead({ seat, mine, pal }) {
  const c = mine ? pal.you : pal.ink3;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 2 }}>
      <span aria-hidden="true" style={{
        width: mine ? 22 : 18, height: mine ? 22 : 18, borderRadius: 7, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: alpha(c, mine ? 0.18 : 0.1), border: `1px solid ${alpha(c, mine ? 0.45 : 0.24)}`,
      }}>
        {mine ? <User size={12} color={c} strokeWidth={2.2} /> : <Cpu size={10} color={c} strokeWidth={2.2} />}
      </span>
      <Mono style={{
        fontSize: mine ? 11 : 10, fontWeight: 700, letterSpacing: '0.16em',
        color: mine ? pal.you : pal.ink2,
      }}>
        {mine ? 'YOU' : String(seat).toUpperCase()}
      </Mono>
      {mine && (
        <span aria-hidden="true" style={{
          width: 6, height: 6, borderRadius: '50%', background: pal.you, boxShadow: `0 0 8px ${pal.you}`,
        }} />
      )}
    </div>
  );
}

/** One pick cell. An undrafted slot renders an honest em-dash rather than a
 *  fabricated plate. */
function PickCell({ pick, mine, compact, onResearch, pal }) {
  const own = mine ? pal.you : pal.ink3;
  const frame = {
    display: 'flex', alignItems: 'center', gap: 9, padding: '8px 9px', borderRadius: 12,
    minWidth: 0, height: '100%', boxSizing: 'border-box',
    background: mine
      ? `linear-gradient(120deg, ${alpha(pal.you, 0.17)}, ${alpha(pal.bg, 0.26)} 78%)`
      : alpha(pal.white, 0.022),
    border: `1px solid ${mine ? alpha(pal.you, 0.42) : pal.hair}`,
    boxShadow: mine ? `inset 0 1px 0 ${alpha(pal.white, 0.09)}, 0 0 28px -16px ${alpha(pal.you, 0.95)}` : 'none',
  };

  if (!pick) {
    return (
      <div className="aw-cell" style={frame}>
        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: own, flexShrink: 0, opacity: 0.5 }} />
        <Mono style={{ fontSize: 12, color: pal.ink3 }}>—</Mono>
      </div>
    );
  }

  return (
    <div className="aw-cell" style={frame}>
      <span aria-hidden="true" style={{
        width: 6, height: 6, borderRadius: '50%', background: own, flexShrink: 0,
        boxShadow: mine ? `0 0 8px ${own}` : 'none',
      }} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex' }}>
        <TickerPlate symbol={pick.symbol} sector={pick.sector} size={compact ? 'sm' : 'md'} onResearch={onResearch} />
      </span>
      <Mono style={{
        fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', flexShrink: 0,
        color: mine ? alpha(pal.you, 0.85) : pal.ink3,
      }}>
        {mine ? 'YOURS' : 'CPU'}
      </Mono>
    </div>
  );
}

const CARD_H = 52;
const CARD_GAP = 7;
const LANE_PAD = 8;

export default function AwaitDraftBoard({
  pod, uid, events, sectorMap, picksPerPlayer = 3, onResearch = null, compact = false,
}) {
  const pal = useAwaitPalette();
  const members = useMemo(() => pod?.groupMembers || [], [pod?.groupMembers]);
  const lanes = useMemo(
    () => buildSeatLanes({ events, groupMembers: members, picksPerPlayer, uid, sectorMap }),
    [events, members, picksPerPlayer, uid, sectorMap],
  );

  if (!lanes.length) return null;

  const you = lanes.find((l) => l.you) || null;
  const cpus = lanes.filter((l) => !l.you);
  const yourPicks = (you?.picks || []).filter(Boolean);

  const board = compact ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {you && (
        <div style={{
          borderRadius: 15, padding: '11px 11px 12px',
          background: `linear-gradient(170deg, ${alpha(pal.you, 0.1)}, ${alpha(pal.bg, 0.32)} 66%)`,
          border: `1px solid ${alpha(pal.you, 0.34)}`,
          boxShadow: `0 0 40px -22px ${alpha(pal.you, 0.95)}`,
        }}>
          <div style={{ marginBottom: 10 }}><SeatHead mine pal={pal} /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {you.picks.map((p, i) => (
              <div key={p ? p.symbol : `you-empty-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mono style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: alpha(pal.you, 0.9), width: 20, flexShrink: 0 }}>
                  R{i + 1}
                </Mono>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <PickCell pick={p} mine compact onResearch={onResearch} pal={pal} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {cpus.map((lane) => (
        <div key={lane.odUserId} style={{
          borderRadius: 13, background: alpha(pal.white, 0.018),
          border: `1px solid ${pal.hair}`, padding: '10px 11px',
        }}>
          <div style={{ marginBottom: 9 }}><SeatHead seat={lane.seat} pal={pal} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 6 }}>
            {lane.picks.map((p, i) => (
              <div key={p ? p.symbol : `${lane.odUserId}-empty-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                <Mono style={{ fontSize: 8, fontWeight: 700, color: pal.ink3, letterSpacing: '0.1em' }}>R{i + 1}</Mono>
                {p
                  ? <TickerPlate symbol={p.symbol} sector={p.sector} size="sm" onResearch={onResearch} />
                  : <Mono style={{ fontSize: 12, color: pal.ink3 }}>—</Mono>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  ) : (
    // desktop: a round spine plus the seat lanes — every cell the same height so
    // the board reads as a grid, with yours as one washed, glowing lane.
    <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
      <div style={{ width: 26, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 22, marginBottom: 12 }} />
        <div style={{ paddingTop: LANE_PAD, display: 'flex', flexDirection: 'column', gap: CARD_GAP }}>
          {Array.from({ length: picksPerPlayer }, (_, i) => (
            <div key={i} style={{ height: CARD_H, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <Mono style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: pal.ink3 }}>R{i + 1}</Mono>
            </div>
          ))}
        </div>
      </div>

      {you && (
        <div style={{ flex: 1.16, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: 22, marginBottom: 12 }}><SeatHead mine pal={pal} /></div>
          <div style={{
            borderRadius: 15, padding: LANE_PAD,
            background: `linear-gradient(172deg, ${alpha(pal.you, 0.14)}, ${alpha(pal.bg, 0.28)} 74%)`,
            border: `1px solid ${alpha(pal.you, 0.4)}`,
            boxShadow: `inset 0 1px 0 ${alpha(pal.white, 0.08)}, 0 0 52px -20px ${alpha(pal.you, 1)}`,
            display: 'flex', flexDirection: 'column', gap: CARD_GAP,
          }}>
            {you.picks.map((p, i) => (
              <div key={p ? p.symbol : `you-empty-${i}`} style={{ height: CARD_H }}>
                <PickCell pick={p} mine onResearch={onResearch} pal={pal} />
              </div>
            ))}
          </div>
        </div>
      )}

      {cpus.map((lane) => (
        <div key={lane.odUserId} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: 22, marginBottom: 12 }}><SeatHead seat={lane.seat} pal={pal} /></div>
          <div style={{
            padding: LANE_PAD, display: 'flex', flexDirection: 'column', gap: CARD_GAP,
            border: '1px solid transparent',
          }}>
            {lane.picks.map((p, i) => (
              <div key={p ? p.symbol : `${lane.odUserId}-empty-${i}`} style={{ height: CARD_H }}>
                <PickCell pick={p} onResearch={onResearch} pal={pal} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <WSurf pad={compact ? 14 : 16} accent={pal.you} glow>
      <BandHead
        compact={compact}
        icon={<Layers size={compact ? 13 : 15} color={pal.you} strokeWidth={2.1} />}
        color={pal.you}
        eyebrow={WPOD.draft.eyebrow}
        title={WPOD.draft.title}
        sub={compact ? WPOD.draft.sub : null}
        right={!compact && yourPicks.length ? <BookSpread picks={yourPicks} /> : null}
      />
      {board}
      {compact && yourPicks.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${pal.hair}` }}>
          <BookSpread picks={yourPicks} compact />
        </div>
      )}
    </WSurf>
  );
}
