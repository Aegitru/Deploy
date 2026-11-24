import { describe, expect, it } from 'vitest';
import { bodyOf, isFree, nearestFree, overlaps, resolveDrag } from './collide';
import { MM_PER_INCH, type Base } from './bases';

const round32: Base = { shape: 'circle', d: 32 };
const rect: Base = { shape: 'rect', w: 100, h: 50 };
const r32 = 32 / MM_PER_INCH; // diamètre en pouces
const at = (x: number, y: number, rot = 0) => ({ x, y, rot });

describe('collisions de socles', () => {
  it('deux socles qui se touchent ne se chevauchent pas', () => {
    expect(overlaps(bodyOf(round32, at(0, 0)), bodyOf(round32, at(r32, 0)))).toBe(false);
    expect(overlaps(bodyOf(round32, at(0, 0)), bodyOf(round32, at(r32 * 0.9, 0)))).toBe(true);
  });

  it('rectangle tourné contre cercle', () => {
    const w = 100 / MM_PER_INCH;
    // Rectangle tourné de 90° : sa demi-largeur horizontale devient sa demi-hauteur (≈ 0,98")
    expect(overlaps(bodyOf(rect, at(0, 0, 90)), bodyOf(round32, at(1.2, 0)))).toBe(true);
    expect(overlaps(bodyOf(rect, at(0, 0, 90)), bodyOf(round32, at(w / 2 + 0.1, 1.8)))).toBe(false);
  });

  it("le socle s'arrête au contact puis passe de l'autre côté quand la cible est libre", () => {
    const moving = [bodyOf(round32, at(0, 0))];
    const obstacle = [bodyOf(round32, at(3, 0))];
    // Cible au milieu de l'obstacle : arrêt au contact (centre à un diamètre de l'obstacle)
    const stop = resolveDrag(moving, obstacle, { x: 0, y: 0 }, { x: 3, y: 0 });
    expect(stop.x).toBeCloseTo(3 - r32, 1);
    expect(isFree(moving, obstacle, stop)).toBe(true);
    // Cible au-delà : le socle y va
    expect(resolveDrag(moving, obstacle, stop, { x: 5, y: 0 })).toEqual({ x: 5, y: 0 });
  });

  it('glisse le long de l’obstacle', () => {
    const moving = [bodyOf(round32, at(0, 0))];
    const obstacle = [bodyOf(round32, at(3, 0))];
    const p = resolveDrag(moving, obstacle, { x: 0, y: 0 }, { x: 3, y: 0.6 });
    expect(isFree(moving, obstacle, p)).toBe(true);
    expect(p.y).toBeGreaterThan(0.3);
  });

  it('trouve une place libre à côté', () => {
    const moving = [bodyOf(round32, at(0, 0))];
    const obstacle = [bodyOf(round32, at(0, 0))];
    const d = nearestFree(moving, obstacle);
    expect(Math.hypot(d.x, d.y)).toBeGreaterThanOrEqual(r32 - 0.02);
    expect(isFree(moving, obstacle, d)).toBe(true);
  });
});
