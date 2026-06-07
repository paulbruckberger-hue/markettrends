import React, { CSSProperties } from 'react';

/* X-flavoured glyphs; stroke uses currentColor. */
const P = (d: string, props: Record<string, unknown> = {}) =>
  React.createElement('path', { d, ...props });

type Builder = (filled: boolean) => React.ReactNode[];

const ICONS: Record<string, Builder> = {
  home: (f) => f
    ? [P('M12 1.7 1.5 11v11.3h7.1v-7h6.8v7h7.1V11L12 1.7z')]
    : [P('M12 1.7 1.5 11v11.3h7.1v-7h6.8v7h7.1V11L12 1.7z', { fill: 'none', stroke: 'currentColor', strokeWidth: 2 })],
  search: () => [
    React.createElement('circle', { key: 'c', cx: 10.5, cy: 10.5, r: 7, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }),
    P('M16 16l5 5', { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
  ],
  plus: () => [P('M12 4v16M4 12h16', { stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' })],
  compose: () => [
    P('M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5z', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' }),
  ],
  watchlist: (f) => f
    ? [P('M4 5h16M4 12h16M4 19h10', { stroke: 'currentColor', strokeWidth: 2.6, strokeLinecap: 'round' })]
    : [P('M4 5h16M4 12h16M4 19h10', { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' })],
  analytics: (f) => f
    ? [P('M4 20V10M10 20V4M16 20v-7M22 20H2', { stroke: 'currentColor', strokeWidth: 2.6, strokeLinecap: 'round' })]
    : [P('M4 20V11M10 20V5M16 20v-6', { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }), P('M2.5 20.5h19', { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' })],
  bookmark: (f) => f
    ? [P('M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z')]
    : [P('M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' })],
  share: () => [
    P('M12 3v13', { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
    P('M7.5 7.5 12 3l4.5 4.5', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    P('M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
  ],
  more: () => [
    React.createElement('circle', { key: 'a', cx: 5, cy: 12, r: 2, fill: 'currentColor' }),
    React.createElement('circle', { key: 'b', cx: 12, cy: 12, r: 2, fill: 'currentColor' }),
    React.createElement('circle', { key: 'c', cx: 19, cy: 12, r: 2, fill: 'currentColor' }),
  ],
  back: () => [P('M15 4 7 12l8 8', { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' })],
  chevron: () => [P('M9 5l7 7-7 7', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })],
  close: () => [P('M5 5l14 14M19 5L5 19', { stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' })],
  check: () => [P('M4 12l5 5L20 6', { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' })],
  up: () => [P('M12 3.5 3 18h18L12 3.5z', { fill: 'currentColor' })],
  thumbUp: (f) => f
    ? [P('M2 10h4v11H2V10zm6 0 3.2-7.2A2 2 0 0 1 15 4v4h5a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18.6 20H8V10z')]
    : [P('M2 10h4v10H2V10z', { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinejoin: 'round' }), P('M6 11l3.4-7.6A1.6 1.6 0 0 1 14 4.2V9h5.4a1.8 1.8 0 0 1 1.8 2.1l-1.3 7.2A1.8 1.8 0 0 1 18 20H6', { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinejoin: 'round' })],
  thumbDown: (f) => f
    ? [P('M22 14h-4V3h4v11zm-6 0-3.2 7.2A2 2 0 0 1 9 20v-4H4a2 2 0 0 1-2-2.3l1.4-8A2 2 0 0 1 5.4 4H16v10z')]
    : [P('M22 4h-4v10h4V4z', { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinejoin: 'round' }), P('M18 13l-3.4 7.6A1.6 1.6 0 0 1 10 19.8V15H4.6a1.8 1.8 0 0 1-1.8-2.1l1.3-7.2A1.8 1.8 0 0 1 6 4h12', { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinejoin: 'round' })],
  external: () => [
    P('M14 4h6v6', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    P('M20 4 11 13', { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
    P('M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  ],
  verified: () => [P('M12 1.5l2.3 1.8 2.9-.3 1.2 2.7 2.6 1.3-.6 2.8 1.4 2.6-2 2 .1 2.9-2.8.8-1.5 2.5-2.8-.7-2.5 1.5-2.5-1.5-2.8.7L4.7 19l-2.8-.8.1-2.9-2-2 1.4-2.6-.6-2.8 2.6-1.3 1.2-2.7 2.9.3L12 1.5z', { fill: 'currentColor' }), P('M8 12l2.5 2.5L16 9', { fill: 'none', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })],
  eye: () => [
    P('M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z', { fill: 'none', stroke: 'currentColor', strokeWidth: 2 }),
    React.createElement('circle', { key: 'c', cx: 12, cy: 12, r: 3, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }),
  ],
  eyeOff: () => [
    P('M3 3l18 18', { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
    P('M10.6 6.2A9.8 9.8 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3 3.6M6.3 7.8A16 16 0 0 0 2.5 12s3.5 6 9.5 6a9.4 9.4 0 0 0 3.6-.7', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
  ],
  settings: () => [
    React.createElement('circle', { key: 'c', cx: 12, cy: 12, r: 3, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }),
    P('M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1', { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
  ],
  bell: () => [P('M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' }), P('M10 19a2 2 0 0 0 4 0', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' })],
  hash: () => [P('M5 9h14M5 15h14M9.5 4 8 20M16 4l-1.5 16', { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' })],
  building: () => [
    P('M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' }),
    P('M15 9h4a1 1 0 0 1 1 1v11', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' }),
    P('M2 21h20', { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
    P('M7.5 8h3M7.5 12h3M7.5 16h3', { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
  ],
  trending: () => [P('M3 17l6-6 4 4 7-8', { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }), P('M16 7h5v5', { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' })],
  clock: () => [React.createElement('circle', { key: 'c', cx: 12, cy: 12, r: 9, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }), P('M12 7v5l3.5 2', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })],
  play: () => [P('M6 4l13 8-13 8V4z', { fill: 'currentColor' })],
  refresh: () => [P('M20 11a8 8 0 1 0-1.5 5', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }), P('M20 5v6h-6', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })],
  calendar: () => [
    React.createElement('rect', { key: 'r', x: 3.5, y: 5, width: 17, height: 16, rx: 2.5, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }),
    P('M3.5 9.5h17M8 3v4M16 3v4', { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
  ],
  globe: () => [
    React.createElement('circle', { key: 'c', cx: 12, cy: 12, r: 9, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }),
    P('M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18', { fill: 'none', stroke: 'currentColor', strokeWidth: 2 }),
  ],
  sun: () => [React.createElement('circle', { key: 'c', cx: 12, cy: 12, r: 4.5, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }), P('M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.5 4.5l1.8 1.8M17.7 17.7l1.8 1.8M19.5 4.5l-1.8 1.8M6.3 17.7l-1.8 1.8', { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' })],
  moon: () => [P('M20 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 20 14.5z', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' })],
  logout: () => [P('M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }), P('M10 8l-4 4 4 4M6 12h11', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })],
  sparkle: () => [P('M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z', { fill: 'currentColor' })],
  flame: () => [P('M12 2s5 4 5 9a5 5 0 0 1-10 0c0-1.5.5-2.5 1-3 0 1.5 1 2 1.5 2C9 8 12 6 12 2z', { fill: 'currentColor' })],
  bolt: () => [P('M13 2 4 14h6l-1 8 9-12h-6l1-8z', { fill: 'currentColor' })],
  mail: () => [
    React.createElement('rect', { key: 'r', x: 2.5, y: 5, width: 19, height: 14, rx: 3, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }),
    P('M4 7.5l8 5.5 8-5.5', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  ],
  target: () => [
    React.createElement('circle', { key: 'a', cx: 12, cy: 12, r: 9, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }),
    React.createElement('circle', { key: 'b', cx: 12, cy: 12, r: 5, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }),
    React.createElement('circle', { key: 'c', cx: 12, cy: 12, r: 1.5, fill: 'currentColor' }),
  ],
  filter: () => [P('M3 5h18l-7 8v6l-4 2v-8L3 5z', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' })],
  comment: () => [P('M21 11.5a8.4 8.4 0 0 1-8.5 8.5 9 9 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 4 11.5 8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' })],
  repeat: () => [P('M4 9V7a2 2 0 0 1 2-2h11M4 9l-2-2m2 2 2-2M20 15v2a2 2 0 0 1-2 2H7m13-4 2 2m-2-2-2 2', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })],
  heart: () => [P('M12 20s-7-4.4-9.3-8.5C1 8.5 2.3 5 5.5 5 8 5 12 8 12 8s4-3 6.5-3C21.7 5 23 8.5 21.3 11.5 19 15.6 12 20 12 20z', { fill: 'currentColor' })],
  arrowUp: () => [P('M12 19V5M6 11l6-6 6 6', { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' })],
  arrowDown: () => [P('M12 5v14M6 13l6 6 6-6', { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' })],
  grid: () => [
    React.createElement('rect', { key: 'a', x: 3.5, y: 3.5, width: 7, height: 7, rx: 1.5, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }),
    React.createElement('rect', { key: 'b', x: 13.5, y: 3.5, width: 7, height: 7, rx: 1.5, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }),
    React.createElement('rect', { key: 'c', x: 3.5, y: 13.5, width: 7, height: 7, rx: 1.5, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }),
    React.createElement('rect', { key: 'd', x: 13.5, y: 13.5, width: 7, height: 7, rx: 1.5, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }),
  ],
  swords: () => [
    P('M4 4h3l9 9-3 3-9-9V4z', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' }),
    P('M20 4h-3l-9 9 3 3 9-9V4z', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' }),
  ],
  trash: () => [
    P('M4 7h16', { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
    P('M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' }),
    P('M6.5 7l1 12.2a1 1 0 0 0 1 .8h7a1 1 0 0 0 1-.8L18.5 7', { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' }),
    P('M10 11v5M14 11v5', { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
  ],
};

export type IconName = keyof typeof ICONS;

export function Icon({
  name, size = 24, filled = false, style, color,
}: {
  name: IconName;
  size?: number;
  filled?: boolean;
  style?: CSSProperties;
  color?: string;
}) {
  const builder = ICONS[name];
  if (!builder) return null;
  return React.createElement(
    'svg',
    { width: size, height: size, viewBox: '0 0 24 24', style: { display: 'block', color, ...style }, 'aria-hidden': true },
    builder(filled),
  );
}
