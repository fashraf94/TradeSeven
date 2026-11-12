import React from 'react';
import { HOLO_COLORS, CATEGORY_CONFIG, getSectorColor } from '../../constants/holoTheme';
import { INDEX_REGISTRY } from '../../constants/indexRegistry';
import { priceText } from './priceFormat';
import { ST, MONO, tint } from './Sheet/sheetTheme';
import { SHELL_COPY } from './Sheet/sheetCopy';
import { HEAT } from './BombMode/bombTheme';

/**
 * The two-view shell's header control (Amendment C R-27, H1; spec
 * docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md SB-3): filled pills of equal
 * width with space between them — Analysis · Chart · 💣 in battle, Analysis ·
 * Chart in browse — the active one filled. The 💣 pill warms with Bomb mode's
 * heat accent while the view model is in a red zone or the Danger Zone.
 */
function ShellPills({ views, active, onView, warm }) {
  return (
    <div role="tablist" aria-label={SHELL_COPY.viewsLabel} data-shell-pills={views.length} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {views.map((v) => {
        const on = v === active;
        const bomb = v === 'bomb';
        const heat = bomb && warm === true && !on;
        const accent = bomb ? ST.amber : ST.teal;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={on}
            data-shell-pill={v}
            {...(bomb ? { 'aria-label': SHELL_COPY.viewBombLabel, 'data-shell-pill-warm': heat ? '1' : '0' } : {})}
            onClick={() => { if (!on) onView(v); }}
            style={{
              all: 'unset', boxSizing: 'border-box', cursor: 'pointer', flex: 1, minWidth: 0, minHeight: 44, borderRadius: 999,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, whiteSpace: 'nowrap',
              color: on ? ST.bg : ST.ink2,
              background: on ? accent : heat ? tint(HEAT, 16) : 'transparent',
              border: `1px solid ${on ? accent : heat ? tint(HEAT, 70) : ST.hair}`,
            }}
          >
            {/* src/index.css forces a <button>'s own font-size to 16px: the label's size sits on a span. */}
            <span style={{ fontSize: 14, lineHeight: 1 }}>{v === 'analysis' ? SHELL_COPY.viewAnalysis : v === 'chart' ? SHELL_COPY.viewChart : SHELL_COPY.viewBomb}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The shell's two-row header: the stock row, then the pills. No Why? door (R-27).
 * Its change pill is the DAY's change only (`shell.change`, the research hook's daily change),
 * shown once known: a battle asset's own percentChange can be its change since entry, so it is
 * never the fallback here (BUILD_RULES §9; What's moving's title reads the same number).
 */
function ShellHeader({ asset, onClose, onBack, shell }) {
  const priceChange = typeof shell.change === 'number' && Number.isFinite(shell.change) ? shell.change : null;
  const up = priceChange === null || priceChange >= 0;
  const tone = up ? ST.green : ST.red;
  return (
    <div data-shell-header style={{ flexShrink: 0, background: ST.bg, borderBottom: `1px solid ${ST.hair}` }}>
      <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 0 14px' }}>
        {onBack && (
          <button type="button" data-shell-back onClick={onBack} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', color: ST.teal, minWidth: 32, minHeight: 44, padding: '0 4px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{'←'}</span>
          </button>
        )}
        <span style={{ fontSize: 17, fontWeight: 800, color: ST.ink, whiteSpace: 'nowrap' }}>{asset.symbol}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: ST.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{asset.name}</span>
        <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: ST.ink, whiteSpace: 'nowrap' }}>${priceText(asset.price) || '—'}</span>
        {priceChange !== null && (
          <span data-shell-change style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: tone, background: tint(tone, 14), borderRadius: 999, padding: '4px 8px', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
            {up ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)}%
          </span>
        )}
        <button type="button" data-shell-close onClick={onClose} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', width: 40, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: ST.ink2 }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>{'✕'}</span>
        </button>
      </div>
      <div style={{ padding: '0 14px 12px' }}>
        <ShellPills views={shell.views} active={shell.active} onView={shell.onView} warm={shell.warm} />
      </div>
    </div>
  );
}

/**
 * ChartHeader - Compact 56px header bar for the redesigned research modal.
 * Replaces the giant hero block with a space-efficient layout.
 *
 * `shell` (the two-view shell, SB-3): { views, active, onView, warm } — the
 * header becomes the stock row and the view pills, with no Why? door. Absent
 * (the shell off), the header below renders exactly as it always has.
 */
const ChartHeader = ({ asset, sector, category, isIndex, onClose, onWhyMoving, onBack, shell = null }) => {
  if (!asset) return null;
  if (shell) return <ShellHeader asset={asset} onClose={onClose} onBack={onBack} shell={shell} />;

  const sectorColor = getSectorColor(sector);
  const priceChange = asset.percentChange || asset.change || 0;
  const isPositive = priceChange >= 0;
  const catConfig = category ? CATEGORY_CONFIG[category] : null;
  const indexInfo = isIndex ? INDEX_REGISTRY[asset.symbol] : null;

  return (
    <div style={{
      height: '52px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      background: HOLO_COLORS.bgCard,
      borderBottom: '1px solid rgba(0, 217, 255, 0.1)',
      flexShrink: 0,
    }}>
      {/* Left: Back + Symbol + Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#00d9ff', fontSize: '18px', padding: '2px 4px',
              display: 'flex', alignItems: 'center', flexShrink: 0,
            }}
          >
            {'\u2190'}
          </button>
        )}
        <span style={{
          fontSize: '16px',
          fontWeight: '800',
          color: indexInfo ? indexInfo.color : HOLO_COLORS.textPrimary,
          letterSpacing: '0.5px',
        }}>
          {indexInfo ? indexInfo.name : asset.symbol}
        </span>

        <span style={{
          fontSize: '14px',
          color: HOLO_COLORS.textSecondary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {indexInfo ? `(${asset.symbol})` : asset.name}
        </span>

        {/* Category pill */}
        {catConfig && (
          <span style={{
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: '700',
            textTransform: 'uppercase',
            background: `${catConfig.color}20`,
            color: catConfig.color,
            border: `1px solid ${catConfig.color}40`,
            flexShrink: 0,
          }}>
            {catConfig.letter}
          </span>
        )}

        {/* Sector badge */}
        {sector && (
          <span style={{
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: '600',
            background: `${sectorColor}15`,
            color: sectorColor,
            flexShrink: 0,
            display: 'none', // Hidden on small screens, visible on wider
          }}>
            {sector}
          </span>
        )}
      </div>

      {/* Right: Price + Change + Close */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span style={{
          fontSize: '15px',
          fontWeight: '700',
          color: HOLO_COLORS.textPrimary,
          fontFamily: 'monospace',
        }}>
          ${priceText(asset.price) || '\u2014'}
        </span>

        {/* Daily change pill */}
        <span style={{
          padding: '2px 6px',
          borderRadius: '10px',
          fontSize: '12px',
          fontWeight: '600',
          background: isPositive ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 71, 87, 0.15)',
          color: isPositive ? HOLO_COLORS.green : '#ff4757',
        }}>
          {isPositive ? '\u25B2' : '\u25BC'} {Math.abs(priceChange)?.toFixed(2)}%
        </span>

        {/* Why is it moving? button */}
        {onWhyMoving && (
          <button
            onClick={(e) => { e.stopPropagation(); onWhyMoving(); }}
            style={{
              background: 'rgba(0, 217, 255, 0.1)',
              border: '1px solid rgba(0, 217, 255, 0.2)',
              borderRadius: '10px',
              color: '#00d9ff',
              fontSize: '11px',
              fontWeight: '600',
              padding: '2px 8px',
              cursor: 'pointer',
            }}
          >
            Why?
          </button>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: HOLO_COLORS.textSecondary,
            cursor: 'pointer',
            padding: '4px',
            fontSize: '18px',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {'\u2715'}
        </button>
      </div>
    </div>
  );
};

export default ChartHeader;
