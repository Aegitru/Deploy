# Deploy5 (Warhammer 40,000 – 11e édition)

Entraînement au déploiement : choix des dispositions → mission principale et 3 cartes de bataille,
import des listes (app officielle ou NewRecruit), socles à l'échelle à glisser sur la table 44"×60".

## Lancer

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # parser de listes (+ rapport sur les listes listhammer si présentes)
npm run build    # site statique dans dist/ (déployable tel quel sur Vercel)
```

## Données

| Fichier | Contenu | Régénérer |
|---|---|---|
| `public/assets/boards/*.webp` | 45 tables recadrées au cadre 44"×60" | `node tools/download-assets.mjs` puis `node tools/crop-boards.mjs` |
| `public/assets/missions/**` | 25 cartes de mission principale (+ 11 versos) | `node tools/download-assets.mjs` |
| `src/data/missions.json` | matrice dispositions → mission, cartes | `node tools/download-assets.mjs` |
| `src/data/bases.json` | socles par faction/datasheet (Event Companion) | `node tools/pdf-text.mjs tools/raw/event-companion.pdf > tools/raw/event-companion.txt` puis `node tools/extract-bases.mjs` |
| `src/data/hulls.ts` | empreintes approximatives des véhicules « Hull » et socles de vol | à la main |

Sources : cartes et missions de [gdmissions.app](https://gdmissions.app/11th), socles du
[Warhammer 40,000 Event Companion](https://assets.warhammer-community.com/eng_14-10_wh40k_event_companion-rdwnqprl4c-nj8oqogadv.pdf).
Usage personnel : ces visuels appartiennent à leurs auteurs.

## En ligne

- App : https://deployfive.vercel.app (Vercel, redéployé à chaque push sur `main`)
- Code : https://github.com/Aegitru/Deploy
- Comptes et batailles : Supabase, projet « Deploy » (organisation Aegitru's Org). Table `battles`
  (une ligne par bataille, `data` = JSON de la bataille), protégée par RLS : chaque joueur ne voit que les siennes.
  La clé publique et l'URL sont dans `src/lib/supabase.ts`.
