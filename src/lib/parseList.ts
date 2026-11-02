// Lecture d'une liste d'armée texte : export de l'app officielle Warhammer 40,000 ou de NewRecruit.
// On ne garde que les unités, leurs figurines (nombre + socle) et les personnages attachés.
import { baseFor, detectFaction, norm, variantKeys, type Base } from './bases';

export type Model = { base: Base; unknown: boolean };

export type Unit = {
  id: string;
  name: string; // "Kâhl + Einhyr Hearthguard" pour une unité menée
  label: string; // initiales affichées sur les socles
  models: Model[];
};

export type Army = { name: string; faction: string | null; units: Unit[]; warnings: string[] };

type RawLine = { count: number; name: string; children: { count: number; name: string }[]; sure?: boolean };
type RawUnit = {
  name: string;
  lines: RawLine[];
  group?: number; // app officielle : "Attached unit N"
  leading?: string; // NewRecruit : "Leading: X"
  leaders: string[]; // NewRecruit : "Leader: X"
};

const BULLET = /^(\s*)[•◦▪\-*]\s*(.*)$/;
const COUNT = /^(\d+)\s*x\s+(.+)$/i;
const CAPS_HEADER = /^[A-Z][A-Z &'’-]+$/;

// "Cthonian Beserks[1]", "10x Wyches", "Char4: Hyperadapted Raveners" → nom de l'unité seul
const cleanName = (s: string) => s.replace(/\[\d+\]$/, '').replace(/^Char\d+:\s*/i, '').replace(/^\d+\s*x\s+/i, '').trim();

export function initials(name: string): string {
  const words = name.split(/[\s+-]+/).filter((w) => /^\p{L}/u.test(w));
  if (words.length <= 1) return (words[0] ?? '?').slice(0, 1).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Une ligne "Nx Truc" sans sous-ligne est une figurine seulement si elle ressemble au nom de l'unité. */
function looksLikeModel(line: string, unit: string): boolean {
  const a = norm(line).replace(/s\b/g, '');
  const b = norm(unit).replace(/s\b/g, '');
  return b.includes(a) || a.includes(b) || a.split(' ')[0] === b.split(' ')[0];
}

type Item = { count: number; name: string; kind: 'bullet' | 'sub' | 'bare' };

/**
 * App officielle. Deux mises en forme existent pour les figurines et leur équipement :
 *   indentée :  "• 9x Hearthkyn Warrior" puis "◦ 7x Ion blaster" (sous-puces)
 *   aplatie  :  "• 2x Outrider" puis "• 2x Chainsword" puis "2x Heavy Bolt Pistol" (sans puce)
 * Dans la version aplatie, une puce suivie de lignes sans puce ouvre l'équipement de la figurine précédente.
 */
/** isCompanion : figurine listée à part dans l'Event Companion pour cette unité (E-COG, CORV, Ironkin Assistant…) */
function classify(items: Item[], unitName: string, isCompanion: (name: string) => boolean): RawLine[] {
  const out: RawLine[] = [];
  const flat = !items.some((it) => it.kind === 'sub');
  let prevWasModel = false;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind !== 'bullet') {
      out.at(-1)?.children.push(it);
      prevWasModel = false;
      continue;
    }
    const next = items[i + 1]?.kind, next2 = items[i + 2]?.kind;
    let model: boolean;
    if (next === 'sub') model = true;
    else if (next === 'bare') model = false;
    else if (flat && prevWasModel) model = false; // aplatie : la puce qui suit une figurine est sa 1re arme
    else if (next === 'bullet' && (next2 === 'bare' || next2 === 'sub')) model = true;
    else if (isCompanion(it.name)) model = true;
    else if (looksLikeModel(it.name, unitName)) model = true;
    else model = false;
    if (model) out.push({ count: it.count, name: it.name, children: [], sure: true });
    else if (prevWasModel || out.length) out.at(-1)?.children.push(it);
    prevWasModel = model;
  }
  return out;
}

function parseOfficial(lines: string[], faction: string | null): RawUnit[] {
  const units: { unit: RawUnit; items: Item[] }[] = [];
  let group: number | undefined;
  let cur: { unit: RawUnit; items: Item[] } | null = null;
  let first = true;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const isTitle = first;
    first = false;
    if (/^attached units:?$/i.test(t) || CAPS_HEADER.test(t) || /^[\p{L} ]+:$/u.test(t)) {
      group = undefined;
      cur = null;
      continue;
    }
    const g = t.match(/^Attached unit (\d+)$/i);
    if (g) { group = +g[1]; continue; }
    const u = line.match(/^(\S.*?)\s*\((\d[\d,]*)\s*(?:Points|pts)\)\s*$/i);
    if (u) {
      // Le titre de la liste et le format de partie ("Strike Force (2000 points)") ne sont pas des unités.
      if (isTitle || /^(strike force|incursion|onslaught|combat patrol|battle size|force de frappe|fuerza de choque)\b/i.test(u[1])) { cur = null; continue; }
      cur = { unit: { name: cleanName(u[1]), lines: [], group, leaders: [] }, items: [] };
      units.push(cur);
      continue;
    }
    if (!cur) continue;
    const b = line.match(BULLET);
    const c = (b ? b[2] : t).match(COUNT);
    if (!c) continue;
    const kind = !b ? 'bare' : line.includes('◦') ? 'sub' : 'bullet';
    cur.items.push({ count: +c[1], name: c[2].trim(), kind });
  }
  for (const u of units) {
    const keys = variantKeys(faction, u.unit.name).map(norm);
    u.unit.lines = classify(u.items, u.unit.name, (name) => keys.includes(norm(name)));
  }
  return units.map((u) => u.unit);
}

function parseNewRecruit(lines: string[]): RawUnit[] {
  const units: RawUnit[] = [];
  let cur: RawUnit | null = null;
  let first = true;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const u = line.match(/^(\S.*?)\s*\[(\d[\d,]*)\s*pts\]:?\s*(.*)$/i);
    if (u) {
      if (first) { first = false; continue; } // titre de la liste
      cur = { name: cleanName(u[1]), lines: [], leaders: [] };
      units.push(cur);
      continue;
    }
    first = false;
    const b = line.match(BULLET);
    if (!b || !cur) continue;
    const text = b[2].trim();
    let m;
    if ((m = text.match(/^Leading:\s*(.+)$/i))) { cur.leading = cleanName(m[1]); continue; }
    if ((m = text.match(/^Leaders?:\s*(.+)$/i))) { cur.leaders.push(...m[1].split(',').map(cleanName)); continue; }
    const c = text.match(COUNT);
    if (!c) continue;
    const [model, gear] = c[2].split(/\s+w\/\s+/);
    const item = { count: +c[1], name: model.trim() };
    if (b[1].length > 0 && cur.lines.length) {
      cur.lines.at(-1)!.children.push(item); // équipement indenté sous une figurine
    } else {
      cur.lines.push({ ...item, children: gear ? [{ count: +c[1], name: gear }] : [], sure: true }); // NewRecruit ne liste que des figurines au premier niveau
    }
  }
  return units;
}

/** Figurines d'une unité : socle par défaut, sauf variantes (figurine ou équipement) listées dans l'Event Companion. */
function buildModels(faction: string | null, u: RawUnit): Model[] {
  let lines = u.lines.filter((l) => l.sure || l.children.length > 0 || looksLikeModel(l.name, u.name));
  const keys = variantKeys(faction, u.name).map(norm);
  // Seuls des compagnons listés ("4x E-COG") : le personnage lui-même est implicite
  if (lines.length && lines.every((l) => keys.includes(norm(l.name))) && !lines.some((l) => looksLikeModel(l.name, u.name))) {
    lines = [{ count: 1, name: u.name, children: [] }, ...lines];
  }
  if (!lines.length) lines = [{ count: 1, name: u.name, children: [] }];
  const models: Model[] = [];
  for (const l of lines) {
    let remaining = l.count;
    if (!keys.some((k) => norm(l.name).includes(k))) {
      for (const ch of l.children) {
        if (!keys.some((k) => norm(ch.name).includes(k))) continue;
        const n = Math.min(ch.count, remaining);
        for (let i = 0; i < n; i++) models.push(baseFor(faction, u.name, ch.name));
        remaining -= n;
      }
    }
    for (let i = 0; i < remaining; i++) models.push(baseFor(faction, u.name, l.name));
  }
  return models;
}

export function parseList(text: string, prefix: string): Army {
  const lines = text.replace(/\r/g, '').split('\n');
  const nonEmpty = lines.filter((l) => l.trim());
  const isNewRecruit = nonEmpty.some((l) => /\[\d[\d,]*\s*pts\]/i.test(l));
  const header = nonEmpty.slice(0, 6).join(' ');
  const faction = detectFaction(header);
  const raw = isNewRecruit ? parseNewRecruit(lines) : parseOfficial(lines, faction);
  const warnings: string[] = [];
  if (!faction) warnings.push('Faction non reconnue : recherche des socles dans toutes les factions.');
  if (!raw.length) warnings.push("Aucune unité trouvée : vérifie le format (app officielle ou NewRecruit).");

  // Regroupe personnages + gardes du corps en une seule unité à déployer.
  const groups: RawUnit[][] = [];
  const used = new Set<RawUnit>();
  if (isNewRecruit) {
    for (const u of raw.filter((r) => r.leaders.length)) {
      const g = [u];
      for (const name of u.leaders) {
        const leader = raw.find((r) => !used.has(r) && r !== u && r.leading && norm(r.name) === norm(name) && norm(r.leading) === norm(u.name));
        if (leader) { used.add(leader); g.unshift(leader); }
      }
      used.add(u);
      groups.push(g);
    }
  } else {
    const byGroup = new Map<number, RawUnit[]>();
    for (const u of raw) if (u.group !== undefined) { byGroup.set(u.group, [...(byGroup.get(u.group) ?? []), u]); used.add(u); }
    groups.push(...byGroup.values());
  }
  for (const u of raw) if (!used.has(u)) groups.push([u]);
  // Ordre de la liste d'origine
  groups.sort((a, b) => raw.indexOf(a[a.length - 1]) - raw.indexOf(b[b.length - 1]));

  const units: Unit[] = groups.map((g, i) => {
    const name = g.map((u) => u.name).join(' + ');
    const unknown = g.filter((u) => buildModels(faction, u).some((m) => m.unknown)).map((u) => u.name);
    if (unknown.length) warnings.push(`Socle inconnu (32mm par défaut) : ${unknown.join(', ')}`);
    return {
      id: `${prefix}-${i}`,
      name,
      label: initials(g[g.length - 1].name),
      models: g.flatMap((u) => buildModels(faction, u)),
    };
  });

  // "Mercovenant v2 (2,000 Points)" ou "Xenos - Leagues of Votann - Mercovenant v2 - [2000 pts]"
  const title = nonEmpty[0]?.replace(/\s*[([].*$/, '').replace(/\s*-$/, '').replace(/^.*\s-\s/, '').trim() ?? 'Armée';
  return { name: title || 'Armée', faction, units, warnings };
}
