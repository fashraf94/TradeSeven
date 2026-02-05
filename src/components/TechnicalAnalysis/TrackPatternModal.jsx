// src/components/TechnicalAnalysis/TrackPatternModal.jsx

import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

const TrackPatternModal = ({ isOpen, onClose, pattern, onStartTracking }) => {
  const [thesis, setThesis] = useState('BULLISH_BOUNCE');
  const [duration, setDuration] = useState(7);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const thesisOptions = [
    { value: 'BULLISH_BOUNCE', label: 'Bullish Bounce', icon: '&#128200;', desc: 'Price bounces up from this level' },
    { value: 'BEARISH_BREAKDOWN', label: 'Bearish Breakdown', icon: '&#128201;', desc: 'Price breaks below this level' },
    { value: 'NEUTRAL_OBSERVATION', label: 'Just Observe', icon: '&#128065;&#65039;', desc: 'Track without directional thesis' },
  ];

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onStartTracking({
        ...pattern,
        thesis,
        trackingDuration: duration,
        userNotes: notes,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString(),
        status: 'WAITING',
      });
      onClose();
    } catch (err) {
      console.error('Failed to start tracking:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !pattern) return null;

  const modalContent = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '20px',
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          style={{
            width: '100%',
            maxWidth: '440px',
            maxHeight: '90vh',
            backgroundColor: '#0d1117',
            borderRadius: '16px',
            border: '1px solid rgba(0, 255, 255, 0.2)',
            overflow: 'auto',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>&#128300;</span>
            <h2 style={{ flex: 1, margin: 0, color: '#fff', fontSize: '18px' }}>Track This Pattern</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>&times;</button>
          </div>

          {/* Pattern Details */}
          <div style={{ padding: '20px 24px', backgroundColor: 'rgba(0,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#fff', fontWeight: '600' }}>
                {pattern.zoneType === 'SUPPORT' ? '&#128994;' : '&#128308;'} {pattern.zoneType} Zone
              </span>
              <span style={{ color: '#00ffff', fontSize: '12px', padding: '4px 8px', backgroundColor: 'rgba(0,255,255,0.1)', borderRadius: '4px' }}>
                {pattern.strength || 'STRONG'}
              </span>
            </div>
            <div style={{ color: '#fff' }}>
              <span style={{ fontWeight: '600', color: '#00ffff' }}>{pattern.ticker}</span>
              {' '}${pattern.priceLow?.toFixed(2)} - ${pattern.priceHigh?.toFixed(2)}
            </div>
          </div>

          {/* Thesis Selection */}
          <div style={{ padding: '16px 24px' }}>
            <h3 style={{ color: '#fff', fontSize: '13px', marginBottom: '12px' }}>Your Thesis</h3>
            {thesisOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setThesis(opt.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '12px',
                  marginBottom: '8px',
                  backgroundColor: thesis === opt.value ? 'rgba(0,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${thesis === opt.value ? 'rgba(0,255,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '20px' }} dangerouslySetInnerHTML={{ __html: opt.icon }} />
                <div style={{ flex: 1 }}>
                  <span style={{ color: '#fff', fontWeight: '500', display: 'block' }}>{opt.label}</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{opt.desc}</span>
                </div>
                {thesis === opt.value && <span style={{ color: '#00ffff' }}>&#10003;</span>}
              </button>
            ))}
          </div>

          {/* Duration */}
          <div style={{ padding: '0 24px 16px' }}>
            <h3 style={{ color: '#fff', fontSize: '13px', marginBottom: '12px' }}>Duration</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[3, 7, 14, 30].map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: duration === d ? 'rgba(0,255,255,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${duration === d ? 'rgba(0,255,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '8px',
                    color: duration === d ? '#00ffff' : 'rgba(255,255,255,0.6)',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div style={{ padding: '0 24px 20px' }}>
            <h3 style={{ color: '#fff', fontSize: '13px', marginBottom: '8px' }}>Notes (Optional)</h3>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Why are you tracking this pattern..."
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff',
                resize: 'none',
                fontSize: '14px',
              }}
              rows={3}
            />
          </div>

          {/* Submit */}
          <div style={{ padding: '0 24px 20px' }}>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: 'rgba(0,255,255,0.1)',
                border: '1px solid rgba(0,255,255,0.4)',
                borderRadius: '10px',
                color: '#00ffff',
                fontWeight: '600',
                cursor: 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? 'Starting...' : 'Start Tracking \u2192'}
            </button>
          </div>

          <p style={{ padding: '0 24px 20px', margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
            Pattern tracking is for educational purposes.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default TrackPatternModal;
