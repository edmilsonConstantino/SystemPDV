import { useRef, useState, useEffect, useCallback, Children, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const AUTO_MS = 4800;
const PAUSE_AFTER_TOUCH_MS = 9000;

type KpiCarouselProps = {
  children: ReactNode;
  className?: string;
};

export function KpiCarousel({ children, className }: KpiCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const slides = Children.toArray(children).filter(Boolean);
  const n = slides.length;

  const scrollToIndex = useCallback((i: number) => {
    const root = scrollRef.current;
    if (!root || n === 0) return;
    const clamped = ((i % n) + n) % n;
    const el = root.querySelector<HTMLElement>(`[data-kpi-slide="${clamped}"]`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    activeRef.current = clamped;
    setActive(clamped);
  }, [n]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || n === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        let best: { i: number; r: number } | null = null;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = Number((e.target as HTMLElement).dataset.kpiSlide);
          if (Number.isNaN(i)) continue;
          const r = e.intersectionRatio;
          if (!best || r > best.r) best = { i, r };
        }
        if (best && best.r >= 0.45) {
          activeRef.current = best.i;
          setActive(best.i);
        }
      },
      { root, rootMargin: '-6% 0px -6% 0px', threshold: [0.35, 0.5, 0.65, 0.85] },
    );

    root.querySelectorAll('[data-kpi-slide]').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [n]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    if (!mq.matches || n <= 1 || paused) return;

    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const next = (activeRef.current + 1) % n;
      scrollToIndex(next);
    }, AUTO_MS);

    return () => clearInterval(id);
  }, [n, paused, scrollToIndex]);

  const pauseBriefly = useCallback(() => {
    setPaused(true);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      setPaused(false);
      resumeTimerRef.current = null;
    }, PAUSE_AFTER_TOUCH_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  if (n === 0) return null;

  return (
    <div className={cn('relative md:hidden', className)}>
      <div
        ref={scrollRef}
        onTouchStart={pauseBriefly}
        onPointerDown={pauseBriefly}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollPaddingInline: '0.75rem' }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            data-kpi-slide={i}
            className="flex w-[min(82vw,18rem)] shrink-0 snap-center snap-always justify-center"
          >
            <div className="w-full">{slide}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 mb-1 flex items-center justify-center gap-1.5 px-4" role="tablist" aria-label="Indicadores KPI">
        {Array.from({ length: n }).map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={`Ir para indicador ${i + 1}`}
            onClick={() => {
              pauseBriefly();
              scrollToIndex(i);
            }}
            className={cn(
              'h-1 rounded-full transition-all duration-300 ease-out',
              i === active
                ? 'w-5 bg-[#B71C1C]'
                : 'w-1 bg-gray-300 hover:bg-[#B71C1C]/40',
            )}
          />
        ))}
      </div>
    </div>
  );
}
