// BaggerBombSetupScreen - Time selection before portfolio builder
// Matches Snake Draft's DraftSetupScreen pattern for consistent UX

import React, { useState } from 'react';
import { Clock, Timer, ChevronLeft } from 'lucide-react';
import { HOLO_COLORS } from '../constants/holoTheme';

// Time options for lobby expiration (matches Snake Draft)
const TIME_OPTIONS = [
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
  { label: '7 hours', value: 420 },
  { label: '10 hours', value: 600 },
];

export default function BaggerBombSetupScreen({
  onBack,
  onContinue,
}) {
  const [selectedTime, setSelectedTime] = useState(30); // Default 30 minutes

  // Calculate expiration time for preview
  const expirationTime = new Date(Date.now() + selectedTime * 60000);

  const handleContinue = () => {
    onContinue(selectedTime);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: HOLO_COLORS.bgDeep,
      padding: '0',
    }}>
      {/* Header */}
      <div style={{
        background: HOLO_COLORS.bgElevated,
        borderBottom: `2px solid ${HOLO_COLORS.borderSubtle}`,
        padding: '16px',
      }}>
        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: HOLO_COLORS.cyan,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            <ChevronLeft size={20} />
            Back
          </button>
          <h1 style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: HOLO_COLORS.textPrimary,
          }}>
            Create Battle
          </h1>
          <div style={{ width: '60px' }}></div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>💣</div>
          <h2 style={{
            fontSize: '26px',
            fontWeight: 'bold',
            color: HOLO_COLORS.textPrimary,
            marginBottom: '8px',
          }}>
            BaggerBomb Battle
          </h2>
          <p style={{ color: HOLO_COLORS.textSecondary, fontSize: '15px' }}>
            1v1 • Star, Core, Support picks
          </p>
        </div>

        {/* How It Works */}
        <div style={{
          background: HOLO_COLORS.bgElevated,
          border: `1px solid ${HOLO_COLORS.borderSubtle}`,
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
        }}>
          <h3 style={{
            color: HOLO_COLORS.textPrimary,
            fontSize: '14px',
            fontWeight: 'bold',
            marginBottom: '12px',
          }}>
            How It Works
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: `${HOLO_COLORS.cyan}20`,
                border: `1px solid ${HOLO_COLORS.cyan}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold',
                color: HOLO_COLORS.cyan,
              }}>1</div>
              <span style={{ color: HOLO_COLORS.textSecondary, fontSize: '13px' }}>
                Build your portfolio with Star, Core & Support picks
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: `${HOLO_COLORS.cyan}20`,
                border: `1px solid ${HOLO_COLORS.cyan}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold',
                color: HOLO_COLORS.cyan,
              }}>2</div>
              <span style={{ color: HOLO_COLORS.textSecondary, fontSize: '13px' }}>
                Share your lobby for an opponent to join
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: `${HOLO_COLORS.cyan}20`,
                border: `1px solid ${HOLO_COLORS.cyan}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold',
                color: HOLO_COLORS.cyan,
              }}>3</div>
              <span style={{ color: HOLO_COLORS.textSecondary, fontSize: '13px' }}>
                Battle starts at next market open!
              </span>
            </div>
          </div>
        </div>

        {/* Lobby Duration Selection */}
        <div style={{
          background: HOLO_COLORS.bgElevated,
          border: `1px solid ${HOLO_COLORS.borderSubtle}`,
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
        }}>
          <h3 style={{
            color: HOLO_COLORS.textPrimary,
            fontSize: '14px',
            fontWeight: 'bold',
            marginBottom: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <Clock size={18} color={HOLO_COLORS.textSecondary} />
            How long should your lobby stay open?
          </h3>
          <p style={{
            color: HOLO_COLORS.textSecondary,
            fontSize: '12px',
            marginBottom: '14px',
          }}>
            Opponents can join until this time. Lobby auto-cancels if no one joins.
          </p>

          {/* Time Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            marginBottom: '12px',
          }}>
            {TIME_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => setSelectedTime(option.value)}
                style={{
                  padding: '14px 8px',
                  background: selectedTime === option.value
                    ? 'rgba(20, 184, 166, 0.15)'
                    : HOLO_COLORS.bgElevated,
                  border: selectedTime === option.value
                    ? '2px solid #14b8a6'
                    : `2px solid ${HOLO_COLORS.borderSubtle}`,
                  borderRadius: '10px',
                  color: selectedTime === option.value ? '#14b8a6' : HOLO_COLORS.textSecondary,
                  fontSize: '13px',
                  fontWeight: selectedTime === option.value ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Preview */}
          <div style={{
            background: 'rgba(20, 184, 166, 0.1)',
            border: '1px solid rgba(20, 184, 166, 0.3)',
            borderRadius: '8px',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <Timer size={18} color="#14b8a6" />
            <span style={{ color: '#14b8a6', fontSize: '14px', fontWeight: '600' }}>
              Lobby expires at: {expirationTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          style={{
            width: '100%',
            padding: '16px',
            background: HOLO_COLORS.cyan,
            color: HOLO_COLORS.bgDeep,
            fontWeight: 'bold',
            fontSize: '16px',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            marginBottom: '12px',
            boxShadow: '0 4px 12px rgba(0, 255, 255, 0.3)',
          }}
        >
          BUILD YOUR PORTFOLIO
        </button>

        <p style={{
          textAlign: 'center',
          color: HOLO_COLORS.textSecondary,
          fontSize: '13px',
        }}>
          Next: Select your Star, Core & Support assets
        </p>
      </div>
    </div>
  );
}
