'use client';

import { useEffect, useState, type ReactNode } from 'react';

const rotationDelay = 7000;

export function HeroBackground({
  images,
  priority,
  children,
}: {
  images: string[];
  priority: boolean;
  children: ReactNode;
}) {
  const [slide, setSlide] = useState({ current: 0, previous: -1 });
  const [paused, setPaused] = useState(false);
  const { current } = slide;

  useEffect(() => {
    if (paused || images.length < 2) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let next = current;
    let cancelled = false;
    let loading = false;

    const timer = window.setInterval(async () => {
      if (loading || motion.matches || document.hidden) return;

      next = (next + 1) % images.length;
      if (next === current) return;

      loading = true;
      const photo = new window.Image();
      photo.src = images[next]!;
      try {
        await photo.decode();
        if (!cancelled && !motion.matches && !document.hidden) {
          setSlide({ current: next, previous: current });
        }
      } catch {
        // Keep the visible photo and try the next source on the following tick.
      } finally {
        loading = false;
      }
    }, rotationDelay);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [images, paused, current]);

  return (
    <>
      <div className="hero-backdrop" aria-hidden="true">
        {slide.previous >= 0 ? (
          <img key={slide.previous} className="hero-bg" src={images[slide.previous]} alt="" />
        ) : null}
        <img
          key={slide.current}
          className={slide.previous >= 0 ? 'hero-bg hero-bg-enter' : 'hero-bg'}
          src={images[slide.current]}
          alt=""
          fetchPriority={priority && slide.previous < 0 ? 'high' : undefined}
        />
      </div>
      {children}
      {images.length > 1 ? (
        <div className="wrap hero-controls">
          <button type="button" className="hero-pause" onClick={() => setPaused((value) => !value)}>
            <span aria-hidden="true">{paused ? '▶' : 'Ⅱ'}</span>
            {paused ? 'Play backgrounds' : 'Pause backgrounds'}
          </button>
        </div>
      ) : null}
    </>
  );
}
