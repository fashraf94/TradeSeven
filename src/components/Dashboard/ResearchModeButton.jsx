import React from 'react';
import { motion } from 'framer-motion';

export default function ResearchModeButton({ setShowResearchMode }) {
  return (
    <motion.div
      id="tour-research-mode"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
      onClick={() => setShowResearchMode(true)}
      style={{
        margin: '20px 16px',
        padding: '20px 24px',
        borderRadius: '16px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        background: `linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 50%, rgba(15, 23, 42, 0.95) 100%)`,
        border: '1px solid transparent',
        backgroundClip: 'padding-box',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 0 30px rgba(0, 217, 255, 0.3), 0 0 60px rgba(139, 92, 246, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* CSS Animations for Research Button */}
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes scanLine {
          0% { left: -100%; }
          50% { left: 100%; }
          100% { left: 100%; }
        }
        @keyframes researchPulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.2); }
        }
      `}</style>

      {/* Animated gradient border overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: '16px',
        padding: '1px',
        background: 'linear-gradient(90deg, #00d9ff, #8b5cf6, #00d9ff)',
        backgroundSize: '200% 100%',
        animation: 'gradientShift 3s ease infinite',
        mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        maskComposite: 'exclude',
        WebkitMaskComposite: 'xor',
        pointerEvents: 'none',
      }} />

      {/* Scanning line effect */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '-100%',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(90deg, transparent, rgba(0, 217, 255, 0.1), transparent)',
        animation: 'scanLine 3s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {/* Content */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Left side - Icon and text */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Futuristic icon */}
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(0, 217, 255, 0.3)',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#researchIconGradient)" strokeWidth="2">
              <defs>
                <linearGradient id="researchIconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00d9ff" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
              <path d="M8 8h.01M11 8h.01M14 8h.01M8 11h.01M11 11h.01M14 11h.01M8 14h.01M11 14h.01M14 14h.01" strokeWidth="1.5" />
            </svg>
          </div>

          {/* Text content */}
          <div>
            <div style={{
              fontSize: '11px',
              fontWeight: '600',
              letterSpacing: '2px',
              color: '#00d9ff',
              marginBottom: '4px',
              textTransform: 'uppercase',
            }}>
              AI-Powered
            </div>
            <div style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#ffffff',
              letterSpacing: '0.5px',
            }}>
              Research Mode
            </div>
            <div style={{
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.6)',
              marginTop: '2px',
            }}>
              Advanced market analysis & insights
            </div>
          </div>
        </div>

        {/* Right side - Arrow */}
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.3s ease',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00d9ff" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {/* Particle dots */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '60px',
        width: '4px',
        height: '4px',
        borderRadius: '50%',
        background: '#00d9ff',
        opacity: 0.5,
        animation: 'researchPulse 2s ease infinite',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '15px',
        right: '80px',
        width: '3px',
        height: '3px',
        borderRadius: '50%',
        background: '#8b5cf6',
        opacity: 0.4,
        animation: 'researchPulse 2.5s ease infinite 0.5s',
      }} />
    </motion.div>
  );
}
