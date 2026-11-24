import { wrapName } from './wrapName';

// Placement des noms d'unités pour l'export (en pouces) : aucun nom ne chevauche un autre, aucun ne sort
// de la table (au pire collé au rebord), chacun au plus près de son unité ; un nom éloigné de ses socles
// est relié à l'unité par un trait fin.

export type LabelUnit = { name: string; models: { x: number; y: number; r: number }[] };
export type PlacedLabel = {
  unit: number; lines: string[]; x: number; top: number; w: number; h: number; lineH: number;
  leader: { x1: number; y1: number; x2: number; y2: number } | null;
};
type Box = { left: number; top: number; w: number; h: number };

const GAP = 0.12; // écart entre le nom et l'unité
const PAD = 0.06; // marge autour d'un nom
const SEP_X = 0.45, SEP_Y = 0.12; // écart minimal entre deux noms (plus large à l'horizontale : deux noms côte à côte se lisent sinon comme un seul)
const LEADER_FROM = 0.35; // au-delà de cet écart, un trait relie le nom à l'unité

const boxesHit = (a: Box, b: Box) =>
  a.left < b.left + b.w + SEP_X && b.left < a.left + a.w + SEP_X && a.top < b.top + b.h + SEP_Y && b.top < a.top + a.h + SEP_Y;

function circleHit(b: Box, c: { x: number; y: number; r: number }) {
  const nx = Math.max(b.left, Math.min(c.x, b.left + b.w)), ny = Math.max(b.top, Math.min(c.y, b.top + b.h));
  return Math.hypot(c.x - nx, c.y - ny) < c.r;
}

/** `measure(ligne)` donne la largeur d'une ligne de texte en pouces, pour une taille de police `font` (pouces). */
export function layoutLabels(units: LabelUnit[], font: number, measure: (s: string) => number, boardW: number, boardH: number): PlacedLabel[] {
  const lineH = font * 1.12;
  const allModels = units.flatMap((u) => u.models);
  const placed: Box[] = [];
  const out: PlacedLabel[] = [];
  const order = units.map((u, i) => ({ u, i, y: Math.min(...u.models.map((m) => m.y - m.r)) })).sort((a, b) => a.y - b.y);

  for (const { u, i } of order) {
    if (!u.models.length) continue;
    const lines = wrapName(u.name);
    const w = Math.max(...lines.map(measure)) + 2 * PAD, h = lines.length * lineH + 2 * PAD;
    const minX = Math.min(...u.models.map((m) => m.x - m.r)), maxX = Math.max(...u.models.map((m) => m.x + m.r));
    const minY = Math.min(...u.models.map((m) => m.y - m.r)), maxY = Math.max(...u.models.map((m) => m.y + m.r));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const clamp = (left: number, top: number): Box => ({
      left: Math.max(0, Math.min(boardW - w, left)), top: Math.max(0, Math.min(boardH - h, top)), w, h,
    });

    // Au-dessus, en dessous, à droite, à gauche, puis de plus en plus loin tout autour
    const candidates: Box[] = [
      clamp(cx - w / 2, minY - GAP - h), clamp(cx - w / 2, maxY + GAP),
      clamp(maxX + GAP, cy - h / 2), clamp(minX - GAP - w, cy - h / 2),
    ];
    for (let k = 1; k <= 60; k++) {
      const d = k * 0.3;
      for (let a = 0; a < 16; a++) {
        const t = -Math.PI / 2 + (a * Math.PI) / 8;
        const px = cx + Math.cos(t) * ((maxX - minX) / 2 + w / 2 + GAP + d);
        const py = cy + Math.sin(t) * ((maxY - minY) / 2 + h / 2 + GAP + d);
        candidates.push(clamp(px - w / 2, py - h / 2));
      }
    }
    const free = (b: Box) => !placed.some((p) => boxesHit(p, b));
    const box = candidates.find((b) => free(b) && !allModels.some((m) => circleHit(b, m)))
      ?? candidates.find(free) ?? candidates[0];
    placed.push(box);

    // Trait vers le socle le plus proche quand le nom a dû s'éloigner
    let leader: PlacedLabel['leader'] = null;
    let best = u.models[0], bestGap = Infinity, bestPt = { x: 0, y: 0 };
    for (const m of u.models) {
      const nx = Math.max(box.left, Math.min(m.x, box.left + w)), ny = Math.max(box.top, Math.min(m.y, box.top + h));
      const gap = Math.hypot(m.x - nx, m.y - ny) - m.r;
      if (gap < bestGap) { bestGap = gap; best = m; bestPt = { x: nx, y: ny }; }
    }
    if (bestGap > LEADER_FROM) {
      const dx = bestPt.x - best.x, dy = bestPt.y - best.y, l = Math.hypot(dx, dy) || 1;
      leader = { x1: bestPt.x, y1: bestPt.y, x2: best.x + (dx / l) * best.r, y2: best.y + (dy / l) * best.r };
    }
    out.push({ unit: i, lines, x: box.left + w / 2, top: box.top + PAD, w, h, lineH, leader });
  }
  return out;
}
