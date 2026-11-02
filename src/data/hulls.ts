// Empreintes au sol (en mm, longueur x largeur, sponsons/chenilles compris) des véhicules sans socle
// ("Hull" dans l'Event Companion) et des socles de vol. Le premier motif qui correspond au nom gagne :
// les noms les plus précis passent avant les familles de châssis.
//
// Fiabilité : "mesuré" = mesure de figurine publiée par des joueurs ; "estimé" = déduit de la taille du kit
// ou du châssis le plus proche. À corriger ici dès qu'on a une mesure réelle.
export const HULLS: { match: RegExp; l: number; w: number }[] = [
  // Titans et aéronefs géants (estimé)
  { match: /warlord titan/i, l: 300, w: 260 },
  { match: /warbringer|phantom titan/i, l: 260, w: 230 },
  { match: /reaver titan/i, l: 230, w: 200 },
  { match: /warhound|revenant titan/i, l: 170, w: 150 },
  { match: /thunderhawk/i, l: 480, w: 430 },
  { match: /manta/i, l: 700, w: 560 },
  { match: /harridan/i, l: 360, w: 300 },
  { match: /hierophant/i, l: 300, w: 230 },

  // Super-lourds
  { match: /baneblade|banehammer|banesword|doomhammer|hellhammer|shadowsword|stormlord|stormsword/i, l: 229, w: 150 }, // mesuré : coque 229 x 140
  { match: /astraeus/i, l: 230, w: 155 },
  { match: /seraptek/i, l: 230, w: 200 },
  { match: /lord of skulls/i, l: 230, w: 160 },
  { match: /squiggoth/i, l: 230, w: 150 },
  { match: /stompa/i, l: 180, w: 180 },
  { match: /hekaton/i, l: 170, w: 105 }, // mesuré : 17 x 10.5 cm canons rabattus (r/LeaguesofVotann)
  { match: /acastus/i, l: 180, w: 150 },

  // Chars et transports lourds
  { match: /land raider/i, l: 165, w: 110 }, // mesuré : ~6.5" x 4"
  { match: /rogal dorn/i, l: 165, w: 120 },
  { match: /battlewagon|gunwagon/i, l: 190, w: 120 },
  { match: /leman russ/i, l: 140, w: 108 }, // mesuré : 5.5" x 4.25" lame comprise
  { match: /castigator/i, l: 140, w: 105 },
  { match: /predator/i, l: 117, w: 105 }, // châssis Rhino + sponsons
  { match: /vindicator/i, l: 127, w: 76 }, // Rhino + lame de bulldozer
  { match: /exorcist/i, l: 125, w: 80 },
  { match: /rhino|razorback|whirlwind|immolator/i, l: 117, w: 76 }, // mesuré : un Rhino modifié fait 5.75" x 3.25"
  { match: /basilisk|deathstrike/i, l: 150, w: 86 }, // châssis Chimera, canon long
  { match: /chimera|hellhound|hydra|wyvern|manticore/i, l: 125, w: 86 },
  { match: /hippogriff/i, l: 130, w: 90 },
  { match: /skorpius/i, l: 150, w: 95 },
  { match: /plagueburst/i, l: 135, w: 95 },
  { match: /sagitaur/i, l: 130, w: 80 },
  { match: /trukk/i, l: 135, w: 75 },
  { match: /goliath/i, l: 130, w: 80 },
  { match: /taurox/i, l: 115, w: 75 },
  { match: /triarch stalker/i, l: 120, w: 120 },
  { match: /drop pod/i, l: 180, w: 180 }, // portes ouvertes
  { match: /hammerfall/i, l: 150, w: 150 },

  // Petits véhicules
  { match: /centaur/i, l: 90, w: 60 },
  { match: /invader atv/i, l: 85, w: 55 },
  { match: /mek gunz/i, l: 75, w: 55 },
  { match: /cyclops/i, l: 50, w: 40 },
  { match: /commissar graves/i, l: 60, w: 60 },

  // Fortifications et décors (estimé)
  { match: /aegis defence line/i, l: 300, w: 40 },
  { match: /tidewall shieldline/i, l: 230, w: 100 },
  { match: /tidewall/i, l: 155, w: 110 },
  { match: /bossbunka/i, l: 130, w: 130 },
  { match: /skull altar/i, l: 110, w: 110 },
  { match: /sporocyst/i, l: 105, w: 105 },
  { match: /miasmic malignifier|noctilith crown/i, l: 100, w: 100 },
  { match: /gnarlmaw/i, l: 90, w: 90 },
  { match: /convergence of dominion/i, l: 70, w: 70 },
];

export const DEFAULT_HULL = { l: 130, w: 80 };

export const FLYING = {
  large: { w: 120, h: 92 },
  small: { w: 75, h: 42 },
};

export const DEFAULT_BASE_MM = 32;
