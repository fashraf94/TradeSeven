// src/components/Tournament/awaitingOpen/AwaitFreeAgentBrowser.jsx
//
// Awaiting-the-Open redesign — the free-agent browser (§7.0 follow-up).
//
// WHY THIS EXISTS: the redesign replaced the old two-dropdown Claims panel with
// a per-row claim on the wire, and the wire is capped at the twelve best fits.
// The dropdown could reach every name in `userPool` (~100), so a name ranked
// #40 for the user's archetype became unreachable in the UI even though the
// server would accept the claim. That was a capability regression, not a
// simplification. This restores the reach without inflating the wire: the wire
// stays the twelve-name recommendation, and this is the way to everything else.
//
// ONE FIT METRIC: the board handed in is `buildFreeAgentUniverse(...)`, of which
// the wire is literally `.slice(0, 12)`. Filtering never re-sorts, so results
// stay fit-descending in both search and browse and a browsed name's fit,
// rationale and ordering are the same numbers the wire shows (BUILD_RULES §9).
//
// SEARCH SURFACE: the universe carries no company name — `stockEntry`
// (compute-index-intelligence.js) has symbol / sectorId / sectorName /
// industryName and nothing else — so matching is ticker plus the sector and
// industry text that does exist. No fabricated name field.
//
// AVAILABILITY: `userPool` already excludes every drafted name and is kept live
// by the claim processor (tournamentClaims.js:241-242 splices the won name out
// and pushes the dropped one back). The caller additionally excludes the user's
// own held picks and any symbol already carrying a pending claim, so every row
// here is genuinely claimable.

import React, { useMemo, useRef } from 'react';
import { Search, X, ArrowRight, Lock } from 'lucide-react';
import { filterFreeAgents, sectorFacets } from './podBoard';
import { alpha, wSec } from './awaitTokens';
import { Mono, useAwaitPalette } from './awaitPrimitives';
import AwaitWireRow from './AwaitWireRow';

/**
 * The browser's per-row action: pick this name and carry it into the existing
 * drop-selection step. Never a claim in itself.
 *
 * It honours the SAME gates the wire's Claim button applies, because selecting
 * into a drop step whose submit can never enable is a dead end — and in the
 * no-picks case it would be one with no explanation at all. `locked` is
 * deliberately absent here too: the window mirror never blocks (founder ruling).
 */
function selectAction({ onSelect, capReached, hasPicks }) {
  return (stock) => {
    const [title, label] = capReached
      ? ['You have the maximum pending claims — wait for tonight’s processing', 'CAP FULL']
      : !hasPicks
        ? ['You have no picks to drop for a claim', 'NO PICKS']
        : [`Claim ${stock.symbol} — choose which pick it replaces next`, 'SELECT'];
    const disabled = capReached || !hasPicks;
    return {
      label,
      title,
      icon: disabled ? Lock : ArrowRight,
      disabled,
      tone: disabled ? 'dim' : 'live',
      onAction: onSelect,
    };
  };
}

export default function AwaitFreeAgentBrowser({
  board = [],              // the FULL fit-ranked universe
  excludeSymbols = null,   // held picks + pending claims
  query = '',
  sector = null,
  onQuery,
  onSector,
  onSelect,
  capReached = false,
  hasPicks = true,
  onResearch = null,
  compact = false,
}) {
  const pal = useAwaitPalette();
  const inputRef = useRef(null);

  const available = useMemo(
    () => filterFreeAgents({ board, excludeSymbols }),
    [board, excludeSymbols],
  );
  // Facets are computed over the QUERY-filtered set (sector deliberately not
  // applied, so each chip answers "how many would I get if I picked this one").
  // Counting over `available` instead would let a chip advertise 41 names and
  // then yield NO MATCHES once a query is typed — the number and the result
  // disagreeing, which is the display-agreement rule (BUILD_RULES §9).
  const searched = useMemo(
    () => filterFreeAgents({ board: available, query }),
    [available, query],
  );
  const facets = useMemo(() => sectorFacets(searched), [searched]);
  const results = useMemo(
    () => filterFreeAgents({ board: searched, sector }),
    [searched, sector],
  );
  const act = useMemo(
    () => selectAction({ onSelect, capReached, hasPicks }),
    [onSelect, capReached, hasPicks],
  );

  const filtered = !!(query || sector);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      {/* search — pinned above the scroll region so results are never buried */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 12,
        background: alpha(pal.white, 0.04), border: `1px solid ${pal.hair2}`, marginBottom: 10,
      }}>
        <Search size={14} color={pal.ink3} strokeWidth={2.2} aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQuery && onQuery(e.target.value)}
          placeholder="Search ticker, sector or industry…"
          aria-label="Search free agents by ticker, sector or industry"
          style={{
            flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
            color: pal.ink, fontFamily: 'var(--ld-mono)', letterSpacing: '0.02em',
          }}
        />
        {query && (
          <button
            type="button" className="aw-btn" onClick={() => { onQuery(''); inputRef.current?.focus(); }}
            aria-label="Clear search"
            style={{
              background: 'transparent', border: 'none', padding: 3, lineHeight: 0, cursor: 'pointer',
            }}
          >
            <X size={13} color={pal.ink3} strokeWidth={2.4} />
          </button>
        )}
      </div>

      {/* sector filter — with no query this is a browse path in its own right:
          pick a sector and get every available name in it, fit-ranked. */}
      <div style={{
        display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, flexShrink: 0,
      }}>
        <button
          type="button" className="aw-btn" onClick={() => onSector && onSector(null)}
          aria-pressed={!sector}
          style={{
            font: 'inherit', fontFamily: 'var(--ld-mono)', '--aw-btn-fs': '9.5px', fontWeight: 700,
            letterSpacing: '0.08em', padding: '5px 10px', borderRadius: 999, cursor: 'pointer',
            color: !sector ? pal.teal : pal.ink3,
            background: !sector ? alpha(pal.teal, 0.12) : alpha(pal.white, 0.03),
            border: `1px solid ${!sector ? alpha(pal.teal, 0.36) : pal.hair2}`,
          }}
        >
          ALL {searched.length}
        </button>
        {facets.map(({ sector: name, n }) => {
          const on = sector === name;
          const c = wSec(name);
          return (
            <button
              key={name}
              type="button"
              className="aw-btn"
              onClick={() => onSector && onSector(on ? null : name)}
              aria-pressed={on}
              title={`${n} ${query ? 'matching' : 'available'} in ${name}`}
              style={{
                font: 'inherit', fontFamily: 'var(--ld-mono)', '--aw-btn-fs': '9.5px', fontWeight: 700,
                letterSpacing: '0.08em', padding: '5px 10px', borderRadius: 999, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                color: on ? c : pal.ink2,
                background: on ? alpha(c, 0.14) : alpha(pal.white, 0.03),
                border: `1px solid ${on ? alpha(c, 0.42) : pal.hair2}`,
              }}
            >
              <span aria-hidden="true" style={{
                width: 4.5, height: 4.5, borderRadius: '50%', background: c,
                boxShadow: on ? `0 0 6px ${alpha(c, 0.9)}` : 'none',
              }} />
              {name} {n}
            </button>
          );
        })}
      </div>

      {/* results — the ONLY scrolling region, so the search and filters stay put */}
      <div
        role="list"
        aria-label="Available free agents, best fit first"
        style={{
          flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          display: 'flex', flexDirection: 'column', gap: compact ? 7 : 8,
          paddingRight: 2,
        }}
      >
        {results.length === 0 ? (
          <div style={{
            padding: '18px 12px', borderRadius: 12, textAlign: 'center',
            background: alpha(pal.white, 0.014), border: `1px dashed ${pal.hair2}`,
          }}>
            <Mono style={{ fontSize: 10.5, color: pal.ink3, letterSpacing: '0.06em' }}>
              {available.length === 0 ? 'NO NAMES AVAILABLE TO CLAIM' : 'NO MATCHES'}
            </Mono>
          </div>
        ) : results.map((stock) => (
          <div role="listitem" key={stock.symbol}>
            <AwaitWireRow
              stock={stock}
              action={act(stock)}
              onResearch={onResearch}
              compact={compact}
              rankLabel={`#${stock.boardRank} FIT`}
            />
          </div>
        ))}
      </div>

      <Mono style={{
        display: 'block', textAlign: 'center', fontSize: 9.5, color: pal.ink3,
        letterSpacing: '0.06em', marginTop: 9, flexShrink: 0,
      }}>
        {filtered
          ? `${results.length} OF ${available.length} · BEST FIT FIRST`
          : `${available.length} AVAILABLE · BEST FIT FIRST`}
      </Mono>
    </div>
  );
}
