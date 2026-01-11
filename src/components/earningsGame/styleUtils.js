// EarningsGame Shared Styles
import { designColors, fontMono } from './designConstants';

// ============================================
// CARD STYLES
// ============================================

export const cardBase = {
  backgroundColor: designColors.bgCard,
  borderRadius: '12px',
  border: `1px solid ${designColors.borderDefault}`,
};

export const cardWithPadding = {
  ...cardBase,
  padding: '14px',
};

// ============================================
// TEXT STYLES
// ============================================

export const sectionHeader = {
  fontSize: '12px',
  fontWeight: 'bold',
  color: designColors.textSecondary,
  letterSpacing: '0.5px',
  marginBottom: '12px',
};

export const labelMuted = {
  fontSize: '11px',
  fontWeight: 'bold',
  color: designColors.textMuted,
  letterSpacing: '1px',
};

export const monoNumber = {
  fontFamily: fontMono,
  fontWeight: 'bold',
};

// ============================================
// BUTTON STYLES
// ============================================

export const buttonPrimary = {
  padding: '16px',
  backgroundColor: designColors.cyan,
  color: designColors.bgPrimary,
  border: 'none',
  borderRadius: '10px',
  fontSize: '14px',
  fontWeight: 'bold',
  cursor: 'pointer',
};

export const buttonDisabled = {
  backgroundColor: designColors.bgCard,
  color: designColors.textMuted,
  cursor: 'not-allowed',
};

// ============================================
// LAYOUT STYLES
// ============================================

export const flexBetween = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

export const flexCenter = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const screenContainer = {
  backgroundColor: designColors.bgPrimary,
  minHeight: '100vh',
};

// ============================================
// FIXED BOTTOM CTA
// ============================================

export const fixedBottomContainer = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  padding: '16px',
  backgroundColor: designColors.bgPrimary,
  borderTop: `1px solid ${designColors.borderDefault}`,
};
