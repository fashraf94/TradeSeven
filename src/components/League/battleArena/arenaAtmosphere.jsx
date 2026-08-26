// src/components/League/battleArena/arenaAtmosphere.jsx
//
// The arena's ambient backdrop: gradient + two auroras + a seeded starfield +
// a floor vignette. No glyphs, no text, no data — texture that recedes.
//
// E1 (Amendment E): the fuse board's scrolling env tape is CUT and this takes
// its place. R14 ruled the tape stays synthetic rather than wired to real
// quotes — right about data; the separate question of whether a text tape earns
// its space was answered by looking at it, and the answer was no. In `reload`
// it was the only thing in an otherwise empty plot, pulling the eye to the
// least meaningful element exactly when the board has least to say.
//
// F4 — this is a genuine EXTRACTION, not a copy. It began as a duplicate of
// ClimbArena's module-private `ClimbAtmosphere` because the arc held that file
// untouched; F4 amended the constraint to permit behaviour-preserving
// extractions covered by existing tests, so the twin was deleted and ClimbArena
// now imports this module. ONE copy, two consumers.
//
// The starfield is a SEEDED LCG (seed 7), not Math.random — deterministic
// across renders and R13-clean.

import React from 'react';
import { LTOKENS, alpha } from '../leagueTokens';
import { ST_GOOD } from './arenaTheme';

export function ArenaAtmosphere({ tone }) {
  const stars = React.useMemo(() => {
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    return Array.from({ length: 46 }, () => ({ x: rnd() * 100, y: rnd() * 100, r: 0.5 + rnd() * 1.4, d: 2 + rnd() * 4, delay: rnd() * 4 }));
  }, []);
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 18, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${alpha('#14304f', 0.55)} 0%, ${alpha('#0e2236', 0.4)} 34%, ${LTOKENS.bg} 78%)` }} />
      <div className="bv2-aurora1" style={{ position: 'absolute', top: '-12%', left: '8%', width: '60%', height: '70%', borderRadius: '50%',
        background: `radial-gradient(circle, ${alpha(tone, 0.16)}, transparent 64%)`, filter: 'blur(26px)' }} />
      <div className="bv2-aurora2" style={{ position: 'absolute', top: '-6%', right: '4%', width: '52%', height: '64%', borderRadius: '50%',
        background: `radial-gradient(circle, ${alpha(ST_GOOD, 0.1)}, transparent 66%)`, filter: 'blur(30px)' }} />
      <div className="bv2-particles" style={{ position: 'absolute', inset: '-30px 0' }}>
        {stars.map((st, i) => (
          <span key={i} className="bv2-twinkle" style={{ position: 'absolute', left: `${st.x}%`, top: `${st.y}%`, width: st.r * 2, height: st.r * 2,
            borderRadius: '50%', background: i % 7 === 0 ? alpha(tone, 0.9) : alpha('#CDE9F2', 0.8), boxShadow: `0 0 ${st.r * 3}px ${alpha('#CDE9F2', 0.5)}`,
            animationDelay: `${st.delay}s`, animationDuration: `${st.d}s` }} />
        ))}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '34%', background: `linear-gradient(180deg, transparent, ${alpha('#0a1722', 0.5)})` }} />
    </div>
  );
}

export default ArenaAtmosphere;
