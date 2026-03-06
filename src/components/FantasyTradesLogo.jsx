import React from 'react';

// FantasyTrades Bull & Bear Logo Component
const FantasyTradesLogo = ({ size = 'large' }) => {
  const dimensions = {
    large: { width: 450, height: 350 },
    medium: { width: 225, height: 175 },
    small: { width: 90, height: 70 }
  };

  const dim = dimensions[size] || dimensions.large;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 450 350"
      width={dim.width}
      height={dim.height}
      style={{ maxWidth: '100%', height: 'auto' }}
    >
      <defs>
        <filter id="greenGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        <filter id="redGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        <filter id="goldGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        <filter id="subtleGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        <linearGradient id="bullGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{stopColor: '#10b981'}}/>
          <stop offset="100%" style={{stopColor: '#059669'}}/>
        </linearGradient>

        <linearGradient id="bearGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{stopColor: '#ef4444'}}/>
          <stop offset="100%" style={{stopColor: '#dc2626'}}/>
        </linearGradient>

        <linearGradient id="honeyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{stopColor: '#fbbf24'}}/>
          <stop offset="100%" style={{stopColor: '#d97706'}}/>
        </linearGradient>

        <linearGradient id="potGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{stopColor: '#78350f'}}/>
          <stop offset="100%" style={{stopColor: '#451a03'}}/>
        </linearGradient>

        <linearGradient id="hornGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{stopColor: '#fafaf9'}}/>
          <stop offset="70%" style={{stopColor: '#e7e5e4'}}/>
          <stop offset="100%" style={{stopColor: '#a8a29e'}}/>
        </linearGradient>

        <linearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style={{stopColor: '#FF8C00'}}/>
          <stop offset="100%" style={{stopColor: '#468CFF'}}/>
        </linearGradient>
      </defs>

      <rect width="450" height="350" fill="transparent"/>

      <g transform="translate(200, 140)">

        {/* HONEY POT */}
        <g transform="translate(30, 40)">
          <ellipse cx="0" cy="50" rx="45" ry="15" fill="#451a03"/>
          <path d="M-45 0 Q-50 25 -45 50 Q-25 60 0 60 Q25 60 45 50 Q50 25 45 0 Z"
                fill="url(#potGrad)" stroke="#78350f" strokeWidth="2"/>
          <ellipse cx="0" cy="0" rx="45" ry="12" fill="#92400e" stroke="#78350f" strokeWidth="2"/>
          <ellipse cx="0" cy="2" rx="38" ry="8" fill="url(#honeyGrad)"/>
          {/* HONEY DRIP REMOVED */}
          <rect x="-32" y="18" width="64" height="28" rx="3" fill="#fef3c7" stroke="#d97706" strokeWidth="1"/>
          <text x="0" y="28" textAnchor="middle" fontFamily="'Segoe UI', system-ui, sans-serif"
                fontSize="7" fontWeight="600" fill="#78350f">FROM</text>
          <text x="0" y="38" textAnchor="middle" fontFamily="'Segoe UI', system-ui, sans-serif"
                fontSize="8" fontWeight="700" fill="#dc2626">BEAR MARKET</text>
          <g transform="translate(-22, 30) scale(0.4)">
            <circle cx="0" cy="0" r="6" fill="#dc2626" opacity="0.4"/>
            <circle cx="-5" cy="-8" r="3" fill="#dc2626" opacity="0.4"/>
            <circle cx="5" cy="-8" r="3" fill="#dc2626" opacity="0.4"/>
            <circle cx="-8" cy="-3" r="2.5" fill="#dc2626" opacity="0.4"/>
            <circle cx="8" cy="-3" r="2.5" fill="#dc2626" opacity="0.4"/>
          </g>
        </g>

        {/* ANGRY BEAR */}
        <g transform="translate(120, 30)" filter="url(#redGlow)">
          <ellipse cx="0" cy="50" rx="35" ry="40" fill="url(#bearGrad)"/>
          <ellipse cx="0" cy="55" rx="22" ry="25" fill="#f87171"/>
          <g transform="translate(-30, 25) rotate(-30)">
            <ellipse cx="0" cy="0" rx="12" ry="22" fill="url(#bearGrad)"/>
            <ellipse cx="-5" cy="22" rx="12" ry="10" fill="#dc2626"/>
            <ellipse cx="-5" cy="24" rx="6" ry="4" fill="#b91c1c"/>
          </g>
          <g transform="translate(28, 35)">
            <ellipse cx="0" cy="0" rx="12" ry="20" fill="url(#bearGrad)"/>
            <ellipse cx="2" cy="20" rx="10" ry="8" fill="#dc2626"/>
          </g>
          <ellipse cx="-15" cy="90" rx="14" ry="8" fill="#dc2626"/>
          <ellipse cx="15" cy="90" rx="14" ry="8" fill="#dc2626"/>
          <ellipse cx="0" cy="-10" rx="38" ry="32" fill="url(#bearGrad)"/>
          <circle cx="-28" cy="-32" r="12" fill="url(#bearGrad)"/>
          <circle cx="-28" cy="-32" r="6" fill="#dc2626"/>
          <circle cx="28" cy="-32" r="12" fill="url(#bearGrad)"/>
          <circle cx="28" cy="-32" r="6" fill="#dc2626"/>
          <g>
            <ellipse cx="-12" cy="-12" rx="10" ry="8" fill="#ffffff"/>
            <ellipse cx="-10" cy="-11" rx="5" ry="6" fill="#1a1a2e"/>
            <circle cx="-8" cy="-13" r="2" fill="#ffffff"/>
            <ellipse cx="12" cy="-12" rx="10" ry="8" fill="#ffffff"/>
            <ellipse cx="14" cy="-11" rx="5" ry="6" fill="#1a1a2e"/>
            <circle cx="16" cy="-13" r="2" fill="#ffffff"/>
          </g>
          <path d="M-22 -22 L-5 -18" stroke="#b91c1c" strokeWidth="4" fill="none" strokeLinecap="round"/>
          <path d="M22 -22 L5 -18" stroke="#b91c1c" strokeWidth="4" fill="none" strokeLinecap="round"/>
          <ellipse cx="0" cy="8" rx="16" ry="12" fill="#f87171"/>
          <ellipse cx="0" cy="5" rx="7" ry="5" fill="#1a1a2e"/>
          <path d="M-10 18 Q0 12 10 18" stroke="#b91c1c" strokeWidth="3" fill="none" strokeLinecap="round"/>
          <g transform="translate(30, -35)" fill="#ef4444">
            <path d="M0 -8 L2 0 L8 -2 L2 2 L4 8 L0 3 L-4 8 L-2 2 L-8 -2 L-2 0 Z" transform="scale(0.6)"/>
          </g>
        </g>

        {/* BULL eating from pot */}
        <g filter="url(#greenGlow)">
          <ellipse cx="-60" cy="60" rx="50" ry="40" fill="url(#bullGrad)"/>
          <path d="M-30 30 Q-10 20 10 35 L5 60 L-25 70 Z" fill="url(#bullGrad)"/>
          <g transform="translate(-10, 20) rotate(25)">
            <ellipse cx="0" cy="0" rx="35" ry="28" fill="url(#bullGrad)"/>
            <path d="M-22 -14 C-28 -16 -34 -20 -38 -26 C-42 -32 -42 -38 -38 -42 L-32 -38 C-34 -34 -34 -30 -32 -26 C-28 -22 -24 -18 -20 -16 Z"
                  fill="url(#hornGrad)" stroke="#d6d3d1" strokeWidth="1"/>
            <path d="M22 -14 C28 -16 34 -20 38 -26 C42 -32 42 -38 38 -42 L32 -38 C34 -34 34 -30 32 -26 C28 -22 24 -18 20 -16 Z"
                  fill="url(#hornGrad)" stroke="#d6d3d1" strokeWidth="1"/>
            <ellipse cx="-28" cy="-3" rx="8" ry="12" fill="#059669"/>
            <ellipse cx="28" cy="-3" rx="8" ry="12" fill="#059669"/>
            <path d="M-15 -5 Q-10 -10 -5 -5" stroke="#0d1117" strokeWidth="3" fill="none" strokeLinecap="round"/>
            <path d="M5 -5 Q10 -10 15 -5" stroke="#0d1117" strokeWidth="3" fill="none" strokeLinecap="round"/>
            <ellipse cx="0" cy="15" rx="18" ry="12" fill="#059669"/>
            <ellipse cx="0" cy="12" rx="8" ry="5" fill="#047857"/>
            <circle cx="-3" cy="12" r="2" fill="#0d1117"/>
            <circle cx="3" cy="12" r="2" fill="#0d1117"/>
          </g>
          <g filter="url(#goldGlow)">
            <ellipse cx="8" cy="48" rx="12" ry="6" fill="#fbbf24" opacity="0.8"/>
            <circle cx="15" cy="42" r="4" fill="#fbbf24" opacity="0.6"/>
            <circle cx="0" cy="52" r="3" fill="#fbbf24" opacity="0.7"/>
          </g>
          <path d="M-100 50 Q-115 35 -105 25 Q-95 30 -100 45"
                stroke="url(#bullGrad)" strokeWidth="6" fill="none" strokeLinecap="round"/>
          <path d="M-105 25 Q-100 15 -95 20"
                stroke="#059669" strokeWidth="8" fill="none" strokeLinecap="round"/>
        </g>

        <g stroke="#fbbf24" strokeWidth="2" opacity="0.6">
          <line x1="-50" y1="-20" x2="-60" y2="-30"/>
          <line x1="-40" y1="-30" x2="-45" y2="-42"/>
        </g>

      </g>

      <text x="225" y="295" textAnchor="middle" fontFamily="'Segoe UI', system-ui, sans-serif" fontSize="28" fontWeight="700" letterSpacing="6" filter="url(#subtleGlow)">
        <tspan fill="url(#brandGradient)">FANTASY</tspan><tspan fill="url(#brandGradient)">TRADES</tspan>
      </text>

      <text x="225" y="323" textAnchor="middle" fontFamily="'Segoe UI', system-ui, sans-serif" fontSize="10" fontWeight="400" letterSpacing="3" fill="#8b949e">
        PORTFOLIO BATTLES
      </text>
    </svg>
  );
};

export default FantasyTradesLogo;
