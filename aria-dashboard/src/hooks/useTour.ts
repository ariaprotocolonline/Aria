import { useState, useEffect, useCallback, useRef } from 'react';

export interface TourStep {
  selector?: string;
  heading: string;
  body: string;
}

function getElementCenter(selector: string): { x: number; y: number } | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

export const useTour = (steps: TourStep[], storageKey: string) => {
  const [isActive,         setIsActive]        = useState(false);
  const [showWelcome,      setShowWelcome]      = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [cursorPos,        setCursorPos]        = useState({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
  const [hasArrived,       setHasArrived]       = useState(false);
  const [tooltipVisible,   setTooltipVisible]   = useState(false);

  const highlightedEl = useRef<Element | null>(null);
  const timers        = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => () => {
    clearTimers();
    highlightedEl.current?.classList.remove('aria-tour-highlight');
  }, []);

  // Show welcome on first visit
  useEffect(() => {
    if (!localStorage.getItem(storageKey)) {
      const t = setTimeout(() => setShowWelcome(true), 900);
      return () => clearTimeout(t);
    }
  }, [storageKey]);

  // Move cursor to current step's target whenever step or active state changes
  useEffect(() => {
    if (!isActive) return;

    clearTimers();
    setHasArrived(false);
    setTooltipVisible(false);

    // Remove previous highlight
    highlightedEl.current?.classList.remove('aria-tour-highlight');
    highlightedEl.current = null;

    const step = steps[currentStepIndex];
    if (!step) return;

    const hasSel = !!step.selector && step.selector !== 'body';

    if (hasSel) {
      const el = document.querySelector(step.selector!);
      if (el) {
        highlightedEl.current = el;
        el.classList.add('aria-tour-highlight');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    // After scroll settles, read final position and move cursor
    const t1 = setTimeout(() => {
      if (hasSel) {
        const pos = getElementCenter(step.selector!);
        if (pos) setCursorPos(pos);
      } else {
        setCursorPos({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
      }
    }, hasSel ? 450 : 0);
    timers.current.push(t1);

    // Cursor transition is 700ms — after it lands, pulse + show tooltip
    const t2 = setTimeout(() => setHasArrived(true),     hasSel ? 1200 : 400);
    const t3 = setTimeout(() => setTooltipVisible(true), hasSel ? 1350 : 550);
    timers.current.push(t2, t3);

  }, [isActive, currentStepIndex, steps]); // eslint-disable-line react-hooks/exhaustive-deps

  const startTour = useCallback(() => {
    setShowWelcome(false);
    setCurrentStepIndex(0);
    setCursorPos({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
    setHasArrived(false);
    setTooltipVisible(false);
    setIsActive(true);
  }, []);

  const skip = useCallback(() => {
    clearTimers();
    localStorage.setItem(storageKey, 'true');
    highlightedEl.current?.classList.remove('aria-tour-highlight');
    highlightedEl.current = null;
    setShowWelcome(false);
    setIsActive(false);
    setTooltipVisible(false);
    setHasArrived(false);
  }, [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = useCallback(() => {
    setTooltipVisible(false);
    setCurrentStepIndex(i => {
      if (i < steps.length - 1) return i + 1;
      // Last step finished
      clearTimers();
      localStorage.setItem(storageKey, 'true');
      highlightedEl.current?.classList.remove('aria-tour-highlight');
      highlightedEl.current = null;
      setIsActive(false);
      return i;
    });
  }, [steps.length, storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = useCallback(() => {
    setTooltipVisible(false);
    setCurrentStepIndex(i => (i > 0 ? i - 1 : i));
  }, []);

  const restart = useCallback(() => {
    localStorage.removeItem(storageKey);
    setCurrentStepIndex(0);
    setCursorPos({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
    setHasArrived(false);
    setTooltipVisible(false);
    setIsActive(true);
  }, [storageKey]);

  const showWelcomeModal = useCallback(() => {
    clearTimers();
    localStorage.removeItem(storageKey);
    highlightedEl.current?.classList.remove('aria-tour-highlight');
    highlightedEl.current = null;
    setIsActive(false);
    setCurrentStepIndex(0);
    setHasArrived(false);
    setTooltipVisible(false);
    setShowWelcome(true);
  }, [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isActive, showWelcome, currentStepIndex,
    totalSteps:    steps.length,
    currentStep:   steps[currentStepIndex] ?? steps[0]!,
    cursorPos, hasArrived, tooltipVisible,
    startTour, skip, next, back, restart, showWelcomeModal,
  };
};
