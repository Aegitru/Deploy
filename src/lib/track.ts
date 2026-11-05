import { supabase } from './supabase';

// Statistiques d'usage anonymes : une ligne par action clé dans la table events (insertion seule,
// aucune lecture possible depuis l'app). L'appareil est identifié par un id aléatoire local.
export type EventName = 'app_open' | 'battle_start' | 'list_import' | 'battle_save' | 'battle_load' | 'capture' | 'guide';

const DEVICE_KEY = 'deploy5-device';
const NOTRACK_KEY = 'deploy5-notrack';

// Appareils de l'admin : ouvrir une fois l'app avec « ?notrack » coupe les statistiques sur cet
// appareil (« ?track » les rétablit). Le paramètre est retiré de l'adresse.
function readOptOut(): boolean {
  try {
    const params = new URLSearchParams(location.search);
    if (params.has('notrack')) localStorage.setItem(NOTRACK_KEY, '1');
    if (params.has('track')) localStorage.removeItem(NOTRACK_KEY);
    if (params.has('notrack') || params.has('track')) {
      params.delete('notrack');
      params.delete('track');
      const query = params.toString();
      history.replaceState(null, '', location.pathname + (query ? `?${query}` : '') + location.hash);
    }
    return localStorage.getItem(NOTRACK_KEY) === '1';
  } catch {
    return false;
  }
}

const optedOut = readOptOut();

function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'inconnu';
  }
}

export function track(name: EventName, detail?: string) {
  if (import.meta.env.DEV || optedOut) return; // pas de statistiques en développement ni pour l'admin
  void supabase.from('events').insert({ device: deviceId(), name, detail: detail ?? null }).then(() => {}, () => {});
}
