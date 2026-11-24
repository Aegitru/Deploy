import { describe, expect, it } from 'vitest';
import { wrapName } from './wrapName';

describe('noms sur deux lignes', () => {
  it('garde un nom court sur une ligne', () => {
    expect(wrapName('Hearthkyn')).toEqual(['Hearthkyn']);
    expect(wrapName('Einhyr Champion')).toEqual(['Einhyr Champion']); // 15 caractères
  });
  it('coupe entre les mots, 15 caractères maximum par ligne', () => {
    expect(wrapName('Kâhl + Einhyr Hearthguard')).toEqual(['Kâhl + Einhyr', 'Hearthguard']);
  });
  it('tronque la 2e ligne avec « ... »', () => {
    const lines = wrapName('Brôkhyr Iron-master + Hernkyn Pioneers Squad');
    expect(lines).toEqual(['Brôkhyr', 'Iron-master...']);
    expect(lines.every((l) => l.length <= 15)).toBe(true);
  });
  it('coupe un mot plus long que la ligne', () => {
    expect(wrapName('Abcdefghijklmnopqrstu')).toEqual(['Abcdefghijklmno', 'pqrstu']);
  });
});
