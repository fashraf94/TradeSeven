// Classic Mode silhouette - Warrior with sword raised

export default function WarriorSilhouette({ color = '#00d9ff' }) {
  return (
    <div style={{ position: 'relative', width: '80px', height: '120px' }}>
      {/* Body - trapezoidal torso */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '40px',
        height: '60px',
        background: color,
        clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)',
        filter: `drop-shadow(0 0 20px ${color})`,
        opacity: 0.9,
      }} />
      {/* Head */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        background: color,
        filter: `drop-shadow(0 0 15px ${color})`,
        opacity: 0.9,
      }} />
      {/* Sword */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        width: '4px',
        height: '50px',
        background: color,
        transform: 'rotate(-30deg)',
        borderRadius: '2px',
        filter: `drop-shadow(0 0 10px ${color})`,
        opacity: 0.9,
      }} />
      {/* Sword crossguard */}
      <div style={{
        position: 'absolute',
        top: '48px',
        right: '4px',
        width: '18px',
        height: '3px',
        background: color,
        transform: 'rotate(-30deg)',
        borderRadius: '1px',
        filter: `drop-shadow(0 0 8px ${color})`,
        opacity: 0.85,
      }} />
      {/* Shield arm */}
      <div style={{
        position: 'absolute',
        top: '50px',
        left: '8px',
        width: '20px',
        height: '24px',
        background: color,
        borderRadius: '4px 4px 8px 8px',
        filter: `drop-shadow(0 0 12px ${color})`,
        opacity: 0.7,
      }} />
    </div>
  );
}
