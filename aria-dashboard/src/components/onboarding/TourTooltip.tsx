import React from 'react';

interface TourTooltipProps {
  heading: string;
  body: string;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onFinish: () => void;
  onSkip: () => void;
  x: number;
  y: number;
  visible: boolean;
}

const ACCENT = '#95A395';
const MARGIN = 16;
const TOOLTIP_EST_HEIGHT = 230;

const TourTooltip: React.FC<TourTooltipProps> = ({
  heading,
  body,
  currentStep,
  totalSteps,
  onNext,
  onBack,
  onFinish,
  onSkip,
  x,
  y,
  visible,
}) => {
  if (!visible) return null;

  const isFirst = currentStep === 1;
  const isLast = currentStep === totalSteps;

  const sw = window.innerWidth;
  const sh = window.innerHeight;
  const isMobile = sw < 520;

  const tooltipWidth = isMobile ? sw - MARGIN * 2 : Math.min(280, sw - MARGIN * 2);

  let left: number;
  let top: number;
  let showTriangle = true;
  let triangleSide: 'left' | 'right' = 'left';

  if (isMobile) {
    left = MARGIN;
    top = sh - TOOLTIP_EST_HEIGHT - MARGIN - 20;
    showTriangle = false;
  } else {
    const spaceOnRight = sw - x - 28 - tooltipWidth - MARGIN;
    const onRight = spaceOnRight >= 0;
    triangleSide = onRight ? 'left' : 'right';

    const rawLeft = onRight ? x + 28 : x - tooltipWidth - 28;
    left = Math.max(MARGIN, Math.min(rawLeft, sw - tooltipWidth - MARGIN));

    const rawTop = y <= sh / 2 ? y + 20 : y - TOOLTIP_EST_HEIGHT - 20;
    top = Math.max(MARGIN, Math.min(rawTop, sh - TOOLTIP_EST_HEIGHT - MARGIN));
  }

  const triangleTop = y <= sh / 2 ? 24 : 'auto';
  const triangleBottom = y > sh / 2 ? 24 : 'auto';

  return (
    <>
      <div
        style={{
          position: 'fixed',
          zIndex: 99998,
          left: `${left}px`,
          top: `${top}px`,
          width: `${tooltipWidth}px`,
          background: 'var(--bg, #ffffff)',
          border: '1px solid var(--border, #E5E7E6)',
          borderRadius: '12px',
          padding: '18px 18px 14px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          animation: 'tooltipEnter 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
        }}
      >
        {/* Triangle pointer */}
        {showTriangle && triangleSide === 'left' && (
          <>
            <div style={{
              position: 'absolute',
              left: -9,
              top: triangleTop,
              bottom: triangleBottom,
              width: 0,
              height: 0,
              borderStyle: 'solid',
              borderWidth: '8px 9px 8px 0',
              borderColor: 'transparent var(--border, #E5E7E6) transparent transparent',
            }} />
            <div style={{
              position: 'absolute',
              left: -7,
              top: typeof triangleTop === 'number' ? triangleTop + 1 : 'auto',
              bottom: typeof triangleBottom === 'number' ? triangleBottom + 1 : 'auto',
              width: 0,
              height: 0,
              borderStyle: 'solid',
              borderWidth: '7px 8px 7px 0',
              borderColor: 'transparent var(--bg, #ffffff) transparent transparent',
            }} />
          </>
        )}
        {showTriangle && triangleSide === 'right' && (
          <>
            <div style={{
              position: 'absolute',
              right: -9,
              top: triangleTop,
              bottom: triangleBottom,
              width: 0,
              height: 0,
              borderStyle: 'solid',
              borderWidth: '8px 0 8px 9px',
              borderColor: 'transparent transparent transparent var(--border, #E5E7E6)',
            }} />
            <div style={{
              position: 'absolute',
              right: -7,
              top: typeof triangleTop === 'number' ? triangleTop + 1 : 'auto',
              bottom: typeof triangleBottom === 'number' ? triangleBottom + 1 : 'auto',
              width: 0,
              height: 0,
              borderStyle: 'solid',
              borderWidth: '7px 0 7px 8px',
              borderColor: 'transparent transparent transparent var(--bg, #ffffff)',
            }} />
          </>
        )}

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontFamily: '"Space Mono", monospace',
            fontSize: '10px',
            color: 'var(--text-secondary, #6B6F6C)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            {currentStep} / {totalSteps}
          </span>
          <button
            onClick={onSkip}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary, #6B6F6C)',
              fontSize: '16px',
              lineHeight: 1,
              padding: '0 2px',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Skip tour"
          >
            ×
          </button>
        </div>

        {/* Heading */}
        <h4 style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: '15px',
          fontWeight: 700,
          color: 'var(--text-primary, #0F1110)',
          margin: 0,
        }}>
          {heading}
        </h4>

        {/* Body */}
        <p style={{
          fontFamily: 'Arial, sans-serif',
          fontSize: '13px',
          color: 'var(--text-secondary, #6B6F6C)',
          lineHeight: 1.6,
          margin: 0,
        }}>
          {body}
        </p>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              style={{
                width: i === currentStep - 1 ? 16 : 6,
                height: 6,
                borderRadius: 3,
                background: i === currentStep - 1 ? ACCENT : 'var(--border, #E5E7E6)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* Buttons */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '8px',
          paddingTop: '6px',
          borderTop: '1px solid var(--border, #E5E7E6)',
        }}>
          {!isFirst && (
            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-secondary, #6B6F6C)',
                padding: '6px 10px',
                borderRadius: '4px',
              }}
            >
              Back
            </button>
          )}
          {isLast ? (
            <button
              onClick={onFinish}
              style={{
                background: ACCENT,
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                padding: '6px 14px',
                borderRadius: '4px',
              }}
            >
              Finish Tour
            </button>
          ) : (
            <button
              onClick={onNext}
              style={{
                background: ACCENT,
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                padding: '6px 14px',
                borderRadius: '4px',
              }}
            >
              Next →
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes tooltipEnter {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
};

export default TourTooltip;
