// Récupère des listes de tournoi récentes sur listhammer.info pour tester le parser.
// Usage : node fetch-listhammer.mjs [pages de factions...]  → src/lib/__fixtures__/listhammer/*.txt
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, '../src/lib/__fixtures__/listhammer');
const pages = process.argv.slice(2).length ? process.argv.slice(2) : ['/'];
await mkdir(OUT, { recursive: true });
let n = 0;
for (const p of pages) {
  const html = await (await fetch('https://listhammer.info' + p)).text();
  const m = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) { console.warn('pas de données', p); continue; }
  const lists = JSON.parse(m[1]).filter((x) => typeof x === 'string' && x.length > 500 && /\(\d[\d,]* (points|pts)\)|\[\d+ pts\]/i.test(x));
  for (const l of lists) await writeFile(path.join(OUT, `${String(++n).padStart(3, '0')}.txt`), l);
}
console.log(n, 'listes écrites dans', OUT);
