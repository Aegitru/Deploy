// Construit src/data/bases.json à partir du texte extrait du PDF Event Companion (Base Size Guide).
// Usage : node extract-bases.mjs   (après pdf-text.mjs)
//
// Format de sortie : { "<Faction>": { "<Datasheet>": { default?: Base, models?: { "<Figurine>": Base } } } }
// Base = { shape: 'circle', d } | { shape: 'oval', w, h } | { shape: 'hull' } | { shape: 'flying', size: 'large'|'small' }
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const txt = await readFile(path.resolve(import.meta.dirname, 'raw/event-companion.txt'), 'utf8');
const lines = txt.split(/\r?\n/);
const start = lines.findIndex((l) => l.includes('BASE SIZE GUIDE'));

function parseBase(s) {
  let m;
  if ((m = s.match(/^([\d.]+)mm$/))) return { shape: 'circle', d: +m[1] };
  if ((m = s.match(/^([\d.]+)x([\d.]+)mm Oval/))) return { shape: 'oval', w: +m[1], h: +m[2] };
  if (s === 'Hull' || s === 'Unique') return { shape: 'hull' };
  if (s === 'Large Flying Base') return { shape: 'flying', size: 'large' };
  if (s === 'Small Flying Base') return { shape: 'flying', size: 'small' };
  return null;
}

const out = {};
let faction = null;
let pending = null; // nom coupé sur deux lignes dans le PDF
for (const raw of lines.slice(start)) {
  const cells = raw.split(' | ').map((c) => {
    const i = c.indexOf(':');
    return { x: +c.slice(0, i), s: c.slice(i + 1).trim() };
  });
  if (cells[0].x === 85 && cells.length === 1 && /^[A-Z’' &-]+$/.test(cells[0].s)) {
    faction = cells[0].s;
    out[faction] ??= {};
    continue;
  }
  if (!faction || cells[0].x !== 89 || cells[0].s === 'UNIT') continue;
  const sizeCell = cells.find((c) => c.x >= 360);
  if (!sizeCell) {
    // Sous-titres (IMPERIAL ARMOUR, DAEMONS) ou suite d'un nom long
    if (pending) { pending.name += ' ' + cells[0].s; addEntry(pending.name, pending.base); pending = null; }
    continue;
  }
  const base = parseBase(sizeCell.s);
  if (!base) continue;
  if (cells[0].s.endsWith(',')) { pending = { name: cells[0].s, base }; continue; }
  addEntry(cells[0].s, base);
}

function addEntry(name, base) {
  const [unit, models] = name.split(/:\s(.+)/);
  const entry = (out[faction][unit.trim()] ??= {});
  if (!models) { entry.default = base; return; }
  entry.models ??= {};
  for (const m of models.split(/,\s*/)) if (m.trim()) entry.models[m.trim()] = base;
}

// Noms de factions plus lisibles (le PDF les met en capitales)
const pretty = (s) => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()).replace(/ Of /g, ' of ').replace(/ The /g, ' the ');
const result = Object.fromEntries(Object.entries(out).filter(([, v]) => Object.keys(v).length).map(([k, v]) => [pretty(k), v]));
await writeFile(path.resolve(import.meta.dirname, '../src/data/bases.json'), JSON.stringify(result, null, 1));
const count = Object.values(result).reduce((n, f) => n + Object.keys(f).length, 0);
console.log(Object.keys(result).length, 'factions,', count, 'datasheets');
const hulls = Object.entries(result).flatMap(([f, u]) => Object.entries(u).filter(([, e]) => e.default?.shape === 'hull').map(([n]) => `${f} > ${n}`));
await writeFile(path.resolve(import.meta.dirname, 'raw/hulls.txt'), hulls.join('\n'));
console.log(hulls.length, 'véhicules sans socle (raw/hulls.txt)');
