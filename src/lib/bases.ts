import rawBases from '../data/bases.json';
import { HULLS, DEFAULT_HULL, FLYING, DEFAULT_BASE_MM } from '../data/hulls';

/** Socle résolu, dimensions en mm. Les ovales et rectangles sont orientés grand axe horizontal. */
export type Base =
  | { shape: 'circle'; d: number }
  | { shape: 'oval'; w: number; h: number }
  | { shape: 'rect'; w: number; h: number };

type RawBase =
  | { shape: 'circle'; d: number }
  | { shape: 'oval'; w: number; h: number }
  | { shape: 'hull' }
  | { shape: 'flying'; size: 'large' | 'small' };

type RawEntry = { default?: RawBase; models?: Record<string, RawBase> };

const BASES = rawBases as unknown as Record<string, Record<string, RawEntry>>;

export const MM_PER_INCH = 25.4;

/** Minuscules, sans accents ni ponctuation : sert à comparer les noms entre listes et Event Companion. */
export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/[’']/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const FACTION_KEYS = Object.keys(BASES).map((k) => ({ key: k, n: norm(k) }));

// Les chapitres de Space Marines n'ont dans le guide que leurs unités propres.
const FACTION_FALLBACK: Record<string, string[]> = {
  'Blood Angels': ['Space Marines'],
  'Dark Angels': ['Space Marines'],
  'Space Wolves': ['Space Marines'],
  'Black Templars': ['Space Marines'],
  Deathwatch: ['Space Marines'],
  'Imperial Agents': ['Space Marines', 'Astra Militarum'],
};

const CHAPTERS = ['ultramarines', 'imperial fists', 'salamanders', 'raven guard', 'iron hands', 'white scars'];

/**
 * Trouve la faction mentionnée dans un texte. La plus longue l'emporte ("Chaos Space Marines" > "Space Marines"),
 * et un chapitre l'emporte sur "Space Marines" ("Space Marines / Dark Angels" → Dark Angels).
 */
export function detectFaction(text: string): string | null {
  const t = ` ${norm(text)} `;
  const hits = FACTION_KEYS.filter((f) => t.includes(` ${f.n} `)).sort((a, b) => b.n.length - a.n.length);
  const keys = hits.map((h) => h.key);
  const chapter = keys.find((k) => FACTION_FALLBACK[k]?.some((f) => keys.includes(f)));
  if (chapter) return chapter;
  if (!hits.length && CHAPTERS.some((c) => t.includes(` ${c} `))) return 'Space Marines';
  return hits[0]?.key ?? null;
}

/** Forme simplifiée pour rapprocher "Witchseeker Squad" de "Witchseekers" ou "Scout Squad ×5" de "Scout Squad". */
function simplify(s: string): string[] {
  return norm(s.replace(/[×x]\s*\d+\s*$/i, ''))
    .split(' ')
    .filter((w) => w && w !== 'squad' && w !== 'the')
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));
}

function findEntry(faction: string | null, unit: string): RawEntry | null {
  const n = norm(unit);
  const order = faction ? [faction, ...(FACTION_FALLBACK[faction] ?? [])] : [];
  const all = [...new Set([...order, ...Object.keys(BASES)])].filter((f) => BASES[f]);
  for (const f of all) for (const [name, entry] of Object.entries(BASES[f])) if (norm(name) === n) return entry;

  // Rapprochement approché, limité à la faction (et ses repli) quand elle est connue.
  const scope = (order.length ? order : all).filter((f) => BASES[f]);
  const candidates = scope.flatMap((f) => Object.entries(BASES[f]).map(([name, entry]) => ({ s: simplify(name), entry })));
  const q = simplify(unit);
  const qs = q.join(' ');
  const same = candidates.find((c) => c.s.join(' ') === qs);
  if (same) return same.entry;
  // "Eradicator Squad with melta rifles" → "Eradicator Squad", "Marneus Calgar" → "Marneus Calgar in Armour..."
  const prefix = candidates
    .filter((c) => { const cs = c.s.join(' '); return qs.startsWith(cs + ' ') || cs.startsWith(qs + ' '); })
    .sort((a, b) => b.s.length - a.s.length)[0];
  if (prefix) return prefix.entry;
  const jaccard = (a: string[], b: string[]) => a.filter((w) => b.includes(w)).length / new Set([...a, ...b]).size;
  const best = candidates.map((c) => ({ c, j: jaccard(q, c.s) })).sort((a, b) => b.j - a.j)[0];
  return best && best.j >= 0.6 ? best.c.entry : null;
}

function resolve(raw: RawBase, unitName: string): Base {
  switch (raw.shape) {
    case 'circle':
    case 'oval':
      return raw;
    case 'flying':
      return { shape: 'oval', ...FLYING[raw.size] };
    case 'hull': {
      const h = HULLS.find((x) => x.match.test(unitName)) ?? DEFAULT_HULL;
      return { shape: 'rect', w: h.l, h: h.w };
    }
  }
}

export type ModelBase = { base: Base; unknown: boolean };

/**
 * Socle d'une figurine. `variant` est le nom de la figurine ou d'un équipement :
 * l'Event Companion distingue p.ex. "Cthonian Beserks: Mole grenade launcher" (50mm) du reste de l'unité.
 */
export function baseFor(faction: string | null, unit: string, variant?: string): ModelBase {
  const entry = findEntry(faction, unit);
  if (!entry) return { base: { shape: 'circle', d: DEFAULT_BASE_MM }, unknown: true };
  if (variant && entry.models) {
    const v = norm(variant);
    for (const [k, b] of Object.entries(entry.models)) if (v === norm(k) || v.includes(norm(k))) return { base: resolve(b, unit), unknown: false };
  }
  const raw = entry.default ?? Object.values(entry.models ?? {})[0];
  return { base: resolve(raw!, unit), unknown: false };
}

/** Clés de variantes connues pour une unité (pour savoir si un équipement change le socle). */
export function variantKeys(faction: string | null, unit: string): string[] {
  return Object.keys(findEntry(faction, unit)?.models ?? {});
}

/** Encombrement en pouces (largeur, hauteur) d'un socle non pivoté. */
export function baseSizeIn(b: Base): { w: number; h: number } {
  if (b.shape === 'circle') return { w: b.d / MM_PER_INCH, h: b.d / MM_PER_INCH };
  return { w: b.w / MM_PER_INCH, h: b.h / MM_PER_INCH };
}
