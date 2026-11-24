# Intégration Mago-stat ↔ Deploy5

Deploy5 (https://deployfive.vercel.app) s'ouvre depuis Mago-stat sur une bataille déjà prête
(dispositions, mission, carte, listes), puis renvoie à Mago-stat l'image du déploiement.

```
Mago-stat                                  Deploy5
─────────                                  ───────
Matrice : bouton au-dessus d'une carte
  │  lien (dispositions, carte, jeton, listes compressées)
  └──────────────────────────────────────▶ ouvre la bataille sur la table
                                           le joueur déploie ses unités
                                           disquette → « Envoyer à Mago-stat »
  ┌─────────────────────────────────────── POST /api/deploy5 (jeton + image WebP)
  ▼
vérifie le jeton, stocke l'image,
l'affiche dans la case de la matrice
```

Côté Mago-stat, il y a deux choses à faire :
1. construire le lien du bouton ;
2. exposer l'API qui reçoit l'image.

Tout le reste est déjà en place dans Deploy5.

---

## 1. Aller : le lien vers Deploy5

### Format

```
https://deployfive.vercel.app/?player=<disposition>&opponent=<disposition>&map=<a|b|c>&token=<token>#player=<list>&opponent=<list>
```

| Paramètre | Emplacement | Contenu | Obligatoire |
|---|---|---|---|
| `player` | query | Force Disposition du joueur | oui |
| `opponent` | query | Force Disposition de l'adversaire | oui |
| `map` | query | carte : `a`, `b` ou `c` (`1`, `2`, `3` acceptés) | oui |
| `token` | query | jeton du retour de l'image (voir 2) ; sans lui, pas d'envoi possible | non |
| `player` | après `#` | liste du joueur, compressée avec lz-string | non |
| `opponent` | après `#` | liste de l'adversaire, compressée avec lz-string | non |

**Force Dispositions.** Identifiant ou nom complet, sans tenir compte de la casse :

| Identifiant | Nom |
|---|---|
| `take-and-hold` | Take and Hold |
| `purge-the-foe` | Purge the Foe |
| `disruption` | Disruption |
| `reconnaissance` | Reconnaissance |
| `priority-assets` | Priority Assets |

**Cartes.** Les Layouts A, B et C de la matrice Mago-stat correspondent aux cartes 1, 2 et 3 de
Deploy5. L'ordre et l'orientation sont les mêmes ; on l'a vérifié sur « Reconnaissance vs Take and Hold ».
La mission principale est déduite des deux dispositions, il n'y a pas à l'envoyer.

**Listes.**
- Format : texte d'export de l'app officielle Warhammer 40,000 ou de NewRecruit, tel quel.
- Encodage : chaque liste est compressée avec
  [lz-string](https://www.npmjs.com/package/lz-string), fonction `compressToEncodedURIComponent`.
- Emplacement : elles vont après le `#`, une partie de l'adresse que le navigateur n'envoie jamais au serveur. Elles
  n'apparaissent donc dans aucun journal.
- Taille : 1 à 2 Ko par liste compressée, jusqu'à 3,5 Ko pour les plus longues. Un lien complet
  fait environ 3 à 7 Ko, sans problème pour un bouton ou un lien.

### Code

```bash
npm i lz-string
```

```js
import LZString from 'lz-string';

const z = (text) => LZString.compressToEncodedURIComponent(text);

function deploy5Url({ playerDisposition, opponentDisposition, layout, token, playerList, opponentList }) {
  const query = new URLSearchParams({ player: playerDisposition, opponent: opponentDisposition, map: layout });
  if (token) query.set('token', token);
  const hash = [];
  if (playerList) hash.push(`player=${z(playerList)}`);
  if (opponentList) hash.push(`opponent=${z(opponentList)}`);
  return `https://deployfive.vercel.app/?${query}${hash.length ? `#${hash.join('&')}` : ''}`;
}

// <a href={deploy5Url({...})} target="_blank" rel="noopener">Deploy on Deploy5</a>
```

### Ce que fait Deploy5 à l'ouverture

- Il crée une nouvelle bataille : dispositions, mission, carte et listes importées. Il affiche directement la table.
- Il retire ces paramètres de l'adresse, si bien qu'un rechargement de la page ne recrée pas la bataille.
- Si un paramètre obligatoire manque ou est invalide, il ignore le lien et s'ouvre normalement.
- Si le joueur n'est pas connecté à Deploy5, il passe d'abord par l'écran de connexion ou « Continuer sans
  compte », puis arrive sur la bataille.
- Une bataille en cours non enregistrée sur l'appareil est remplacée.

### Exemple sans liste, à coller dans un navigateur

```
https://deployfive.vercel.app/?player=reconnaissance&opponent=take-and-hold&map=a&token=test
```

---

## 2. Retour : l'image du déploiement

### Ce que voit le joueur

Si la bataille a été ouverte avec un `token`, le bouton disquette de Deploy5 ouvre « Envoyer à
Mago-stat ». Ce bouton remplace « Enregistrer ».

Au clic :
1. Si le joueur est connecté à Deploy5, la bataille est aussi enregistrée dans son compte Deploy5. Les
   envois suivants mettent à jour la même bataille.
2. Deploy5 génère l'image du déploiement :
   - la table entière avec titre et sous-titre (mission, dispositions, carte) ;
   - les noms des unités ;
   - en dessous, les réserves (unités non posées) de chaque joueur.
3. Deploy5 l'envoie à Mago-stat.
4. Deploy5 affiche « Image envoyée à Mago-stat », avec un lien vers `https://mago-stats.vercel.app/matrix`,
   ou « Échec de l'envoi à Mago-stat. Réessaie dans un instant. ». Le joueur peut renvoyer autant de fois
   qu'il veut.

Deploy5 n'envoie l'image qu'à l'adresse ci-dessous, écrite dans son code. Une adresse passée dans le lien
n'est jamais utilisée.

### L'appel API

```
POST https://mago-stats.vercel.app/api/deploy5
Content-Type: multipart/form-data
Origin: https://deployfive.vercel.app
```

| Champ | Type | Contenu |
|---|---|---|
| `token` | texte | le `token` reçu dans le lien |
| `image` | fichier | `deploy5.webp` (`image/webp`), environ 100 à 300 Ko, 1150 px de large. Si un navigateur ne sait pas produire du WebP (anciens Safari), il envoie `deploy5.png` (`image/png`) |

Réponses attendues :

| Code | Cas | Affichage dans Deploy5 |
|---|---|---|
| `200` | image enregistrée, corps libre (ex. `{ "ok": true }`) | « Image envoyée » |
| `401` | jeton inconnu, expiré ou invalide | « Échec de l'envoi » |
| `413` / `400` | image trop lourde ou absente | « Échec de l'envoi » |

Deploy5 ne lit que le code HTTP : tout code 2xx compte comme une réussite, tout le reste comme un échec.

### CORS

L'appel part du navigateur du joueur, depuis un autre domaine. La route doit donc répondre :

```
Access-Control-Allow-Origin: https://deployfive.vercel.app
Access-Control-Allow-Methods: POST, OPTIONS
```

Elle doit aussi répondre à la requête `OPTIONS` (pré-vérification du navigateur) avec un code 204 et ces mêmes en-têtes.
Pour tester en local avec Deploy5, ajouter aussi `http://localhost:5174`.

### Le jeton

Le jeton est entièrement géré par Mago-stat ; Deploy5 se contente de le renvoyer tel quel. Recommandations :
- Il identifie le joueur, l'adversaire (le slot de la matrice) et la carte (A, B ou C).
- Il est impossible à deviner : identifiant aléatoire stocké en base, ou valeur signée (HMAC) contenant
  ces informations.
- Il expire, par exemple au bout de 24 h. Il peut être utilisé plusieurs fois, car le joueur peut renvoyer
  après avoir modifié son déploiement. La dernière image remplace alors la précédente.
- Il ne contient pas de données personnelles en clair, puisqu'il passe dans l'adresse.

### Exemple de route (Next.js App Router + Vercel Blob)

À adapter selon le framework et le stockage de Mago-stat. Cet exemple utilise un jeton signé par HMAC.

```ts
// app/api/deploy5/route.ts
import { put } from '@vercel/blob';
import { createHmac, timingSafeEqual } from 'node:crypto';

const CORS = {
  'Access-Control-Allow-Origin': 'https://deployfive.vercel.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const MAX_SIZE = 4 * 1024 * 1024; // les fonctions Vercel refusent les corps de plus de 4,5 Mo

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const token = String(form.get('token') ?? '');
  const image = form.get('image');

  const slot = verifyToken(token); // { userId, opponent, layout } ou null
  if (!slot) return Response.json({ ok: false }, { status: 401, headers: CORS });
  if (!(image instanceof File) || !['image/webp', 'image/png'].includes(image.type)) {
    return Response.json({ ok: false }, { status: 400, headers: CORS });
  }
  if (image.size > MAX_SIZE) return Response.json({ ok: false }, { status: 413, headers: CORS });

  const ext = image.type === 'image/webp' ? 'webp' : 'png';
  const blob = await put(`deploy5/${slot.userId}/${slot.opponent}-${slot.layout}.${ext}`, image, {
    access: 'public', addRandomSuffix: true, contentType: image.type,
  });
  // À faire : enregistrer blob.url dans la case de la matrice (userId, opponent, layout)

  return Response.json({ ok: true }, { headers: CORS });
}

// Jeton = base64url(JSON) + "." + HMAC-SHA256, créé avec la même clé au moment de construire le lien
function verifyToken(token: string) {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', process.env.DEPLOY5_SECRET!).update(payload).digest('base64url');
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  return data.exp > Date.now() ? data : null;
}

export function makeToken(userId: string, opponent: number, layout: 'a' | 'b' | 'c') {
  const payload = Buffer.from(JSON.stringify({ userId, opponent, layout, exp: Date.now() + 24 * 3600 * 1000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', process.env.DEPLOY5_SECRET!).update(payload).digest('base64url')}`;
}
```

### Tester la route sans Deploy5

```bash
curl -i -X POST https://mago-stats.vercel.app/api/deploy5 \
  -H "Origin: https://deployfive.vercel.app" \
  -F token=<un jeton valide> \
  -F image=@deploy.webp;type=image/webp
```

### Tester avec Deploy5

1. Construire un lien avec un vrai jeton et l'ouvrir.
2. Poser quelques unités, puis cliquer sur la disquette et « Envoyer à Mago-stat ».
3. Vérifier que l'image arrive et que Deploy5 affiche « Image envoyée ».

---

## Hors périmètre pour l'instant

- Les positions des unités ne sont pas envoyées, seulement l'image.
- Deploy5 ne renvoie rien d'autre à Mago-stat, ni score ni données de bataille.

## Dans le code de Deploy5

| Fichier | Rôle |
|---|---|
| `src/lib/magoLink.ts` | lecture du lien, adresses `MAGO_URL` et `MAGO_UPLOAD` |
| `src/lib/magoLink.test.ts` | tests du format du lien |
| `src/main.tsx` | ouverture de la bataille au chargement |
| `src/store.ts` | `openFromLink`, `magoToken` (conservé jusqu'à une nouvelle bataille ou un chargement) |
| `src/components/SaveModal.tsx` | bouton « Envoyer à Mago-stat », enregistrement dans le compte, appel API |
| `src/lib/capture.ts` | génération de l'image (`boardCaptureBlob`) |
