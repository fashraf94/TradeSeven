// Snake Draft silhouette - Coiled serpent

export default function SnakeSilhouette({ color = '#10b981' }) {
  return (
    <svg
      width="80"
      height="120"
      viewBox="0 0 80 120"
      fill="none"
      style={{ filter: `drop-shadow(0 0 16px ${color})` }}
    >
      {/* Snake body - S-curve */}
      <path
        d="M 20 100 C 20 80, 60 85, 60 70 C 60 55, 20 60, 20 45 C 20 30, 60 35, 60 20"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
      {/* Snake head */}
      <ellipse
        cx="60"
        cy="16"
        rx="10"
        ry="8"
        fill={color}
        opacity="0.9"
      />
      {/* Eye */}
      <circle
        cx="65"
        cy="14"
        r="2"
        fill="#0d1117"
      />
      {/* Tongue */}
      <path
        d="M 70 16 L 76 13 M 70 16 L 76 19"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.9"
      />
      {/* Tail */}
      <path
        d="M 20 100 C 15 108, 10 112, 14 116"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
    </svg>
  );
}
