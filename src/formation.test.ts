import { describe, expect, it } from 'vitest';
import { formation, defaultOpts } from './store';
import type { Unit } from './lib/parseList';
import { MM_PER_INCH } from './lib/bases';

const unit = (sizes: number[]): Unit => ({
  id: 'me-0', name: 'Test', label: 'T',
  models: sizes.map((d) => ({ base: { shape: 'circle', d }, unknown: false })),
});

/** Distance minimale bord à bord entre deux socles (négative = chevauchement) */
function edgeGaps(u: Unit, perRow: number) {
  const ps = formation(u, 20, 20, { ...defaultOpts(u), perRow, gap: 0 });
  const r = (i: number) => (u.models[i].base as { d: number }).d / MM_PER_INCH / 2;
  const nearest = ps.map((p, i) =>
    Math.min(...ps.map((q, j) => (i === j ? Infinity : Math.hypot(p.x - q.x, p.y - q.y) - r(i) - r(j)))),
  );
  return nearest;
}

describe('formation', () => {
  it.each([
    ['Prime 40mm + 20 gaunts 25mm, 5 par rang', [40, ...Array(20).fill(25)], 5],
    ['Iron-master 32mm + 6 Thunderkyn 40mm, 3 par rang', [32, ...Array(6).fill(40)], 3],
    ['Kâhl 40mm + 10 Hearthguard 32mm, en ligne', [40, ...Array(10).fill(32)], 1],
    ['Beserks : 9 en 28.5mm + 1 en 50mm, 5 par rang', [...Array(9).fill(28.5), 50], 5],
    ['Deux personnages 40mm + 10 en 28.5mm', [40, 40, ...Array(10).fill(28.5)], 4],
  ])('%s : socles collés sans chevauchement', (_, sizes, perRow) => {
    const gaps = edgeGaps(unit(sizes as number[]), perRow as number);
    for (const g of gaps) {
      expect(g).toBeGreaterThan(-0.001); // pas de chevauchement
      expect(g).toBeLessThan(0.05); // chaque socle touche (à un liseré près) au moins un voisin
    }
  });
});
