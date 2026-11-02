// Empreintes approximatives (en mm, longueur x largeur) des véhicules sans socle ("Hull" dans l'Event Companion)
// et des socles de vol. Valeurs moyennes à affiner : le premier motif qui correspond au nom gagne.
export const HULLS: { match: RegExp; l: number; w: number }[] = [
  { match: /baneblade|banehammer|banesword|doomhammer|hellhammer|shadowsword|stormlord|stormsword/i, l: 265, w: 150 },
  { match: /hekaton/i, l: 230, w: 110 },
  { match: /land raider/i, l: 185, w: 120 },
  { match: /rogal dorn/i, l: 180, w: 115 },
  { match: /battlewagon/i, l: 190, w: 110 },
  { match: /leman russ/i, l: 150, w: 105 },
  { match: /predator/i, l: 118, w: 100 },
  { match: /rhino|razorback|immolator|whirlwind|vindicator|castigator|exorcist/i, l: 118, w: 75 },
  { match: /chimera|taurox|hellhound|basilisk|manticore|hydra|wyvern|deathstrike|hippogriff/i, l: 135, w: 80 },
  { match: /sagitaur/i, l: 130, w: 80 },
  { match: /skorpius/i, l: 150, w: 95 },
  { match: /plagueburst/i, l: 140, w: 90 },
  { match: /goliath/i, l: 130, w: 80 },
  { match: /trukk/i, l: 120, w: 70 },
  { match: /drop pod/i, l: 150, w: 150 },
  { match: /invader atv|centaur/i, l: 90, w: 60 },
];

export const DEFAULT_HULL = { l: 130, w: 80 };

export const FLYING = {
  large: { w: 120, h: 92 },
  small: { w: 75, h: 42 },
};

export const DEFAULT_BASE_MM = 32;
