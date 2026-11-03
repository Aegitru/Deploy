import { supabase } from './supabase';

// Statistiques d'usage anonymes : une ligne par action clé dans la table events (insertion seule,
// aucune lecture possible depuis l'app). L'appareil est identifié par un id aléatoire local.
export type EventName = 'app_open' | 'battle_start' | 'list_import' | 'battle_save' | 'battle_load' | 'capture' | 'guide';

const DEVICE_KEY = 'deploy5-device';

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
  if (import.meta.env.DEV) return; // pas de statistiques pendant le développement
  void supabase.from('events').insert({ device: deviceId(), name, detail: detail ?? null }).then(() => {}, () => {});
}
