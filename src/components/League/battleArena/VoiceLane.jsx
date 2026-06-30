// src/components/League/battleArena/VoiceLane.jsx
//
// League Battle View V2 — the agent's VOICE LANE: a live, one-way narration of
// what the agent is doing, newest first, with the active line typing itself in.
// Translated from the locked Claude Design (battle-kit VoiceLane / VoiceLine),
// re-skinned onto the shared League palette + glyph set.
//
// Line shape (from the engine / Phase-1 voice script):
//   { kind, text, t?, ticker?, q?, active?, _k }
// kind ∈ greeting | trade | anticipation | read | answer.

import React from 'react';
import { Mono, Eyebrow, Tag } from '../LeagueParts';
import { Icon, LIcon } from '../LeagueIcons';
import { LTOKENS, alpha } from '../leagueTokens';
import { Waveform } from './ArenaPrimitives';
import { prefersReducedMotion } from './arenaEngineCore';

// kind → the small lane glyph, resolved across the two icon sets.
function LaneGlyph({ kind, color, size = 12 }) {
  switch (kind) {
    case 'greeting': return <LIcon name="spark" size={size} color={color} stroke={2} />;
    case 'trade': return <LIcon name="bolt" size={size} color={color} stroke={2} />;
    case 'anticipation': return <Icon name="eye" size={size} color={color} stroke={2} />;
    case 'answer': return <Icon name="chat" size={size} color={color} stroke={2} />;
    case 'read':
    default: return <LIcon name="pulse" size={size} color={color} stroke={2} />;
  }
}

// reveals `text` char by char while `active`; snaps when reduced-motion.
function useTypewriter(text, active, speed = 18) {
  const [out, setOut] = React.useState(active ? '' : text);
  React.useEffect(() => {
    if (!active || prefersReducedMotion()) { setOut(text); return undefined; }
    setOut('');
    let i = 0;
    const id = setInterval(() => {
      i += 1; setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, active, speed]);
  return out;
}

function VoiceLine({ line, color, prominent, active }) {
  const typed = useTypewriter(line.text, !!active);
  const text = active ? typed : line.text;
  return (
    <div className={active && !prefersReducedMotion() ? 'bv2-linein' : ''} style={{ display: 'flex', gap: 11, opacity: prominent ? 1 : 0.5 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 3 }}>
        <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: prominent ? alpha(color, 0.14) : LTOKENS.surface, border: `1px solid ${prominent ? alpha(color, 0.4) : LTOKENS.hair}` }}>
          <LaneGlyph kind={line.kind} color={prominent ? color : LTOKENS.ink3} />
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
          <Mono style={{ fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: prominent ? color : LTOKENS.ink3 }}>
            {line.kind === 'answer' ? 'agent · reply' : line.kind}
          </Mono>
          {line.ticker && <Tag color={color}>{line.ticker}</Tag>}
          {line.t && <Mono style={{ fontSize: 9, color: LTOKENS.ink3, marginLeft: 'auto' }}>{line.t}</Mono>}
        </div>
        {line.q && <div style={{ fontSize: 11, color: LTOKENS.ink3, marginBottom: 4, fontStyle: 'italic' }}>You asked · {line.q}</div>}
        <div style={{ fontSize: prominent ? 15 : 12.5, color: prominent ? LTOKENS.ink : LTOKENS.ink2, lineHeight: 1.5, fontWeight: prominent ? 500 : 400 }}>
          &ldquo;{text}&rdquo;
          {active && text.length < line.text.length && (
            <span className="bv2-caret" style={{ display: 'inline-block', width: 2, height: '1em', background: color, marginLeft: 2, transform: 'translateY(2px)' }} />
          )}
        </div>
      </div>
    </div>
  );
}

export function VoiceLane({ lines, archName, color, live, max = 4, style }) {
  return (
    <div style={style}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {live ? <Waveform color={color} /> : <LIcon name="cpu" size={13} color={LTOKENS.ink3} stroke={2} />}
          <Eyebrow color={color}>{archName}&rsquo;s voice</Eyebrow>
        </div>
        <Mono style={{ fontSize: 8.5, color: LTOKENS.ink3, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{live ? 'Live · narration' : 'One-way'}</Mono>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {lines.slice(0, max).map((ln, i) => (
          <VoiceLine key={ln._k != null ? ln._k : i} line={ln} color={color} prominent={i === 0} active={i === 0 && live && ln.active} />
        ))}
      </div>
    </div>
  );
}
