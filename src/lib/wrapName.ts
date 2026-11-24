// Nom d'unité sur 2 lignes au plus, 15 caractères par ligne : coupure entre les mots si possible,
// et la fin de la 2e ligne tronquée par « ... » quand le nom est trop long.

export const LINE_MAX = 15;

export function wrapName(name: string, max = LINE_MAX): string[] {
  const s = name.trim().replace(/\s+/g, ' ');
  if (s.length <= max) return [s];
  // 1re ligne : le plus de mots possible (un mot trop long est coupé)
  let cut = s.lastIndexOf(' ', max);
  if (cut <= 0) cut = max;
  const first = s.slice(0, cut).trimEnd();
  const rest = s.slice(cut).trimStart();
  const second = rest.length <= max ? rest : `${rest.slice(0, max - 3).trimEnd()}...`;
  return [first, second];
}
