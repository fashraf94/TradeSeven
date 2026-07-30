import React from 'react';
// Delight Layer Task 1 Phase 2 pilot: the --ft-* substrate (src/theme/tokens.css).
// NOTE the deliberate asymmetry below — the particle colors and the gradient-mesh
// rgba() stops migrate, but the SVG stroke="" / fill="" presentation attributes do
// NOT: var() is not reliably substituted in presentation attributes, and a failure
// there would silently drop the price lines. Same reasoning as the Framer Motion
// rule. See docs/audits/20260729_DELIGHT_THEMING_PHASE2_PREAMBLE_HAZARD_SCAN.md §2 H8.
import { cssVar } from '../theme/cssTokens';

const DesktopBackground = ({ isDesktop }) => {
  if (!isDesktop) return null;

  // Generate stable particle positions
  const particles = React.useMemo(() => {
    return [...Array(15)].map((_, i) => ({
      id: i,
      left: `${(i * 7 + 5) % 100}%`,
      top: `${(i * 11 + 10) % 100}%`,
      // #00ff88 matches no locked token, so it stays a literal (spec §5 Phase 2).
      color: i % 3 === 0 ? cssVar('cyan') : i % 3 === 1 ? '#00ff88' : cssVar('purple'),
      duration: 12 + (i % 5) * 2,
      delay: (i % 4) * 1.5,
    }));
  }, []);

  return (
    <>
      {/* CSS Animations */}
      <style>{`
        @keyframes gradientPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes bullGlow {
          0%, 100% { opacity: 0.05; filter: drop-shadow(0 0 20px rgba(0, 255, 136, 0.2)); }
          50% { opacity: 0.08; filter: drop-shadow(0 0 40px rgba(0, 255, 136, 0.4)); }
        }
        @keyframes bearGlow {
          0%, 100% { opacity: 0.05; filter: drop-shadow(0 0 20px rgba(255, 71, 87, 0.2)); }
          50% { opacity: 0.08; filter: drop-shadow(0 0 40px rgba(255, 71, 87, 0.4)); }
        }
        @keyframes floatParticle {
          0%, 100% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-15px) translateX(8px); }
          50% { transform: translateY(-8px) translateX(-8px); }
          75% { transform: translateY(-20px) translateX(4px); }
        }
        @keyframes priceDraw {
          0% { stroke-dashoffset: 1000; }
          100% { stroke-dashoffset: 0; }
        }
      `}</style>

      {/* Background Container */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        {/* Gradient Mesh Base */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(ellipse at 15% 20%, rgba(var(--ft-cyan-rgb), 0.07) 0%, transparent 45%),
            radial-gradient(ellipse at 85% 80%, rgba(var(--ft-purple-rgb), 0.07) 0%, transparent 45%),
            radial-gradient(ellipse at 15% 80%, rgba(0, 255, 136, 0.04) 0%, transparent 40%),
            radial-gradient(ellipse at 85% 20%, rgba(255, 71, 87, 0.04) 0%, transparent 40%)
          `,
          animation: 'gradientPulse 10s ease-in-out infinite',
        }} />

        {/* Animated Price Lines - Left Side */}
        <svg
          style={{
            position: 'absolute',
            left: 0,
            top: '15%',
            width: '25%',
            height: '50%',
            opacity: 0.08,
          }}
          viewBox="0 0 400 300"
          preserveAspectRatio="none"
        >
          <path
            d="M0 150 Q50 120 100 140 T200 100 T300 130 T400 80"
            stroke="#00d9ff"
            strokeWidth="2"
            fill="none"
            strokeDasharray="1000"
            style={{ animation: 'priceDraw 20s ease-in-out infinite' }}
          />
          <path
            d="M0 180 Q50 200 100 170 T200 190 T300 150 T400 170"
            stroke="#00ff88"
            strokeWidth="2"
            fill="none"
            strokeDasharray="1000"
            style={{ animation: 'priceDraw 25s ease-in-out infinite', animationDelay: '2s' }}
          />
          <path
            d="M0 220 Q50 180 100 210 T200 180 T300 220 T400 190"
            stroke="#ff4757"
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="1000"
            style={{ animation: 'priceDraw 18s ease-in-out infinite', animationDelay: '4s' }}
          />
        </svg>

        {/* Animated Price Lines - Right Side */}
        <svg
          style={{
            position: 'absolute',
            right: 0,
            top: '25%',
            width: '25%',
            height: '45%',
            opacity: 0.08,
            transform: 'scaleX(-1)',
          }}
          viewBox="0 0 400 300"
          preserveAspectRatio="none"
        >
          <path
            d="M0 150 Q50 100 100 130 T200 90 T300 120 T400 70"
            stroke="#00d9ff"
            strokeWidth="2"
            fill="none"
            strokeDasharray="1000"
            style={{ animation: 'priceDraw 22s ease-in-out infinite', animationDelay: '1s' }}
          />
          <path
            d="M0 180 Q50 160 100 190 T200 150 T300 180 T400 140"
            stroke="#8b5cf6"
            strokeWidth="2"
            fill="none"
            strokeDasharray="1000"
            style={{ animation: 'priceDraw 28s ease-in-out infinite', animationDelay: '3s' }}
          />
        </svg>

        {/* Bull Silhouette - Left Side */}
        <div style={{
          position: 'absolute',
          left: '-3%',
          bottom: '8%',
          width: '250px',
          height: '250px',
          animation: 'bullGlow 5s ease-in-out infinite',
        }}>
          <svg viewBox="0 0 100 100" fill="#00ff88">
            <path d="M20 80 L20 50 Q20 30 35 25 L35 15 L40 25 Q50 20 60 25 L60 15 L65 25 Q80 30 80 50 L80 80 Q70 85 50 85 Q30 85 20 80 Z" />
            <ellipse cx="35" cy="45" rx="5" ry="8" fill="#059669" />
            <ellipse cx="65" cy="45" rx="5" ry="8" fill="#059669" />
            <path d="M30 15 Q25 5 15 10" stroke="#00ff88" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M70 15 Q75 5 85 10" stroke="#00ff88" strokeWidth="4" fill="none" strokeLinecap="round" />
          </svg>
        </div>

        {/* Bear Silhouette - Right Side */}
        <div style={{
          position: 'absolute',
          right: '-3%',
          bottom: '8%',
          width: '230px',
          height: '230px',
          animation: 'bearGlow 5s ease-in-out infinite',
          animationDelay: '2.5s',
        }}>
          <svg viewBox="0 0 100 100" fill="#ff4757">
            <ellipse cx="50" cy="55" rx="28" ry="32" />
            <circle cx="30" cy="28" r="11" />
            <circle cx="70" cy="28" r="11" />
            <circle cx="30" cy="28" r="5" fill="#dc2626" />
            <circle cx="70" cy="28" r="5" fill="#dc2626" />
            <ellipse cx="50" cy="52" rx="16" ry="18" fill="#f87171" />
            <ellipse cx="50" cy="47" rx="7" ry="5" fill="#1a1a2e" />
          </svg>
        </div>

        {/* Floating Particles */}
        {particles.map((p) => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              width: '3px',
              height: '3px',
              borderRadius: '50%',
              background: p.color,
              opacity: 0.15,
              left: p.left,
              top: p.top,
              animation: `floatParticle ${p.duration}s ease-in-out infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>
    </>
  );
};

export default DesktopBackground;
