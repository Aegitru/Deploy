import { describe, expect, it } from 'vitest';
import LZString from 'lz-string';
import { parseMagoLink } from './magoLink';

const z = (t: string) => LZString.compressToEncodedURIComponent(t);

describe('parseMagoLink', () => {
  it('lit dispositions, carte, jeton et listes', () => {
    const l = parseMagoLink('?player=reconnaissance&opponent=take-and-hold&map=b&token=abc', `#player=${z('Liste A\n• Unit')}&opponent=${z('Liste B')}`);
    expect(l).toEqual({ player: 'reconnaissance', opponent: 'take-and-hold', layout: 1, token: 'abc', lists: { me: 'Liste A\n• Unit', opp: 'Liste B' } });
  });

  it('accepte les noms complets et les numéros de carte', () => {
    const l = parseMagoLink('?player=Take%20and%20Hold&opponent=Purge+the+Foe&map=3', '');
    expect(l).toMatchObject({ player: 'take-and-hold', opponent: 'purge-the-foe', layout: 2, token: null, lists: {} });
  });

  it('ignore un lien incomplet ou invalide', () => {
    expect(parseMagoLink('?player=reconnaissance&map=a', '')).toBeNull();
    expect(parseMagoLink('?player=reconnaissance&opponent=foo&map=a', '')).toBeNull();
    expect(parseMagoLink('?player=reconnaissance&opponent=disruption&map=d', '')).toBeNull();
    expect(parseMagoLink('', '')).toBeNull();
  });

  it('ignore une liste illisible', () => {
    expect(parseMagoLink('?player=disruption&opponent=disruption&map=a', '#player=%%%')?.lists.me).toBeUndefined();
  });
});
