import { expect, it } from 'vitest';
import bases from './bases.json';
import { HULLS } from './hulls';

it('chaque véhicule sans socle de l’Event Companion a une empreinte dédiée', () => {
  const hulls = new Set<string>();
  for (const units of Object.values(bases as Record<string, Record<string, { default?: { shape: string } }>>)) {
    for (const [name, entry] of Object.entries(units)) if (entry.default?.shape === 'hull') hulls.add(name);
  }
  const missing = [...hulls].filter((n) => !HULLS.some((h) => h.match.test(n)));
  expect(missing).toEqual([]);
});
