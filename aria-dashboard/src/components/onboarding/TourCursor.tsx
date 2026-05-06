import React, { useEffect, useState } from 'react';

interface TourCursorProps {
  x: number;
  y: number;
  hasArrived: boolean;
  actionTriggered?: boolean;
}

const TourCursor: React.FC<TourCursorProps> = ({ x, y, hasArrived, actionTriggered }) => {
  const [clickScale, setClickScale] = useState(1);

  useEffect(() => {
    if (hasArrived) {
      setClickScale(0.85);
      const t = setTimeout(() => setClickScale(1), 300);
      return () => clearTimeout(t);
    }
  }, [hasArrived, actionTriggered]);

  return (
    <>
      <div
        className="fixed z-[99999] pointer-events-none"
        style={{
          left: `${x}px`,
          top: `${y}px`,
          transform: `translate(-5px, -2px) scale(${clickScale})`,
          transition:
            'left 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.3s ease-out',
        }}
      >
        <div className={!hasArrived ? 'aria-tour-wiggle' : ''}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="white"
            stroke="#0F1110"
            strokeWidth="1.2"
            style={{ filter: 'drop-shadow(0 3px 8px #95A39570)' }}
          >
            <path d="M10 2a2 2 0 0 1 4 0v6a2 2 0 0 1 2-1.73A2 2 0 0 1 18 8v8a8 8 0 0 1-16 0V6a2 2 0 0 1 4 0v2a2 2 0 0 1 2-1.73A2 2 0 0 1 10 8V2z" />
          </svg>
        </div>

        <div
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(4px)',
            border: '1px solid #E5E7E6',
            borderRadius: '4px',
            padding: '3px 11px',
            marginTop: '5px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.10)',
            display: 'inline-block',
          }}
        >
          <span
            style={{
              fontFamily: '"Space Mono", monospace',
              fontSize: '13px',
              color: '#0F1110',
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            ARIA Guide
          </span>
        </div>
      </div>

      <style>{`
        @keyframes ariaWiggle {
          0%, 100% { transform: rotate(0deg); }
          25%       { transform: rotate(-10deg); }
          75%       { transform: rotate(10deg); }
        }
        .aria-tour-wiggle {
          animation: ariaWiggle 0.5s ease-in-out infinite;
        }
      `}</style>
    </>
  );
};

export default TourCursor;
