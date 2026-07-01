// src/components/Dashboard/desktop/ReadColumn.jsx
//
// Center column · "01 · Read" — the agent's daily regime brief, framed as a call
// to action. Desktop-local read of useDailyRegimeBrief (built fresh rather than
// extracting the mobile inline Read, to avoid regressing the shipped mobile
// surface). Loading → skeleton; brief → clamped narrative + More/less + theme
// chips; otherwise an empty/error line. The "Talk it over" button is a no-op
// "Soon" stub (the Voice Layer is deferred).

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, Eye, MessageCircle, ChevronRight } from 'lucide-react';
import AgentOrb from '../../shared/AgentOrb';
import { CMD, alpha, readableOn, Mono, SectionLabel } from '../commandUI';
import useDailyRegimeBrief from '../../../hooks/useDailyRegimeBrief';

function prettyDate(forDate) {
  if (!forDate) return null;
  try {
    const [y, m, d] = forDate.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
    });
  } catch {
    return forDate;
  }
}

export default function ReadColumn({ accent, agentName, onOpenAgentRecord, onDeploy, deployDisabled, deploying, isLive, boardEnabled, onSeeEyeing }) {
  const drb = useDailyRegimeBrief();

  const [expanded, setExpanded] = useState(false);
  const [isTruncatable, setIsTruncatable] = useState(false);
  const briefRef = useRef(null);
  useEffect(() => {
    if (expanded) return;
    const el = briefRef.current;
    if (el) setIsTruncatable(el.scrollHeight > el.clientHeight + 1);
  }, [drb.dailyBrief, expanded]);

  const orbState = drb.loading ? 'reading' : 'ready';
  const dateLabel = prettyDate(drb.forDate);
  const ink = readableOn(accent);

  const briefBase = { margin: 0, fontSize: 15.5, lineHeight: 1.6, letterSpacing: '-0.005em', color: CMD.ink };
  const briefStyle = expanded
    ? briefBase
    : { ...briefBase, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' };
  const canToggle = isTruncatable || expanded;

  return (
    <div>
      <SectionLabel
        n="01"
        label="Read · today’s read"
        color={accent}
        right={dateLabel ? <Mono style={{ fontSize: 10.5, color: CMD.ink3 }}>{dateLabel}</Mono> : null}
      />
      <div style={{
        padding: '16px 17px 15px', borderRadius: 18,
        background: `linear-gradient(180deg, ${alpha(accent, 0.1)}, ${alpha(accent, 0.02)} 62%, ${CMD.surface})`,
        border: `1px solid ${alpha(accent, 0.26)}`, boxShadow: `inset 0 1px 0 ${alpha(accent, 0.07)}`,
      }}>
        {/* orb + activity — tap → agent record sheet */}
        <div
          onClick={onOpenAgentRecord}
          role="button"
          aria-label="Open agent record"
          style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}
        >
          <AgentOrb state={orbState} size={32} color={accent} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Mono style={{ fontSize: 9.5, letterSpacing: '0.17em', color: accent, textTransform: 'uppercase', fontWeight: 600, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agentName} is reading the market</Mono>
            <Mono style={{ fontSize: 9.5, letterSpacing: '0.04em', color: CMD.ink3, marginTop: 2, display: 'block' }}>Today’s desk brief{dateLabel ? ` · ${dateLabel}` : ''}</Mono>
          </div>
          <ChevronRight size={15} color={CMD.ink3} style={{ flexShrink: 0 }} />
        </div>

        {/* narrative */}
        {drb.loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0.95, 0.85, 0.6].map((w, i) => (
              <div key={i} style={{ height: 13, width: `${w * 100}%`, borderRadius: 6, background: 'linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))' }} />
            ))}
          </div>
        ) : drb.dailyBrief ? (
          <div onClick={() => canToggle && setExpanded((e) => !e)} style={{ cursor: canToggle ? 'pointer' : 'default' }}>
            <p ref={briefRef} style={briefStyle}>{drb.dailyBrief}</p>
            {canToggle && <span style={{ display: 'inline-block', marginTop: 6, fontSize: 12, fontWeight: 700, color: accent }}>{expanded ? 'Show less' : 'More'}</span>}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: CMD.ink2 }}>
            {drb.error
              ? 'Couldn’t load today’s brief just now — pull to retry shortly.'
              : 'Today’s brief isn’t in yet. Your agent will read it the moment it lands.'}
          </p>
        )}

        {/* theme chips */}
        {!drb.loading && drb.themes.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
            {drb.themes.slice(0, 3).map((t, i) => (
              <span key={`t-${i}`} style={{ fontSize: 11, fontWeight: 600, color: CMD.ink2, padding: '4px 10px', borderRadius: 20, background: alpha(accent, 0.1), border: `1px solid ${alpha(accent, 0.2)}` }}>{t}</span>
            ))}
          </div>
        )}
        {expanded && !drb.loading && drb.keyEvents.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {drb.keyEvents.slice(0, 4).map((e, i) => (
              <span key={`e-${i}`} style={{ fontSize: 11, fontWeight: 600, color: CMD.ink3, padding: '4px 10px', borderRadius: 20, background: alpha('#FFFFFF', 0.04), border: `1px solid ${CMD.hair}` }}>{e?.label || ''}</span>
            ))}
          </div>
        )}

        {/* the read flows into the decision */}
        <div style={{ display: 'flex', gap: 9, marginTop: 15 }}>
          {boardEnabled ? (
            <motion.button
              type="button"
              onClick={onSeeEyeing}
              disabled={isLive}
              whileTap={isLive ? undefined : { scale: 0.985 }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: 12, borderRadius: 12, border: 'none', cursor: isLive ? 'default' : 'pointer', fontFamily: 'inherit',
                background: accent, color: ink, fontWeight: 700, fontSize: 13.5, opacity: isLive ? 0.55 : 1,
              }}
            >
              <Eye size={16} color={ink} />
              <span>{isLive ? 'Battle in progress' : 'See what it’s eyeing'}</span>
            </motion.button>
          ) : (
            <motion.button
              type="button"
              onClick={onDeploy}
              disabled={deployDisabled}
              whileTap={deployDisabled ? undefined : { scale: 0.985 }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: 12, borderRadius: 12, border: 'none', cursor: deployDisabled ? 'default' : 'pointer', fontFamily: 'inherit',
                background: accent, color: ink, fontWeight: 700, fontSize: 13.5, opacity: deployDisabled ? 0.55 : 1,
              }}
            >
              <Zap size={16} color={ink} fill={ink} />
              <span>{deploying ? 'Deploying…' : isLive ? 'Battle in progress' : 'Deploy on this read'}</span>
            </motion.button>
          )}
          {/* Voice Layer deferred — coming-soon entry point, no-op tap */}
          <button
            type="button"
            aria-label="Talk it over — coming soon"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '12px 15px', borderRadius: 12, cursor: 'default', fontFamily: 'inherit',
              background: 'transparent', border: `1px solid ${CMD.hair2}`, color: CMD.ink2, fontWeight: 600, fontSize: 13.5,
            }}
          >
            <MessageCircle size={16} color={CMD.ink3} />
            <span>Talk it over</span>
            <Mono style={{
              fontSize: 8.5, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, color: CMD.ink3,
              background: alpha('#FFFFFF', 0.05), border: `1px solid ${CMD.hair}`, padding: '2px 5px', borderRadius: 5,
            }}>Soon</Mono>
          </button>
        </div>
        {boardEnabled && (
          <button
            type="button"
            onClick={onDeploy}
            disabled={deployDisabled}
            style={{
              display: 'block', margin: '9px auto 0', padding: '4px 8px', background: 'transparent', border: 'none',
              cursor: deployDisabled ? 'default' : 'pointer', fontFamily: 'inherit', color: CMD.ink3,
              fontSize: 12, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3, opacity: deployDisabled ? 0.5 : 1,
            }}
          >
            {deploying ? 'Deploying…' : 'Deploy without previewing'}
          </button>
        )}
      </div>
    </div>
  );
}
