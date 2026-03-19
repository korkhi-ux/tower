export type Hex = { q: number; r: number; s: number };

export function hexAdd(a: Hex, b: Hex): Hex {
  return { q: a.q + b.q, r: a.r + b.r, s: a.s + b.s };
}

export function hexSubtract(a: Hex, b: Hex): Hex {
  return { q: a.q - b.q, r: a.r - b.r, s: a.s - b.s };
}

export function hexDistance(a: Hex, b: Hex): number {
  const vec = hexSubtract(a, b);
  return (Math.abs(vec.q) + Math.abs(vec.r) + Math.abs(vec.s)) / 2;
}

export function hexLerp(a: Hex, b: Hex, t: number): { q: number; r: number; s: number } {
  return {
    q: a.q + (b.q - a.q) * t,
    r: a.r + (b.r - a.r) * t,
    s: a.s + (b.s - a.s) * t,
  };
}

export function hexToPixel(hex: Hex, size: number): { x: number; y: number } {
  const x = size * Math.sqrt(3) * (hex.q + hex.r / 2);
  const y = size * (3 / 2) * hex.r;
  return { x, y };
}

export function pixelToHex(x: number, y: number, size: number): Hex {
  const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / size;
  const r = ((2 / 3) * y) / size;
  return hexRound({ q, r, s: -q - r });
}

export function hexRound(hex: { q: number; r: number; s: number }): Hex {
  let q = Math.round(hex.q);
  let r = Math.round(hex.r);
  let s = Math.round(hex.s);

  const qDiff = Math.abs(q - hex.q);
  const rDiff = Math.abs(r - hex.r);
  const sDiff = Math.abs(s - hex.s);

  if (qDiff > rDiff && qDiff > sDiff) {
    q = -r - s;
  } else if (rDiff > sDiff) {
    r = -q - s;
  } else {
    s = -q - r;
  }

  return { q, r, s };
}

export function hexToString(hex: Hex): string {
  return `${hex.q},${hex.r}`;
}

export const hexDirections: Hex[] = [
  { q: 1, r: 0, s: -1 },
  { q: 1, r: -1, s: 0 },
  { q: 0, r: -1, s: 1 },
  { q: -1, r: 0, s: 1 },
  { q: -1, r: 1, s: 0 },
  { q: 0, r: 1, s: -1 },
];
