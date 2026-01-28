// /src/components/Dashboard/ClashCard/TugOfWarBar.jsx
// Tug-of-war progress bar showing relative performance between two players
// Cyan (you) vs grey (opponent) in PVP, purple (you) vs grey in training

import React from 'react';
import { motion } from 'framer-motion';

export default function TugOfWarBar({ myGain, theirGain, isWinning, isTraining = false, height = 5 }) {
  // Calculate bar ratio based on performance gap
  // Use absolute values to determine who has more bar
  const myAbs = Math.abs(myGain);
  const theirAbs = Math.abs(theirGain);
  const total = myAbs + theirAbs;

  // Avoid division by zero - show 50/50 when tied
  let myPercent = total > 0 ? (myAbs / total) * 100 : 50;

  // The WINNER gets more of the bar regardless of sign
  // If both have same sign, higher absolute value wins
  // If different signs, positive value wins
  if (isWinning) {
    myPercent = Math.max(myPercent, 50);
  } else {
    myPercent = Math.min(myPercent, 50);
  }

  // Clamp to reasonable bounds
  myPercent = Math.max(15, Math.min(85, myPercent));

  const accentColor = isTraining ? '#9333ea' : '#00d9ff';

  return (
    <div style={{
      width: '100%',
      height: `${height}px`,
      borderRadius: `${height}px`,
      overflow: 'hidden',
      display: 'flex',
      background: 'rgba(255, 255, 255, 0.08)',
    }}>
      {/* Your side */}
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${myPercent}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{
          height: '100%',
          borderRadius: `${height}px 0 0 ${height}px`,
          background: `linear-gradient(90deg, ${accentColor} 0%, ${accentColor}cc 100%)`,
          boxShadow: `0 0 8px ${accentColor}40`,
        }}
      />
      {/* Opponent side fills remaining space via background of parent */}
    </div>
  );
}
