// Passe le parser sur les listes de tournoi récupérées par tools/fetch-listhammer.mjs.
// Ne casse pas sur les socles inconnus : affiche un rapport pour repérer les cas à corriger.
import { it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseList } from './parseList';

const dir = path.join(import.meta.dirname, '__fixtures__', 'listhammer');

it.skipIf(!existsSync(dir))('lit les listes de tournoi listhammer', () => {
  const files = readdirSync(dir);
  const unknown = new Map<string, number>();
  const issues: string[] = [];
  let units = 0;
  for (const f of files) {
    const text = readFileSync(path.join(dir, f), 'utf8');
    const a = parseList(text, 'x');
    units += a.units.length;
    if (!a.faction) issues.push(`${f}: faction ? (${text.split('\n').slice(0, 4).join(' / ')})`);
    if (a.units.length < 3) issues.push(`${f}: seulement ${a.units.length} unités`);
    for (const u of a.units) if (u.models.length > 30) issues.push(`${f}: ${u.name} = ${u.models.length} figurines ?`);
    for (const w of a.warnings.filter((w) => w.startsWith('Socle inconnu'))) {
      for (const n of w.split(': ')[1].split(', ')) unknown.set(`${a.faction} > ${n}`, (unknown.get(`${a.faction} > ${n}`) ?? 0) + 1);
    }
  }
  console.log(`${files.length} listes, ${units} unités`);
  console.log('PROBLEMES\n' + issues.join('\n'));
  console.log('SOCLES INCONNUS\n' + [...unknown].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n}\t${k}`).join('\n'));
  // Rapport indicatif : certaines listes sont en espagnol, en art ASCII ou dans un format maison.
  expect(units / files.length).toBeGreaterThan(11);
});
