/**
 * Open Doodles illustration component.
 *
 * Architecture:
 * - SVGs are dynamically imported — each page only loads the illustration it needs
 * - Native `loading="lazy"` for below-fold illustrations
 * - CSS fade-in animation on load for polished appearance
 * - Dark mode via CSS filter (invert + brightness adjustment)
 */

import { useState, useEffect } from 'react';

/* ── Dynamic SVG map — resolved at runtime, enables code splitting ── */
const SVG_LOADERS: Record<string, () => Promise<{ default: string }>> = {
  // Original 13
  coffee: () => import('../../assets/peeps/coffee.svg'),
  chillin: () => import('../../assets/peeps/chillin.svg'),
  'looking-ahead': () => import('../../assets/peeps/looking-ahead.svg'),
  'new-beginnings': () => import('../../assets/peeps/new-beginnings.svg'),
  pondering: () => import('../../assets/peeps/pondering.svg'),
  waiting: () => import('../../assets/peeps/waiting.svg'),
  reflecting: () => import('../../assets/peeps/reflecting.svg'),
  growth: () => import('../../assets/peeps/growth.svg'),
  whoa: () => import('../../assets/peeps/whoa.svg'),
  feliz: () => import('../../assets/peeps/feliz.svg'),
  runner: () => import('../../assets/peeps/runner.svg'),
  bueno: () => import('../../assets/peeps/bueno.svg'),
  'wont-stop': () => import('../../assets/peeps/wont-stop.svg'),
  // Batch 2 — 25 more
  astro: () => import('../../assets/peeps/astro.svg'),
  'chaotic-good': () => import('../../assets/peeps/chaotic-good.svg'),
  chilly: () => import('../../assets/peeps/chilly.svg'),
  consumer: () => import('../../assets/peeps/consumer.svg'),
  'cube-leg': () => import('../../assets/peeps/cube-leg.svg'),
  'ecto-plasma': () => import('../../assets/peeps/ecto-plasma.svg'),
  entertainment: () => import('../../assets/peeps/entertainment.svg'),
  experiments: () => import('../../assets/peeps/experiments.svg'),
  fling: () => import('../../assets/peeps/fling.svg'),
  gamestation: () => import('../../assets/peeps/gamestation.svg'),
  groceries: () => import('../../assets/peeps/groceries.svg'),
  jumping: () => import('../../assets/peeps/jumping.svg'),
  kiddo: () => import('../../assets/peeps/kiddo.svg'),
  'late-for-class': () => import('../../assets/peeps/late-for-class.svg'),
  mask: () => import('../../assets/peeps/mask.svg'),
  'mechanical-love': () => import('../../assets/peeps/mechanical-love.svg'),
  'meela-pantalones': () => import('../../assets/peeps/meela-pantalones.svg'),
  pacheco: () => import('../../assets/peeps/pacheco.svg'),
  pilot: () => import('../../assets/peeps/pilot.svg'),
  plants: () => import('../../assets/peeps/plants.svg'),
  'polka-pup': () => import('../../assets/peeps/polka-pup.svg'),
  puppy: () => import('../../assets/peeps/puppy.svg'),
  roboto: () => import('../../assets/peeps/roboto.svg'),
  rogue: () => import('../../assets/peeps/rogue.svg'),
  'walking-contradiction': () => import('../../assets/peeps/walking-contradiction.svg'),
};

/** Cache resolved URLs so re-renders don't re-import */
const urlCache = new Map<string, string>();

export type PeepName = keyof typeof SVG_LOADERS;

interface Props {
  name: PeepName;
  /** Display size (width & height) in px */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Skip fade-in animation (for watermarks that shouldn't draw attention) */
  instant?: boolean;
}

export default function PeepIllustration({ name, size = 140, className = '', style, instant = false }: Props) {
  const [src, setSrc] = useState<string | null>(urlCache.get(name) ?? null);
  const [loaded, setLoaded] = useState(!!urlCache.get(name));

  useEffect(() => {
    const cached = urlCache.get(name);
    if (cached) {
      setSrc(cached);
      setLoaded(true);
      return;
    }
    const loader = SVG_LOADERS[name];
    if (!loader) return;
    loader().then((mod) => {
      urlCache.set(name, mod.default);
      setSrc(mod.default);
    });
  }, [name]);

  if (!src) return <div style={{ width: size, height: size, flexShrink: 0 }} />;

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onLoad={() => setLoaded(true)}
      className={`peep-illustration ${className}`}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        userSelect: 'none',
        pointerEvents: 'none',
        flexShrink: 0,
        opacity: instant || loaded ? undefined : 0,
        transition: instant ? undefined : 'opacity 0.4s ease',
        ...style,
      }}
      draggable={false}
    />
  );
}
