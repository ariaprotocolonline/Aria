import { useState, useEffect, useCallback, useRef } from 'react';

export interface TourStep {
  selector: string;
  heading: string;
  body: string;
  action?: boolean;
}

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

export const useTour = (steps: TourStep[], storageKey: string) => {
  const [isActive, setIsActive] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [hasArrived, setHasArrived] = useState(false);

  const pollIntervalRef = useRef<number | null>(null);

  // Show the welcome modal automatically on first visit.
  // Delay slightly so the page finishes rendering before the modal appears.
  useEffect(() => {
    if (!localStorage.getItem(storageKey)) {
      const t = setTimeout(() => setShowWelcome(true), 1200);
      return () => clearTimeout(t);
    }
  }, [storageKey]);

  const findElement = useCallback((selector: string): Element | null => {
    if (selector === 'body') return document.body;

    if (selector.startsWith('text:')) {
      const searchText = selector.replace('text:', '').trim();
      const allElements = Array.from(document.querySelectorAll('*'));
      let bestMatch: Element | null = null;
      for (const el of allElements) {
        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
        if (el.textContent?.trim() === searchText) {
          if (!bestMatch || bestMatch.contains(el)) bestMatch = el;
        }
      }
      return bestMatch;
    }

    return document.querySelector(selector);
  }, []);

  const computeRect = useCallback(
    (step: TourStep): Rect | null => {
      const el = findElement(step.selector);
      if (!el) return null;

      if (step.selector === 'body') {
        return {
          top: window.innerHeight / 2 - 50,
          left: window.innerWidth / 2 - 50,
          width: 100,
          height: 100,
          cx: window.innerWidth / 2,
          cy: window.innerHeight / 2,
        };
      }

      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return null;

      return {
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
      };
    },
    [findElement],
  );

  const updateTargetPosition = useCallback(() => {
    if (!isActive || currentStepIndex >= steps.length) {
      setTargetRect(null);
      return false;
    }
    const rect = computeRect(steps[currentStepIndex]);
    if (rect) {
      setTargetRect(rect);
      return true;
    }
    setTargetRect(null);
    return false;
  }, [isActive, currentStepIndex, steps, computeRect]);

  useEffect(() => {
    if (!isActive) return;

    setHasArrived(false);
    updateTargetPosition();

    // Scroll the page so the target element is centred in the viewport.
    // We use window.scrollTo with an absolute document offset instead of
    // scrollIntoView so it works regardless of which element is the scroll
    // container, and so we can account for the sticky nav height (~72px).
    const NAV_OFFSET = 72;
    const step = steps[currentStepIndex];
    if (step && step.selector !== 'body') {
      const el = findElement(step.selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        const absoluteTop = rect.top + window.scrollY;
        const centredY = absoluteTop - window.innerHeight / 2 + rect.height / 2 - NAV_OFFSET;
        window.scrollTo({ top: Math.max(0, centredY), behavior: 'smooth' });
      }
    }

    // Re-measure after scroll animation settles (~600 ms covers most distances)
    const postScrollTimer = setTimeout(() => updateTargetPosition(), 600);

    let failures = 0;
    pollIntervalRef.current = window.setInterval(() => {
      const found = updateTargetPosition();
      if (!found) {
        failures++;
        if (failures >= 5) {
          failures = 0;
          // Fall back to viewport center rather than silently freezing
          setTargetRect({
            top: window.innerHeight / 2 - 50,
            left: window.innerWidth / 2 - 50,
            width: 100,
            height: 100,
            cx: window.innerWidth / 2,
            cy: window.innerHeight / 2,
          });
        }
      } else {
        failures = 0;
      }
    }, 500);

    const onResizeOrScroll = () => updateTargetPosition();
    window.addEventListener('resize', onResizeOrScroll);
    window.addEventListener('scroll', onResizeOrScroll, true);

    const arriveTimer = setTimeout(() => setHasArrived(true), 1100);

    return () => {
      if (pollIntervalRef.current !== null) clearInterval(pollIntervalRef.current);
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll, true);
      clearTimeout(arriveTimer);
      clearTimeout(postScrollTimer);
    };
  }, [isActive, currentStepIndex, steps, findElement, updateTargetPosition]);

  const startTour = () => {
    setShowWelcome(false);
    setCurrentStepIndex(0);
    setIsActive(true);
  };

  const skip = useCallback(() => {
    localStorage.setItem(storageKey, 'true');
    setShowWelcome(false);
    setIsActive(false);
    setTargetRect(null);
  }, [storageKey]);

  const next = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((i) => i + 1);
    } else {
      skip();
    }
  };

  const back = () => {
    if (currentStepIndex > 0) setCurrentStepIndex((i) => i - 1);
  };

  const restart = useCallback(() => {
    localStorage.removeItem(storageKey);
    setCurrentStepIndex(0);
    setIsActive(true);
  }, [storageKey]);

  return {
    isActive,
    showWelcome,
    currentStepIndex,
    totalSteps: steps.length,
    currentStep: steps[currentStepIndex] ?? steps[0],
    targetRect,
    hasArrived,
    startTour,
    skip,
    next,
    back,
    restart,
  };
};
