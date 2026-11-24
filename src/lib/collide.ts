import { MM_PER_INCH, type Base } from './bases';

// Collisions entre socles (en pouces) : cercles exacts, ovales et rectangles en polygones convexes
// (séparation par axes). Les socles peuvent se toucher, pas se chevaucher.

export type Pt = { x: number; y: number };
export type Body = { x: number; y: number; r: number; circle: boolean; poly: Pt[] };

const EPS = 0.01; // chevauchement toléré (arrondis)
const STEP = 0.08; // pas de recherche du point de contact le long du déplacement

export function bodyOf(base: Base | undefined, pos: { x: number; y: number; rot: number }): Body {
  if (!base || base.shape === 'circle') {
    const r = (base ? base.d : 25) / MM_PER_INCH / 2;
    return { x: pos.x, y: pos.y, r, circle: true, poly: [] };
  }
  const w = base.w / MM_PER_INCH / 2, h = base.h / MM_PER_INCH / 2;
  const local: Pt[] = base.shape === 'oval'
    ? Array.from({ length: 16 }, (_, i) => ({ x: w * Math.cos((i * Math.PI) / 8), y: h * Math.sin((i * Math.PI) / 8) }))
    : [{ x: -w, y: -h }, { x: w, y: -h }, { x: w, y: h }, { x: -w, y: h }];
  const a = (pos.rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return { x: pos.x, y: pos.y, r: Math.hypot(w, h), circle: false, poly: local.map((p) => ({ x: pos.x + p.x * c - p.y * s, y: pos.y + p.x * s + p.y * c })) };
}

const shift = (b: Body, d: Pt): Body =>
  d.x === 0 && d.y === 0 ? b : { ...b, x: b.x + d.x, y: b.y + d.y, poly: b.poly.map((p) => ({ x: p.x + d.x, y: p.y + d.y })) };

function project(b: Body, ax: number, ay: number): [number, number] {
  if (b.circle) {
    const c = b.x * ax + b.y * ay;
    return [c - b.r, c + b.r];
  }
  let lo = Infinity, hi = -Infinity;
  for (const p of b.poly) {
    const v = p.x * ax + p.y * ay;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

function axesOf(b: Body, other: Body): Pt[] {
  if (!b.circle) {
    return b.poly.map((p, i) => {
      const q = b.poly[(i + 1) % b.poly.length];
      const nx = q.y - p.y, ny = p.x - q.x, l = Math.hypot(nx, ny) || 1;
      return { x: nx / l, y: ny / l };
    });
  }
  // Cercle contre polygone : axe vers le sommet le plus proche
  let best = other.poly[0], bd = Infinity;
  for (const p of other.poly) {
    const d = (p.x - b.x) ** 2 + (p.y - b.y) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  const l = Math.sqrt(bd) || 1;
  return [{ x: (best.x - b.x) / l, y: (best.y - b.y) / l }];
}

export function overlaps(a: Body, b: Body): boolean {
  const dist = Math.hypot(a.x - b.x, a.y - b.y);
  if (dist >= a.r + b.r - EPS) return false;
  if (a.circle && b.circle) return true;
  for (const ax of [...axesOf(a, b), ...axesOf(b, a)]) {
    const [a0, a1] = project(a, ax.x, ax.y), [b0, b1] = project(b, ax.x, ax.y);
    if (Math.min(a1, b1) - Math.max(a0, b0) <= EPS) return false;
  }
  return true;
}

/** Vrai si le groupe décalé de `d` ne chevauche aucun obstacle. */
export function isFree(moving: Body[], obstacles: Body[], d: Pt): boolean {
  for (const m of moving) {
    const mx = m.x + d.x, my = m.y + d.y;
    for (const o of obstacles) {
      if (Math.abs(mx - o.x) >= m.r + o.r || Math.abs(my - o.y) >= m.r + o.r) continue;
      if (overlaps(shift(m, d), o)) return false;
    }
  }
  return true;
}

/** Point le plus loin atteignable en ligne droite de `from` vers `to` sans chevauchement (arrêt au contact). */
function reach(moving: Body[], obstacles: Body[], from: Pt, to: Pt): Pt {
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  if (len === 0) return from;
  const n = Math.ceil(len / STEP);
  let ok = 0;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (!isFree(moving, obstacles, { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t })) break;
    ok = t;
  }
  // Affinage du contact entre le dernier pas libre et le premier bloqué
  let lo = ok, hi = Math.min(1, ok + 1 / n);
  if (ok < 1) {
    for (let k = 0; k < 8; k++) {
      const mid = (lo + hi) / 2;
      if (isFree(moving, obstacles, { x: from.x + (to.x - from.x) * mid, y: from.y + (to.y - from.y) * mid })) lo = mid;
      else hi = mid;
    }
  }
  return { x: from.x + (to.x - from.x) * lo, y: from.y + (to.y - from.y) * lo };
}

/**
 * Décalage à appliquer au groupe pendant un glisser : la position visée si elle est libre (le groupe
 * « fait le tour » des socles qu'il dépasse), sinon il s'arrête au contact en glissant le long des obstacles.
 * `last` est le décalage libre précédent.
 */
export function resolveDrag(moving: Body[], obstacles: Body[], last: Pt, target: Pt): Pt {
  if (!obstacles.length || isFree(moving, obstacles, target)) return target;
  if (!isFree(moving, obstacles, last)) return target; // déjà en chevauchement : on ne bloque pas
  let p = reach(moving, obstacles, last, target);
  for (let k = 0; k < 2; k++) {
    const byX = reach(moving, obstacles, p, { x: target.x, y: p.y });
    const byY = reach(moving, obstacles, p, { x: p.x, y: target.y });
    const dist = (q: Pt) => Math.hypot(target.x - q.x, target.y - q.y);
    const next = dist(byX) <= dist(byY) ? byX : byY;
    if (dist(next) >= dist(p) - 1e-4) break;
    p = next;
  }
  return p;
}

/**
 * Décalage libre le plus proche de zéro (spirale), pour poser une unité sans chevaucher les autres.
 * Avec `bounds` (largeur, hauteur de la table), les socles doivent aussi rester sur la table.
 */
export function nearestFree(moving: Body[], obstacles: Body[], bounds?: { w: number; h: number }): Pt {
  const inside = (d: Pt) => !bounds || moving.every((m) => {
    const x = m.x + d.x, y = m.y + d.y;
    return x - m.r >= -EPS && y - m.r >= -EPS && x + m.r <= bounds.w + EPS && y + m.r <= bounds.h + EPS;
  });
  const ok = (d: Pt) => inside(d) && isFree(moving, obstacles, d);
  if (ok({ x: 0, y: 0 })) return { x: 0, y: 0 };
  for (let k = 1; k <= 240; k++) {
    const r = k * 0.25, n = Math.max(8, Math.round((2 * Math.PI * r) / 0.25));
    for (let i = 0; i < n; i++) {
      const d = { x: r * Math.cos((2 * Math.PI * i) / n), y: r * Math.sin((2 * Math.PI * i) / n) };
      if (ok(d)) return d;
    }
  }
  return bounds ? nearestFree(moving, obstacles) : { x: 0, y: 0 };
}
