// src/components/Forge/ManagementPanel.jsx
// Slide-over (mobile) / modal (desktop) wrapper for My Rules and My Bundles views.

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, X } from 'lucide-react';

export default function ManagementPanel({ title, onClose, children }) {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const h = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // Lock body scroll
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = orig; };
  }, []);

  if (isDesktop) {
    // Desktop: centered modal
    return (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            zIndex: 60,
          }}
        />
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '80%', maxWidth: 800, maxHeight: '85vh',
            background: '#0D0E12', borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.08)',
            zIndex: 61, display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', margin: 0 }}>
              {title}
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: '#4a5568',
                cursor: 'pointer', padding: 4, display: 'flex',
              }}
            >
              <X size={18} />
            </button>
          </div>
          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px' }}>
            {children}
          </div>
        </motion.div>
      </>
    );
  }

  // Mobile: full-screen slide from right
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          zIndex: 60,
        }}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        style={{
          position: 'fixed', inset: 0, background: '#0D0E12',
          zIndex: 61, display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 16px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#8b949e',
              cursor: 'pointer', padding: 4, display: 'flex',
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', margin: 0 }}>
            {title}
          </h2>
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </div>
      </motion.div>
    </>
  );
}
