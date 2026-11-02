import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import missionsData from './data/missions.json';
import { parseList, type Army, type Unit } from './lib/parseList';
import { baseSizeIn } from './lib/bases';
import { supabase } from './lib/supabase';

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

/** Couleurs d'armée proposées ; rouge et bleu reprennent les zones attaquant / défenseur des cartes. */
export const ARMY_COLORS = {
  red: { label: 'Rouge', fill: '#9a4a48', ink: '#fff4ef' },
  blue: { label: 'Bleu', fill: '#375063', ink: '#eef5ff' },
  yellow: { label: 'Jaune', fill: '#d4a52c', ink: '#1d1404' },
  green: { label: 'Vert', fill: '#4f8a3c', ink: '#f2fbea' },
  purple: { label: 'Violet', fill: '#8a4fc0', ink: '#f6eeff' },
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
};

export type SavedBattle = BattleData & { id: string; name: string; savedAt: number };

export type View = 'home' | 'setup' | 'load' | 'battle';

type State = BattleData & {
  view: View;
  currentId: string | null; // bataille sauvegardée en cours d'édition
  currentName: string;
  battles: SavedBattle[];
  selected: string | null;
  showLabels: boolean;
  user: { id: string; email: string } | null; // joueur connecté (session gérée par Supabase)
  syncError: string | null;

  go: (view: View) => void;
  newBattle: () => void;
  setDispositions: (mine: DispositionId | null, opp: DispositionId | null) => void;
  setLayout: (i: number) => void;
  importList: (side: Side, text: string) => Army;
  clearList: (side: Side) => void;
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
  saveBattle: (name: string, asCopy?: boolean) => void;
  loadBattle: (id: string) => void;
  deleteBattle: (id: string) => void;
  setUser: (user: State['user']) => void;
  pullBattles: () => Promise<void>;
};

const EMPTY: BattleData = { mine: null, opp: null, layout: null, armies: {}, placed: {}, unitOpts: {}, splits: {}, colors: { me: 'red', opp: 'blue' }, modelDelta: {} };

/** Applique les socles ajoutés/retirés à la main : on ajoute la taille de socle la plus courante, on retire les derniers. */
export function adjust(unit: Unit, delta = 0): Unit {
  if (!delta) return unit;
  if (delta < 0) return { ...unit, models: unit.models.slice(0, Math.max(1, unit.models.length + delta)) };
  const count = new Map<string, number>();
  for (const m of unit.models) count.set(JSON.stringify(m.base), (count.get(JSON.stringify(m.base)) ?? 0) + 1);
  const common = [...count].sort((a, b) => b[1] - a[1])[0][0];
  const model = unit.models.find((m) => JSON.stringify(m.base) === common)!;
  return { ...unit, models: [...unit.models, ...Array(delta).fill(model)] };
}

/**
 * Coupe une unité en deux moitiés aussi égales que possible ; la plus grosse moitié garde les
 * premières figurines (dont le personnage qui mène l'unité) : 11 → 6 + 5.
 * Les ids des moitiés sont dérivés de celui de l'unité : "me-3" → "me-3.1" et "me-3.2".
 */
export function splitUnit(unit: Unit): [Unit, Unit] {
  const k = Math.ceil(unit.models.length / 2);
  return [
    { ...unit, id: unit.id + '.1', name: unit.name + ' 1', label: unit.label + '1', models: unit.models.slice(0, k) },
    { ...unit, id: unit.id + '.2', name: unit.name + ' 2', label: unit.label + '2', models: unit.models.slice(k) },
  ];
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
      syncError: null,

      go: (view) => set({ view, selected: null }),
      newBattle: () => set({ ...EMPTY, currentId: null, currentName: '', view: 'setup', selected: null }),
      setDispositions: (mine, opp) => set({ mine, opp }),
      setLayout: (layout) => set({ layout, view: 'battle', selected: null }),
      importList: (side, text) => {
        const army = parseList(text, side);
        set({
          armies: { ...get().armies, [side]: { text, army } },
          placed: withoutSide(get().placed, side),
          unitOpts: withoutSide(get().unitOpts, side),
          splits: withoutSide(get().splits, side),
          modelDelta: withoutSide(get().modelDelta, side),
          selected: null,
        });
        return army;
      },
      clearList: (side) => {
        const armies = { ...get().armies };
        delete armies[side];
        set({ armies, placed: withoutSide(get().placed, side), unitOpts: withoutSide(get().unitOpts, side), splits: withoutSide(get().splits, side), modelDelta: withoutSide(get().modelDelta, side), selected: null });
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
        const info = findUnit(s.armies, unitId, s.modelDelta);
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
        const info = findUnit(s.armies, unitId, s.modelDelta);
        if (!info || info.unit.models.length <= 1) return;
        const modelDelta = { ...s.modelDelta, [unitId]: (s.modelDelta[unitId] ?? 0) - 1 };
        const ps = s.placed[unitId];
        set({ modelDelta, ...(ps ? { placed: { ...s.placed, [unitId]: ps.slice(0, -1) } } : {}) });
      },
      setColor: (side, color) => set({ colors: { ...get().colors, [side]: color } }),
      saveBattle: (name, asCopy = false) => {
        const s = get();
        const id = (!asCopy && s.currentId) || crypto.randomUUID();
        const saved: SavedBattle = { ...battleData(s), id, name, savedAt: Date.now() };
        set({ battles: [saved, ...s.battles.filter((b) => b.id !== id)], currentId: id, currentName: name });
        void pushBattle(saved);
      },
      loadBattle: (id) => {
        const b = get().battles.find((x) => x.id === id);
        if (!b) return;
        set({ ...battleData({ ...EMPTY, ...b }), currentId: b.id, currentName: b.name, view: 'battle', selected: null });
      },
      deleteBattle: (id) => {
        const s = get();
        set({ battles: s.battles.filter((b) => b.id !== id), ...(s.currentId === id ? { currentId: null } : {}) });
        void supabase.from('battles').delete().eq('id', id).then(({ error }) => error && set({ syncError: error.message }));
      },
      setUser: (user) => {
        const prev = get().user;
        if (prev && user?.id !== prev.id) {
          // Changement de joueur sur cet appareil : on ne garde rien du précédent
          set({ ...EMPTY, battles: [], currentId: null, currentName: '', view: 'home', selected: null });
        }
        set({ user });
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
        ...battleData(s), view: s.view, currentId: s.currentId, currentName: s.currentName, battles: s.battles, showLabels: s.showLabels,
      }),
      // v1 : pas de vue ni de batailles sauvegardées ; on reprend la bataille en cours si elle existait.
      migrate: (old) => {
        const s = old as Partial<State>;
        return { ...s, unitOpts: s.unitOpts ?? {}, splits: s.splits ?? {}, colors: s.colors ?? EMPTY.colors, modelDelta: s.modelDelta ?? {}, battles: s.battles ?? [], view: s.layout != null ? 'battle' : 'home' } as State;
      },
    },
  ),
);

export function findUnit(armies: BattleData['armies'], unitId: string, deltas: Record<string, number> = {}): { unit: Unit; side: Side } | null {
  const found = findRaw(armies, unitId, deltas);
  return found && { ...found, unit: adjust(found.unit, deltas[unitId]) };
}

function findRaw(armies: BattleData['armies'], unitId: string, deltas: Record<string, number>): { unit: Unit; side: Side } | null {
  for (const side of ['me', 'opp'] as const) {
    const units = armies[side]?.army.units ?? [];
    const unit = units.find((u) => u.id === unitId);
    if (unit) return { unit, side };
    // Moitié d'une unité coupée : "me-3.2" → 2e moitié de "me-3"
    const m = unitId.match(/^(.+)\.([12])$/);
    const parent = m && units.find((u) => u.id === m[1]);
    if (parent) return { unit: splitUnit(adjust(parent, deltas[parent.id]))[+m![2] - 1], side };
  }
  return null;
}

export const asset = (p: string) => `${import.meta.env.BASE_URL}assets/${p}`;
