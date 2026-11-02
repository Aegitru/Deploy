import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseList, type Army } from './parseList';

const fixture = (f: string) => readFileSync(path.join(import.meta.dirname, '__fixtures__', f), 'utf8');

/** Résumé lisible : "nom (nb figurines) socles" */
function summary(a: Army) {
  return a.units.map((u) => {
    const sizes = u.models.map((m) => (m.base.shape === 'circle' ? `${m.base.d}` : `${m.base.w}x${m.base.h}`));
    const counts = Object.entries(sizes.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s]: (acc[s] ?? 0) + 1 }), {}))
      .map(([s, n]) => `${n}x${s}`).sort().join(' ');
    return `${u.name} (${u.models.length}) ${counts}`;
  });
}

const EXPECTED = [
  'Berehk Stornbröw + Cthonian Beserks (6) 1x40 5x28.5',
  'Buri Aegnirssen (1) 1x40',
  'Brôkhyr Iron-master + Brôkhyr Thunderkyn (7) 1x32 6x40',
  'Kâhl + Einhyr Hearthguard (11) 10x32 1x40',
  'Memnyr Strategist (1) 1x32',
  'Hearthkyn Warriors (10) 10x28.5',
  'Brôkhyr Thunderkyn (6) 6x40',
  'Cthonian Beserks (10) 1x50 9x28.5',
  'Hernkyn Yaegirs (9) 9x28.5',
  'Hernkyn Pioneers (3) 3x90x52.5',
  'Hernkyn Pioneers (3) 3x90x52.5',
  'Hekaton Land Fortress (1) 1x170x105',
  'Kapricus Carrier (1) 1x105x70',
  'Sagitaur (1) 1x130x80',
];

describe('personnages à plusieurs figurines', () => {
  const ironMaster = (a: Army) => summary(a).find((s) => s.startsWith('Brôkhyr Iron-master'));
  it.each(['listhammer/188.txt', 'listhammer/191.txt'])('app officielle (%s) : Iron-master + assistant + E-COG', (f) => {
    expect(ironMaster(parseList(fixture(f), 'me'))).toMatch(/^Brôkhyr Iron-master.*1x28\.5 1x32 3x25/);
  });
  it('NewRecruit : les E-COG seuls impliquent le personnage', () => {
    const a = parseList('Xenos - Leagues of Votann - Test - [2000 pts]\n\nBrôkhyr Iron-master [85 pts]:\n• 4x E-COG\n', 'me');
    expect(summary(a)).toEqual(['Brôkhyr Iron-master (5) 1x32 4x25']);
  });
});

describe('parseList', () => {
  it('lit une liste NewRecruit', () => {
    const a = parseList(fixture('votann-newrecruit.txt'), 'me');
    expect(a.faction).toBe('Leagues of Votann');
    expect(a.name).toBe('Mercovenant v2');
    expect(a.warnings).toEqual([]);
    expect(summary(a).sort()).toEqual([...EXPECTED].sort());
  });

  it("lit une liste de l'app officielle", () => {
    const a = parseList(fixture('votann-official.txt'), 'me');
    expect(a.faction).toBe('Leagues of Votann');
    expect(a.name).toBe('Mercovenant v2');
    expect(a.warnings).toEqual([]);
    expect(summary(a).sort()).toEqual([...EXPECTED].sort());
  });
});
