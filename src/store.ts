import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import missionsData from './data/missions.json';
import { initials, parseList, type Army, type Unit, type UnitPart } from './lib/parseList';
import { baseSizeIn, type Base } from './lib/bases';
import { supabase } from './lib/supabase';
import { track } from './lib/track';

export type Side = 'me' | 'opp';
export type DispositionId = (typeof missionsData.dispositions)[number]['id'];
export type Mission = (typeof missionsData.missions)[number];

export const DISPOSITIONS = missionsData.dispositions;
export const BOARD_W = 44;
export const BOARD_H = 60;

export const DISPO_ABBR: Record<string, string> = {
  'take-and-hold': 'T&H',
  'purge-the-foe': 'PtF',
  disruption: 'Disru',
  reconnaissance: 'Reco',
  'priority-assets': 'PA',
};

/**
 * Couleurs d'armée proposées : vives et saturées, volontairement différentes des zones rouge / bleu
 * des cartes (#9a4a48 / #375063) pour que les socles ressortent même dans leur zone de déploiement.
 */
export const ARMY_COLORS = {
  red: { label: 'Rouge', fill: '#e8312a', ink: '#ffffff' },
  blue: { label: 'Bleu', fill: '#1e8cff', ink: '#ffffff' },
  yellow: { label: 'Jaune', fill: '#ffc21a', ink: '#1d1404' },
  green: { label: 'Vert', fill: '#2fbf4a', ink: '#06210d' },
  purple: { label: 'Violet', fill: '#a24dff', ink: '#ffffff' },
} as const;
export type ColorId = keyof typeof ARMY_COLORS;

export function missionFor(mine: string, opp: string): Mission {
  return missionsData.missions.find((m) => m.mine === mine && m.opponent === opp)!;
}

/** Position d'une figurine sur la table, en pouces depuis le coin haut-gauche ; rot en degrés. */
export type ModelPos = { x: number; y: number; rot: number };

/** Réglages d'une unité posée : figurines par rang, écart entre socles (pouces), rayon de zone affiché (pouces). */
export type UnitOpts = { perRow: number; gap: number; aura: number };

type ArmySlot = { text: string; army: Army };

/** Ce qui fait une bataille : sauvegardé tel quel dans la liste des batailles. */
type BattleData = {
  mine: DispositionId | null;
  opp: DispositionId | null;
  layout: number | null; // index 0..2 dans mission.boards
  armies: Partial<Record<Side, ArmySlot>>;
  placed: Record<string, ModelPos[]>; // par id d'unité
  unitOpts: Record<string, UnitOpts>;
  splits: Record<string, true>; // unités coupées en deux (ids des unités d'origine)
  colors: Record<Side, ColorId>;
  modelDelta: Record<string, number>; // socles ajoutés (+) ou retirés (-) à la main, par id d'unité
  detached: Record<string, number[]>; // composantes détachées d'une unité menée de la liste (indices)
  attached: Record<string, string>; // personnage attaché à la main → unité qu'il rejoint
  lines: RulerLine[]; // lignes tracées au crayon (mesures)
};

/** Ligne droite tracée sur la table, extrémités en pouces */
export type RulerLine = { id: string; a: { x: number; y: number }; b: { x: number; y: number } };

export type SavedBattle = BattleData & { id: string; name: string; savedAt: number };

export type View = 'home' | 'setup' | 'load' | 'battle' | 'guide';

type State = BattleData & {
  view: View;
  currentId: string | null; // bataille sauvegardée en cours d'édition
  currentName: string;
  battles: SavedBattle[];
  selected: string | null;
  showLabels: boolean;
  user: { id: string; email: string } | null; // joueur connecté (session gérée par Supabase)
  guest: boolean; // « Continuer sans compte » : batailles gardées sur cet appareil uniquement
  syncError: string | null;
  setGuest: (guest: boolean) => void;

  go: (view: View) => void;
  newBattle: () => void;
  setDispositions: (mine: DispositionId | null, opp: DispositionId | null) => void;
  setLayout: (i: number) => void;
  importList: (side: Side, text: string) => Army;
  clearList: (side: Side) => void;
  addUnit: (side: Side, name: string, count: number, base: Base) => void;
  addLine: (a: RulerLine['a'], b: RulerLine['b']) => void;
  removeLine: (id: string) => void;
  moveLineEnd: (id: string, end: 'a' | 'b', p: RulerLine['a']) => void;
  place: (unit: Unit, x: number, y: number) => void;
  move: (unitId: string, positions: ModelPos[]) => void;
  remove: (unitId: string) => void;
  select: (unitId: string | null) => void;
  toggleLabels: () => void;
  setUnitOpts: (unit: Unit, opts: Partial<UnitOpts>) => void;
  split: (unit: Unit) => void;
  merge: (unit: Unit) => void;
  setColor: (side: Side, color: ColorId) => void;
  addModel: (unitId: string) => void;
  removeModel: (unitId: string) => void;
  detachPart: (unitId: string, partIndex: number) => void;
  attach: (charId: string, targetId: string) => void;
  saveBattle: (name: string, asCopy?: boolean) => void;
  loadBattle: (id: string) => void;
  deleteBattle: (id: string) => void;
  setUser: (user: State['user']) => void;
  pullBattles: () => Promise<void>;
};

const EMPTY: BattleData = { mine: null, opp: null, layout: null, armies: {}, placed: {}, unitOpts: {}, splits: {}, colors: { me: 'red', opp: 'blue' }, modelDelta: {}, detached: {}, attached: {}, lines: [] };

/** Applique les socles ajoutés/retirés à la main : on ajoute la taille de socle la plus courante, on retire les derniers. */
export function adjust(unit: Unit, delta = 0): Unit {
  if (!delta) return unit;
  // Les socles ajoutés / retirés comptent pour la dernière composante (l'escouade, pas le personnage)
  const withCount = (models: Unit['models']): Unit => {
    const parts = partsOf(unit);
    const before = parts.slice(0, -1).reduce((n, p) => n + p.count, 0);
    return { ...unit, models, parts: [...parts.slice(0, -1), { ...parts.at(-1)!, count: Math.max(1, models.length - before) }] };
  };
  if (delta < 0) return withCount(unit.models.slice(0, Math.max(1, unit.models.length + delta)));
  const count = new Map<string, number>();
  for (const m of unit.models) count.set(JSON.stringify(m.base), (count.get(JSON.stringify(m.base)) ?? 0) + 1);
  const common = [...count].sort((a, b) => b[1] - a[1])[0][0];
  const model = unit.models.find((m) => JSON.stringify(m.base) === common)!;
  return withCount([...unit.models, ...Array(delta).fill(model)]);
}

/**
 * Coupe une unité en deux moitiés aussi égales que possible ; la plus grosse moitié garde les
 * premières figurines (dont le personnage qui mène l'unité) : 11 → 6 + 5.
 * Les ids des moitiés sont dérivés de celui de l'unité : "me-3" → "me-3.1" et "me-3.2".
 */
export function splitUnit(unit: Unit): [Unit, Unit] {
  const k = Math.ceil(unit.models.length / 2);
  const half = (n: 1 | 2, models: Unit['models']): Unit => {
    const id = `${unit.id}.${n}`, name = `${unit.name} ${n}`, label = unit.label + n;
    return { ...unit, id, name, label, models, parts: [{ src: id, name, label, count: models.length, character: false }] };
  };
  return [half(1, unit.models.slice(0, k)), half(2, unit.models.slice(k))];
}

export function defaultOpts(unit: Unit): UnitOpts {
  const n = unit.models.length;
  return { perRow: n <= 10 ? Math.min(n, 5) : Math.ceil(Math.sqrt(n * 1.6)), gap: 0, aura: 0 };
}

/**
 * Range les figurines en rangs de `perRow` (alignés à gauche), avec `gap` pouces entre socles,
 * centrées sur (x, y) et orientées selon `angle` (degrés).
 *
 * La grille suit la taille de socle la plus courante. Les socles d'une autre taille (personnage,
 * arme lourde…) prennent les coins de la formation, décalés vers l'extérieur pour toucher leurs
 * voisins : ils débordent sur le côté au lieu d'écarter tous les rangs.
 */
export function formation(unit: Unit, x: number, y: number, opts: UnitOpts, angle = 0): ModelPos[] {
  const n = unit.models.length;
  const gap = Math.max(opts.gap, 0.02); // "collés" : un liseré pour distinguer les socles
  const sizes = unit.models.map((m) => baseSizeIn(m.base));
  const key = (i: number) => `${sizes[i].w.toFixed(3)}x${sizes[i].h.toFixed(3)}`;
  const freq = new Map<string, number>();
  for (let i = 0; i < n; i++) freq.set(key(i), (freq.get(key(i)) ?? 0) + 1);
  const mainKey = [...freq].sort((a, b) => b[1] - a[1])[0][0];
  const mainIdx = [...Array(n).keys()].filter((i) => key(i) === mainKey);
  const oddIdx = [...Array(n).keys()].filter((i) => key(i) !== mainKey);
  const main = sizes[mainIdx[0]];
  const pX = main.w + gap, pY = main.h + gap;
  const radius = (s: { w: number; h: number }) => Math.max(s.w, s.h) / 2;

  // Grille des emplacements (figurines principales + socles différents placés aux coins)
  const S0 = mainIdx.length + oddIdx.length;
  const cols0 = Math.max(1, Math.min(opts.perRow, S0));
  const rows0 = Math.ceil(S0 / cols0);
  const lastLen0 = S0 - (rows0 - 1) * cols0;
  const cornerCells: { r: number; c: number; sx: number; sy: number }[] = [];
  for (const cc of [
    { r: 0, c: 0, sx: -1, sy: -1 },
    { r: 0, c: cols0 - 1, sx: 1, sy: -1 },
    { r: rows0 - 1, c: 0, sx: -1, sy: 1 },
    { r: rows0 - 1, c: lastLen0 - 1, sx: 1, sy: 1 },
  ]) if (!cornerCells.some((o) => o.r === cc.r && o.c === cc.c)) cornerCells.push(cc);
  const cornerOdds = oddIdx.slice(0, cornerCells.length);
  const extraOdds = oddIdx.slice(cornerCells.length); // trop de socles différents : rang à part en dessous

  const S = mainIdx.length + cornerOdds.length;
  const cols = Math.max(1, Math.min(opts.perRow, S));
  const rows = Math.ceil(S / cols);
  const lastLen = S - (rows - 1) * cols;
  const rowLen = (r: number) => (r === rows - 1 ? lastLen : cols);
  const exists = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < rowLen(r);
  const cell = (r: number, c: number) => ({ x: (c - (cols - 1) / 2) * pX, y: (r - (rows - 1) / 2) * pY });

  const local: { x: number; y: number }[] = new Array(n);
  const corners = cornerCells.filter((cc) => exists(cc.r, cc.c)).slice(0, cornerOdds.length);
  const taken = new Set<string>();
  corners.forEach((cc, k) => {
    const i = cornerOdds[k];
    const D = radius(sizes[i]) + radius(main) + gap; // distance centre à centre pour toucher un voisin
    const hasH = exists(cc.r, cc.c - cc.sx), hasV = exists(cc.r - cc.sy, cc.c);
    const p = (pX + pY) / 2;
    let ox = 0, oy = 0;
    if (hasH && hasV) {
      // décalage diagonal d tel que la distance aux deux voisins vaille D : (p+d)² + d² = D²
      const d = Math.max(-p / 2, (-p + Math.sqrt(Math.max(0, 2 * D * D - p * p))) / 2);
      ox = cc.sx * d; oy = cc.sy * d;
    } else if (hasH) ox = cc.sx * (D - pX);
    else if (hasV) oy = cc.sy * (D - pY);
    const c0 = cell(cc.r, cc.c);
    local[i] = { x: c0.x + ox, y: c0.y + oy };
    taken.add(`${cc.r},${cc.c}`);
  });
  // Socles d'angle en trop (cas rare) : ils rejoignent le rang à part
  extraOdds.push(...cornerOdds.slice(corners.length));

  let m = 0;
  for (let r = 0; r < rows && m < mainIdx.length; r++) {
    for (let c = 0; c < rowLen(r) && m < mainIdx.length; c++) {
      if (taken.has(`${r},${c}`)) continue;
      local[mainIdx[m++]] = cell(r, c);
    }
  }

  let ex = -((cols - 1) / 2) * pX - main.w / 2;
  const ey = ((rows - 1) / 2) * pY + main.h / 2 + gap;
  for (const i of extraOdds) {
    local[i] = { x: ex + sizes[i].w / 2, y: ey + sizes[i].h / 2 };
    ex += sizes[i].w + gap;
  }

  const a = (angle * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  return local.map((p) => ({ x: x + p.x * cos - p.y * sin, y: y + p.x * sin + p.y * cos, rot: angle }));
}

/** Enregistre (ou met à jour) une bataille dans le compte du joueur connecté */
async function pushBattle(b: SavedBattle) {
  if (!useStore.getState().user) return;
  const { error } = await supabase.from('battles').upsert({
    id: b.id, name: b.name, data: battleData(b), saved_at: new Date(b.savedAt).toISOString(),
  });
  useStore.setState({ syncError: error ? error.message : null });
}

const battleData = (s: BattleData): BattleData => ({
  mine: s.mine, opp: s.opp, layout: s.layout, armies: s.armies, placed: s.placed, unitOpts: s.unitOpts, splits: s.splits ?? {}, colors: s.colors ?? EMPTY.colors, modelDelta: s.modelDelta ?? {},
  detached: s.detached ?? {}, attached: s.attached ?? {}, lines: s.lines ?? [],
});

const withoutSide = <T,>(rec: Record<string, T>, side: Side) =>
  Object.fromEntries(Object.entries(rec).filter(([id]) => !id.startsWith(side + '-')));

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      view: 'home',
      currentId: null,
      currentName: '',
      battles: [],
      selected: null,
      showLabels: false,
      user: null,
      guest: false,
      syncError: null,
      setGuest: (guest) => set({ guest }),

      go: (view) => {
        if (view === 'guide') track('guide');
        set({ view, selected: null });
      },
      newBattle: () => set({ ...EMPTY, currentId: null, currentName: '', view: 'setup', selected: null }),
      setDispositions: (mine, opp) => set({ mine, opp }),
      setLayout: (layout) => {
        const { mine, opp } = get();
        if (mine && opp) track('battle_start', `${DISPO_ABBR[mine]} vs ${DISPO_ABBR[opp]} #${layout + 1}`);
        set({ layout, view: 'battle', selected: null });
      },
      importList: (side, text) => {
        const army = parseList(text, side);
        track('list_import', side);
        set({
          armies: { ...get().armies, [side]: { text, army } },
          placed: withoutSide(get().placed, side),
          unitOpts: withoutSide(get().unitOpts, side),
          splits: withoutSide(get().splits, side),
          detached: withoutSide(get().detached, side),
          attached: withoutSide(get().attached, side),
          modelDelta: withoutSide(get().modelDelta, side),
          selected: null,
        });
        return army;
      },
      clearList: (side) => {
        const armies = { ...get().armies };
        delete armies[side];
        set({ armies, placed: withoutSide(get().placed, side), unitOpts: withoutSide(get().unitOpts, side), splits: withoutSide(get().splits, side), modelDelta: withoutSide(get().modelDelta, side), detached: withoutSide(get().detached, side), attached: withoutSide(get().attached, side), selected: null });
      },
      addLine: (a, b) => set({ lines: [...(get().lines ?? []), { id: crypto.randomUUID(), a, b }] }),
      removeLine: (id) => set({ lines: (get().lines ?? []).filter((l) => l.id !== id) }),
      moveLineEnd: (id, end, p) => set({ lines: (get().lines ?? []).map((l) => (l.id === id ? { ...l, [end]: p } : l)) }),
      addUnit: (side, name, count, base) => {
        // Unité créée à la main : ajoutée à la liste importée (ou à une liste vide s'il n'y en a pas)
        const slot = get().armies[side] ?? { text: '', army: { name: 'Liste manuelle', faction: null, units: [], warnings: [] } };
        const id = `${side}-m${crypto.randomUUID().slice(0, 8)}`, label = initials(name);
        const unit: Unit = {
          id, name, label,
          models: Array.from({ length: count }, () => ({ base, unknown: false })),
          parts: [{ src: id, name, label, count, character: false }],
        };
        set({ armies: { ...get().armies, [side]: { ...slot, army: { ...slot.army, units: [...slot.army.units, unit] } } } });
      },
      place: (unit, x, y) => {
        const opts = get().unitOpts[unit.id] ?? defaultOpts(unit);
        set({
          placed: { ...get().placed, [unit.id]: formation(unit, x, y, opts) },
          unitOpts: { ...get().unitOpts, [unit.id]: opts },
          selected: unit.id,
        });
      },
      move: (unitId, positions) => set({ placed: { ...get().placed, [unitId]: positions } }),
      remove: (unitId) => {
        const placed = { ...get().placed };
        delete placed[unitId];
        set({ placed, selected: get().selected === unitId ? null : get().selected });
      },
      select: (selected) => set({ selected }),
      toggleLabels: () => set({ showLabels: !get().showLabels }),
      setUnitOpts: (unit, patch) => {
        const prev = get().unitOpts[unit.id] ?? defaultOpts(unit);
        const opts = { ...prev, ...patch };
        const ps = get().placed[unit.id];
        const unitOpts = { ...get().unitOpts, [unit.id]: opts };
        // Changer le rang ou l'écart reforme l'unité autour de son centre, dans son orientation actuelle.
        if (ps && (patch.perRow !== undefined || patch.gap !== undefined)) {
          const cx = ps.reduce((s, p) => s + p.x, 0) / ps.length;
          const cy = ps.reduce((s, p) => s + p.y, 0) / ps.length;
          set({ unitOpts, placed: { ...get().placed, [unit.id]: formation(unit, cx, cy, opts, ps[0].rot) } });
        } else {
          set({ unitOpts });
        }
      },
      split: (unit) => {
        const s = get();
        const [a, b] = splitUnit(unit);
        const placed = { ...s.placed };
        const unitOpts = { ...s.unitOpts };
        const opts = s.unitOpts[unit.id];
        // Une unité déjà sur la table est coupée sur place : chaque moitié garde ses positions.
        const ps = placed[unit.id];
        if (ps) {
          placed[a.id] = ps.slice(0, a.models.length);
          placed[b.id] = ps.slice(a.models.length);
          delete placed[unit.id];
        }
        for (const half of [a, b]) unitOpts[half.id] = { ...defaultOpts(half), aura: opts?.aura ?? 0 };
        set({ placed, unitOpts, splits: { ...s.splits, [unit.id]: true }, selected: ps ? a.id : s.selected });
      },
      merge: (unit) => {
        const s = get();
        const [a, b] = splitUnit(unit);
        const placed = { ...s.placed };
        const unitOpts = { ...s.unitOpts };
        // Si les deux moitiés sont posées, l'unité réunie garde toutes les positions ; sinon elle revient dans la liste.
        if (placed[a.id] && placed[b.id]) placed[unit.id] = [...placed[a.id], ...placed[b.id]];
        for (const id of [a.id, b.id]) { delete placed[id]; delete unitOpts[id]; }
        const splits = { ...s.splits };
        delete splits[unit.id];
        // Les socles ajoutés/retirés sur les moitiés reviennent à l'unité réunie
        const modelDelta = { ...s.modelDelta };
        const d = (modelDelta[a.id] ?? 0) + (modelDelta[b.id] ?? 0);
        delete modelDelta[a.id]; delete modelDelta[b.id];
        if (d) modelDelta[unit.id] = (modelDelta[unit.id] ?? 0) + d;
        set({ placed, unitOpts, splits, modelDelta, selected: null });
      },
      addModel: (unitId) => {
        const s = get();
        const info = findUnit(s, unitId);
        if (!info) return;
        const modelDelta = { ...s.modelDelta, [unitId]: (s.modelDelta[unitId] ?? 0) + 1 };
        const ps = s.placed[unitId];
        if (!ps) return set({ modelDelta });
        // Reforme l'unité (même centre, même orientation) pour y caser le nouveau socle
        const unit = adjust(info.unit, 1);
        const cx = ps.reduce((t, p) => t + p.x, 0) / ps.length, cy = ps.reduce((t, p) => t + p.y, 0) / ps.length;
        const opts = s.unitOpts[unitId] ?? defaultOpts(unit);
        set({ modelDelta, placed: { ...s.placed, [unitId]: formation(unit, cx, cy, opts, ps[0].rot) } });
      },
      removeModel: (unitId) => {
        const s = get();
        const info = findUnit(s, unitId);
        if (!info || info.unit.models.length <= 1) return;
        const modelDelta = { ...s.modelDelta, [unitId]: (s.modelDelta[unitId] ?? 0) - 1 };
        const ps = s.placed[unitId];
        set({ modelDelta, ...(ps ? { placed: { ...s.placed, [unitId]: ps.slice(0, -1) } } : {}) });
      },
      detachPart: (unitId, partIndex) => {
        const s = get();
        const info = findUnit(s, unitId);
        const part = info && partsOf(info.unit)[partIndex];
        if (!info || !part || partsOf(info.unit).length < 2) return;
        const next = { ...s };
        if (part.attachedAs) {
          // Personnage attaché dans l'app : il redevient indépendant
          next.attached = { ...s.attached };
          delete next.attached[part.attachedAs];
        } else {
          // Composante d'une unité menée de la liste : "me-3#1" → détacher l'indice 1 de "me-3"
          const [gid, k] = part.src.split('#');
          next.detached = { ...s.detached, [gid]: [...(s.detached[gid] ?? []), +k] };
        }
        const before = resolvedUnits(s.armies[info.side]?.army, s);
        const after = resolvedUnits(s.armies[info.side]?.army, next);
        set({ detached: next.detached, attached: next.attached, ...remapPlaced(before, after, s), selected: null });
      },
      attach: (charId, targetId) => {
        const s = get();
        const side = findUnit(s, charId)?.side;
        if (!side || charId === targetId || findUnit(s, targetId)?.side !== side) return;
        const attached = { ...s.attached, [charId]: targetId };
        const before = resolvedUnits(s.armies[side]?.army, s);
        const after = resolvedUnits(s.armies[side]?.army, { ...s, attached });
        set({ attached, ...remapPlaced(before, after, s), selected: null });
      },
      setColor: (side, color) => set({ colors: { ...get().colors, [side]: color } }),
      saveBattle: (name, asCopy = false) => {
        const s = get();
        const id = (!asCopy && s.currentId) || crypto.randomUUID();
        const saved: SavedBattle = { ...battleData(s), id, name, savedAt: Date.now() };
        set({ battles: [saved, ...s.battles.filter((b) => b.id !== id)], currentId: id, currentName: name });
        void pushBattle(saved);
        track('battle_save');
      },
      loadBattle: (id) => {
        const b = get().battles.find((x) => x.id === id);
        if (!b) return;
        track('battle_load');
        set({ ...battleData({ ...EMPTY, ...b }), currentId: b.id, currentName: b.name, view: 'battle', selected: null });
      },
      deleteBattle: (id) => {
        const s = get();
        set({ battles: s.battles.filter((b) => b.id !== id), ...(s.currentId === id ? { currentId: null } : {}) });
        if (s.user) void supabase.from('battles').delete().eq('id', id).then(({ error }) => error && set({ syncError: error.message }));
      },
      setUser: (user) => {
        const prev = get().user;
        if (prev && user?.id !== prev.id) {
          // Changement de joueur sur cet appareil : on ne garde rien du précédent
          set({ ...EMPTY, battles: [], currentId: null, currentName: '', view: 'home', selected: null });
        }
        // Connexion depuis le mode sans compte : les batailles de l'appareil rejoignent le compte (cf. pullBattles)
        set(user ? { user, guest: false } : { user });
      },
      pullBattles: async () => {
        const { data, error } = await supabase.from('battles').select('id, name, data, saved_at');
        if (error) { set({ syncError: error.message }); return; }
        const remote: SavedBattle[] = data.map((r) => ({
          ...EMPTY, ...(r.data as BattleData), id: r.id, name: r.name, savedAt: Date.parse(r.saved_at),
        }));
        // Les batailles créées sur cet appareil avant la connexion sont envoyées au compte
        const local = get().battles.filter((b) => !remote.some((r) => r.id === b.id));
        for (const b of local) void pushBattle(b);
        set({ battles: [...remote, ...local].sort((a, b) => b.savedAt - a.savedAt), syncError: null });
      },
    }),
    {
      name: 'deploy40k-v1',
      version: 2,
      partialize: (s) => ({
        ...battleData(s), view: s.view, currentId: s.currentId, currentName: s.currentName, battles: s.battles, showLabels: s.showLabels, guest: s.guest,
      }),
      // v1 : pas de vue ni de batailles sauvegardées ; on reprend la bataille en cours si elle existait.
      migrate: (old) => {
        const s = old as Partial<State>;
        return { ...s, unitOpts: s.unitOpts ?? {}, splits: s.splits ?? {}, colors: s.colors ?? EMPTY.colors, modelDelta: s.modelDelta ?? {}, detached: s.detached ?? {}, attached: s.attached ?? {}, lines: s.lines ?? [], battles: s.battles ?? [], view: s.layout != null ? 'battle' : 'home' } as State;
      },
    },
  ),
);

export const asset = (p: string) => `${import.meta.env.BASE_URL}assets/${p}`;

/** Ce qui détermine les unités jouées à partir de la liste importée */
export type Roster = Pick<BattleData, 'armies' | 'splits' | 'modelDelta' | 'detached' | 'attached'>;

/** Composantes d'une unité (les listes importées avant cette fonctionnalité n'en ont pas) */
export function partsOf(u: Unit): UnitPart[] {
  if (u.parts) return u.parts;
  // Liste importée avant : un personnage est deviné (une seule figurine sur socle rond d'infanterie)
  const b = u.models[0]?.base;
  const character = u.models.length === 1 && b?.shape === 'circle' && b.d <= 60;
  return [{ src: u.id, name: u.name, label: u.label, count: u.models.length, character }];
}

/** Sous-unité faite de certaines composantes d'une unité (figurines dans le même ordre) */
function subUnit(u: Unit, indices: number[], id: string): Unit {
  const parts = partsOf(u);
  const offsets = parts.map((_, k) => parts.slice(0, k).reduce((n, p) => n + p.count, 0));
  const chosen = indices.map((k) => parts[k]);
  return {
    id,
    name: chosen.map((p) => p.name).join(' + '),
    label: chosen.at(-1)!.label,
    models: indices.flatMap((k) => u.models.slice(offsets[k], offsets[k] + parts[k].count)),
    parts: chosen,
  };
}

/**
 * Unités telles que jouées (avant split) : composantes détachées d'une unité menée de la liste,
 * personnages attachés à la main, socles ajoutés ou retirés.
 *   détachée : la k-ième composante de "me-3" devient l'unité "me-3~k"
 *   attachée : le personnage disparaît de la liste et rejoint l'unité cible (il passe en tête)
 */
export function resolvedUnits(army: Army | undefined, r: Roster): Unit[] {
  let units: Unit[] = [];
  for (const u of army?.units ?? []) {
    const parts = partsOf(u);
    const off = (r.detached?.[u.id] ?? []).filter((k) => k < parts.length);
    const keep = parts.map((_, k) => k).filter((k) => !off.includes(k));
    if (!off.length || !keep.length) { units.push(u); continue; }
    units.push(subUnit(u, keep, u.id), ...off.map((k) => subUnit(u, [k], `${u.id}~${k}`)));
  }
  for (const [charId, targetId] of Object.entries(r.attached ?? {})) {
    const char = units.find((u) => u.id === charId), target = units.find((u) => u.id === targetId);
    if (!char || !target || char === target) continue;
    const merged: Unit = {
      ...target,
      name: `${char.name} + ${target.name}`,
      models: [...char.models, ...target.models],
      parts: [...partsOf(char).map((p) => ({ ...p, attachedAs: charId })), ...partsOf(target)],
    };
    units = units.filter((u) => u !== char).map((u) => (u === target ? merged : u));
  }
  return units.map((u) => adjust(u, r.modelDelta?.[u.id]));
}

/** Unités à déployer d'une armée : une unité coupée compte pour ses deux moitiés. */
export function deployableUnits(army: Army | undefined, r: Roster): Unit[] {
  return resolvedUnits(army, r).flatMap((u) => (r.splits?.[u.id] ? splitUnit(u).map((h) => adjust(h, r.modelDelta?.[h.id])) : [u]));
}

export function findUnit(r: Roster, unitId: string): { unit: Unit; side: Side } | null {
  for (const side of ['me', 'opp'] as const) {
    const unit = deployableUnits(r.armies[side]?.army, r).find((u) => u.id === unitId);
    if (unit) return { unit, side };
  }
  return null;
}

/**
 * Après un attache / détache : chaque nouvelle unité reprend les positions de ses composantes là où
 * elles étaient sur la table. Une unité dont une partie seulement était posée est reformée autour de cette partie.
 */
function remapPlaced(before: Unit[], after: Unit[], s: BattleData): Pick<BattleData, 'placed' | 'unitOpts'> {
  const bySrc = new Map<string, ModelPos[]>();
  for (const u of before) {
    const ps = s.placed[u.id];
    if (!ps) continue;
    let i = 0;
    partsOf(u).forEach((p, k, all) => {
      const n = k === all.length - 1 ? ps.length - i : p.count; // socles ajoutés à la main : sur la dernière composante
      bySrc.set(p.src, ps.slice(i, i + n));
      i += n;
    });
  }
  const placed = { ...s.placed };
  const unitOpts = { ...s.unitOpts };
  for (const u of before) delete placed[u.id];
  for (const u of after) {
    const found = partsOf(u).map((p) => bySrc.get(p.src));
    if (found.every((f) => !f)) continue;
    if (found.every(Boolean) && found.flat().length === u.models.length) { placed[u.id] = found.flat() as ModelPos[]; continue; }
    const ps = found.filter(Boolean).flat() as ModelPos[];
    const cx = ps.reduce((t, p) => t + p.x, 0) / ps.length, cy = ps.reduce((t, p) => t + p.y, 0) / ps.length;
    unitOpts[u.id] = defaultOpts(u);
    placed[u.id] = formation(u, cx, cy, unitOpts[u.id], ps[0].rot);
  }
  return { placed, unitOpts };
}

export const layoutLabel = (layout: number) => `Carte ${layout + 1}`;
