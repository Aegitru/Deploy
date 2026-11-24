import { describe, expect, it } from 'vitest';
import { layoutLabels, type LabelUnit } from './labelLayout';

const measure = (s: string) => s.length * 0.3;
const box = (l: ReturnType<typeof layoutLabels>[number]) => ({ left: l.x - l.w / 2, right: l.x + l.w / 2, top: l.top, bottom: l.top + l.h });

describe("placement des noms à l'export", () => {
  it('place le nom juste au-dessus d’une unité isolée, sans trait', () => {
    const [l] = layoutLabels([{ name: 'Hearthkyn', models: [{ x: 20, y: 30, r: 0.6 }] }], 0.5, measure, 44, 60);
    expect(box(l).bottom).toBeLessThanOrEqual(29.4);
    expect(box(l).bottom).toBeGreaterThan(28.5);
    expect(l.leader).toBeNull();
  });

  it('aucun nom ne se chevauche, même pour des unités collées', () => {
    const units: LabelUnit[] = Array.from({ length: 12 }, (_, i) => ({
      name: `Unité numéro ${i} très longue`, models: [{ x: 20 + (i % 4) * 1.3, y: 30 + Math.floor(i / 4) * 1.3, r: 0.6 }],
    }));
    const ls = layoutLabels(units, 0.5, measure, 44, 60).map(box);
    for (let a = 0; a < ls.length; a++)
      for (let b = a + 1; b < ls.length; b++) {
        const A = ls[a], B = ls[b];
        expect(A.right <= B.left || B.right <= A.left || A.bottom <= B.top || B.bottom <= A.top).toBe(true);
      }
  });

  it('reste dans la table, collé au rebord si besoin', () => {
    const [l] = layoutLabels([{ name: 'Unité dans le coin', models: [{ x: 0.5, y: 0.5, r: 0.5 }] }], 0.5, measure, 44, 60);
    const b = box(l);
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.top).toBeGreaterThanOrEqual(0);
  });

  it('relie par un trait un nom qui a dû s’éloigner', () => {
    const units: LabelUnit[] = Array.from({ length: 9 }, (_, i) => ({ name: `Escouade ${i}`, models: [{ x: 22 + (i % 3) * 1.2, y: 30 + Math.floor(i / 3) * 1.2, r: 0.6 }] }));
    const ls = layoutLabels(units, 0.5, measure, 44, 60);
    expect(ls.some((l) => l.leader)).toBe(true);
  });
});
