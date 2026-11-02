import { createClient } from '@supabase/supabase-js';

// Clé « publishable » : prévue pour être embarquée dans une app web. L'accès aux données
// est protégé par les règles RLS de la table battles (chaque joueur ne voit que ses batailles).
const SUPABASE_URL = 'https://ducinioakhlwoazknomk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KBVuwKg6XTpDfZhnXhtXkg_ND4rZz86';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/** Messages d'erreur Supabase les plus courants, en français */
export function authErrorFr(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'E-mail ou mot de passe incorrect.';
  if (/email not confirmed/i.test(message)) return "Confirme d'abord ton adresse via le lien reçu par e-mail.";
  if (/already registered|already exists/i.test(message)) return 'Un compte existe déjà avec cet e-mail.';
  if (/at least 6 characters|password should be/i.test(message)) return 'Le mot de passe doit faire au moins 6 caractères.';
  if (/rate limit/i.test(message)) return 'Trop de tentatives, réessaie dans quelques minutes.';
  if (/invalid.*email|unable to validate email/i.test(message)) return 'Adresse e-mail invalide.';
  return message;
}
