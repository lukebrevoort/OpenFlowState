import { useEffect, useMemo, useState } from 'react';
import type { ActivityStep } from '../lib/opencodeActivity';

interface ActivityCarouselProps {
  steps: ActivityStep[];
  isVisible: boolean;
}

const ROTATION_INTERVAL = 2200;

const ActivityCarousel = ({ steps, isVisible }: ActivityCarouselProps) => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!isVisible || steps.length <= 1) {
      setActiveIndex(0);
      return undefined;
    }

    const interval = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % steps.length);
    }, ROTATION_INTERVAL);

    return () => window.clearInterval(interval);
  }, [isVisible, steps.length]);

  useEffect(() => {
    if (activeIndex >= steps.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, steps.length]);

  const activeStep = steps[activeIndex];
  const dots = useMemo(() => Math.min(steps.length, 5), [steps.length]);

  if (!isVisible || !activeStep) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 transition-opacity duration-300 ease-in-out">
      <div className="min-w-[260px] max-w-[420px] rounded-2xl border border-border bg-card/95 px-6 py-4 text-center shadow-flowstate-lg backdrop-blur-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          FlowState
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground">
          {activeStep.title}
        </p>
        {activeStep.detail && (
          <p className="mt-1 text-xs text-muted-foreground">
            {activeStep.detail}
          </p>
        )}
        {steps.length > 1 && (
          <div className="mt-3 flex items-center justify-center gap-1">
            {Array.from({ length: dots }).map((_, index) => (
              <span
                key={`dot-${index}`}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  index === activeIndex % dots
                    ? 'bg-primary'
                    : 'bg-border'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityCarousel;
