// Télécharge les cartes de bataille et les cartes de missions principales depuis gdmissions.app
// et génère src/data/missions.json. Usage : node download-assets.mjs
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://gdmissions.app';
const OUT = path.resolve(import.meta.dirname, '../public/assets');
const RAW = path.resolve(import.meta.dirname, 'raw');
const DATA = path.resolve(import.meta.dirname, '../src/data');

const DISPOSITIONS = [
  { id: 'take-and-hold', name: 'Take and Hold' },
  { id: 'purge-the-foe', name: 'Purge the Foe' },
  { id: 'disruption', name: 'Disruption' },
  { id: 'reconnaissance', name: 'Reconnaissance' },
  { id: 'priority-assets', name: 'Priority Assets' },
];

// Ligne = ma disposition, colonne = disposition adverse (ordre de DISPOSITIONS)
const MATRIX = {
  'take-and-hold': ['Battlefield Dominance', 'Immovable Object', 'Determined Acquisition', 'Purge and Secure', 'Inescapable Dominion'],
  'purge-the-foe': ['Unstoppable Force', 'Meatgrinder', 'Punishment', 'Consecrate', "Destroyer's Wrath"],
  'disruption': ['Death Trap', 'Delaying Action', 'Outmanoeuvre', 'Smoke and Mirrors', 'Locate and Deny'],
  'reconnaissance': ['Reconnaissance Sweep', 'Triangulation', 'Surveil the Foe', 'Gather Intel', 'Search and Scour'],
  'priority-assets': ['Secure Asset', 'Vital Link', 'Extract Relic', 'Vanguard Operation', 'Sabotage'],
};

const slug = (s) => s.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function download(url, dest) {
  if (await exists(dest)) return true;
  const res = await fetch(url);
  if (!res.ok) { console.warn('KO', res.status, url); return false; }
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  console.log('OK', url);
  return true;
}

const missions = [];
for (const mine of DISPOSITIONS) {
  for (const [i, opp] of DISPOSITIONS.entries()) {
    const name = MATRIX[mine.id][i];
    const missionSlug = slug(name);
    const missionFile = `missions/${mine.id}/${missionSlug}.png`;
    const missionOk = await download(`${BASE}/assets/11th/primary-missions/${mine.id}/${missionSlug}.png`, path.join(OUT, missionFile));
    // Certaines cartes de mission sont recto-verso : la page référence alors un "<slug>-back.png".
    const missionHtml = await (await fetch(`${BASE}/11th/primary-missions/${mine.id}/${missionSlug}`)).text();
    const backFile = `missions/${mine.id}/${missionSlug}-back.png`;
    const hasBack = missionHtml.includes(`${missionSlug}-back.png`)
      && await download(`${BASE}/assets/11th/primary-missions/${mine.id}/${missionSlug}-back.png`, path.join(OUT, backFile));

    // Les noms d'images varient (a-vs-b / b-vs-a / mirror, suffixe -portrait) : on les lit dans la page du matchup.
    const html = await (await fetch(`${BASE}/11th/layouts/${mine.id}/${opp.id}`)).text();
    const srcs = [...new Set(html.match(/\/assets\/11th\/layouts\/no-measurements\/[a-z0-9-]+\.png/g) ?? [])];
    const layouts = [];
    for (const src of srcs) {
      const file = `layouts/${path.basename(src)}`;
      if (await download(BASE + src, path.join(RAW, file))) layouts.push(file);
    }
    const boards = layouts.map((f) => f.replace(/^layouts\//, 'boards/').replace(/\.png$/, '.webp'));
    missions.push({ mine: mine.id, opponent: opp.id, name, image: missionOk ? missionFile : null, back: hasBack ? backFile : null, layouts, boards });
  }
}

await mkdir(DATA, { recursive: true });
await writeFile(path.join(DATA, 'missions.json'), JSON.stringify({ dispositions: DISPOSITIONS, missions }, null, 2));
console.log('missions.json écrit,', missions.length, 'combinaisons');
