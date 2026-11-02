import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseList } from './lib/parseList';
import { formation, defaultOpts, partsOf, resolvedUnits, useStore } from './store';

const fixture = (f: string) => readFileSync(path.join(import.meta.dirname, 'lib/__fixtures__', f), 'utf8');
const army = parseList(fixture('votann-official.txt'), 'me');
const byName = (name: string) => army.units.find((u) => u.name === name)!;
const names = () => resolvedUnits(useStore.getState().armies.me!.army, useStore.getState()).map((u) => `${u.name} (${u.models.length})`);

beforeEach(() => {
  useStore.setState({ armies: { me: { text: '', army } }, placed: {}, unitOpts: {}, splits: {}, modelDelta: {}, detached: {}, attached: {} });
});

describe('rôles lus dans la liste', () => {
  it('repère les personnages (section CHARACTERS, « Attached as: Leader »)', () => {
    expect(partsOf(byName('Buri Aegnirssen'))[0].character).toBe(true);
    expect(partsOf(byName('Kâhl + Einhyr Hearthguard')).map((p) => p.character)).toEqual([true, false]);
    expect(partsOf(byName('Hearthkyn Warriors'))[0].character).toBe(false);
    expect(partsOf(byName('Hekaton Land Fortress'))[0].character).toBe(false);
  });
});

describe('détacher / attacher', () => {
  it('détache le personnage d’une unité menée en gardant les positions sur la table', () => {
    const kahl = byName('Kâhl + Einhyr Hearthguard');
    const ps = formation(kahl, 20, 20, defaultOpts(kahl));
    useStore.setState({ placed: { [kahl.id]: ps } });
    useStore.getState().detachPart(kahl.id, 0);
    expect(names()).toContain('Einhyr Hearthguard (10)');
    expect(names()).toContain('Kâhl (1)');
    const placed = useStore.getState().placed;
    expect(placed[`${kahl.id}~0`]).toEqual(ps.slice(0, 1));
    expect(placed[kahl.id]).toEqual(ps.slice(1));
  });

  it('attache un personnage seul à une unité, puis le détache', () => {
    const buri = byName('Buri Aegnirssen'), warriors = byName('Hearthkyn Warriors');
    useStore.getState().attach(buri.id, warriors.id);
    expect(names()).toContain('Buri Aegnirssen + Hearthkyn Warriors (11)');
    expect(names()).not.toContain('Buri Aegnirssen (1)');
    useStore.getState().detachPart(warriors.id, 0);
    expect(names()).toContain('Buri Aegnirssen (1)');
    expect(names()).toContain('Hearthkyn Warriors (10)');
  });

  it('rattache à son unité un meneur détaché', () => {
    const kahl = byName('Kâhl + Einhyr Hearthguard');
    useStore.getState().detachPart(kahl.id, 0);
    useStore.getState().attach(`${kahl.id}~0`, kahl.id);
    expect(names()).toContain('Kâhl + Einhyr Hearthguard (11)');
  });
});
