import LZString from 'lz-string';
import missionsData from '../data/missions.json';

// Lien d'ouverture depuis Mago-stat :
// /?player=<dispo>&opponent=<dispo>&map=<a|b|c>&token=<jeton>#player=<liste>&opponent=<liste>
// Les dispositions acceptent l'identifiant (take-and-hold) ou le nom (Take and Hold) ; les listes,
// compressées avec lz-string (compressToEncodedURIComponent), sont après le # (jamais envoyées aux serveurs).

export const MAGO_URL = 'https://mago-stats.vercel.app';
export const MAGO_UPLOAD = `${MAGO_URL}/api/deploy5`;

export type MagoLink = {
  player: string; opponent: string; layout: number; token: string | null;
  lists: { me?: string; opp?: string };
};

const KEYS = ['player', 'opponent', 'map', 'token'];

function dispo(v: string | null): string | null {
  if (!v) return null;
  const s = v.trim().toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
  return missionsData.dispositions.find((d) => d.id === s)?.id ?? null;
}

function layoutOf(v: string | null): number | null {
  const s = (v ?? '').trim().toLowerCase();
  const i = 'abc'.indexOf(s) >= 0 && s.length === 1 ? 'abc'.indexOf(s) : Number(s) - 1;
  return Number.isInteger(i) && i >= 0 && i <= 2 ? i : null;
}

function list(v: string | null): string | undefined {
  if (!v) return undefined;
  const text = LZString.decompressFromEncodedURIComponent(v);
  return text && text.trim() ? text : undefined;
}

/** Lit un lien Mago-stat ; null si le lien n'en est pas un (ou incomplet). */
export function parseMagoLink(search: string, hash: string): MagoLink | null {
  const q = new URLSearchParams(search);
  const player = dispo(q.get('player')), opponent = dispo(q.get('opponent')), layout = layoutOf(q.get('map'));
  if (!player || !opponent || layout === null) return null;
  const h = new URLSearchParams(hash.replace(/^#/, ''));
  return { player, opponent, layout, token: q.get('token') || null, lists: { me: list(h.get('player')), opp: list(h.get('opponent')) } };
}

/** Retire les paramètres du lien de l'adresse (un rechargement ne recrée pas la bataille). */
export function clearMagoLink() {
  const q = new URLSearchParams(location.search);
  KEYS.forEach((k) => q.delete(k));
  const query = q.toString();
  history.replaceState(null, '', location.pathname + (query ? `?${query}` : ''));
}
