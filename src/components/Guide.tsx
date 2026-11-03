import { useStore } from '../store';

const img = (name: string) => `${import.meta.env.BASE_URL}guide/${name}.webp`;

type Section = { id: string; title: string; image?: { src: string; alt: string }; points: React.ReactNode[] };

const SECTIONS: Section[] = [
  {
    id: 'demarrer',
    title: 'Démarrer',
    points: [
      <><b>Nouvelle bataille</b> : choisis les dispositions et la carte.</>,
      <><b>Charger</b> : rouvre une bataille sauvegardée (✕ puis « Supprimer ? » pour l'effacer).</>,
      <><b>Reprendre</b> : revient à la bataille en cours sur cet appareil.</>,
      <>Le compte est facultatif : il sert à retrouver tes batailles d'un appareil à l'autre.</>,
    ],
  },
  {
    id: 'mission',
    title: 'Choisir la mission et la carte',
    image: { src: img('setup'), alt: 'Choix des dispositions, mission et cartes' },
    points: [
      <>Choisis <b>ta disposition</b> puis celle de <b>l'adversaire</b> : la mission principale s'affiche.</>,
      <>Touche une des <b>3 cartes</b>, ou <b>Carte au hasard</b>.</>,
      <>Sur la carte, toucher le titre en haut ramène ici pour changer de carte.</>,
    ],
  },
  {
    id: 'listes',
    title: 'Importer les listes',
    image: { src: img('lists'), alt: 'Fenêtre d’import des listes' },
    points: [
      <><b>☰ Listes</b> : colle l'export texte de l'<b>app officielle</b> ou de <b>NewRecruit</b>, ou charge un fichier .txt.</>,
      <>Un onglet par camp : <b>Mon armée</b> et <b>Adversaire</b>. Les tailles de socle viennent de l'Event Companion.</>,
      <>Importer la liste adverse <b>n'est pas obligatoire</b> : tu peux t'entraîner avec ta seule armée.</>,
    ],
  },
  {
    id: 'carte',
    title: 'La carte',
    image: { src: img('battle'), alt: 'Vue de la carte avec les listes et des unités posées' },
    points: [
      <>En haut : <b>‹</b> accueil, <b>☰ Listes</b>, le titre (changer de carte), la <b>disquette</b> (sauvegarder) et <b>Mission</b>.</>,
      <>Les listes sont sur les côtés (ordinateur) ou dans les onglets du bas (téléphone, avec unités restantes / total).</>,
      <>En bas à droite : <b>Aa</b> affiche les noms, le <b>crayon</b> mesure, <b>⤢</b> montre toute la table.</>,
      <>Zoom à la molette ou en pinçant ; glisse le fond de la table pour la déplacer. Tout est à l'échelle : 44" × 60".</>,
    ],
  },
  {
    id: 'deployer',
    title: 'Poser et déplacer les unités',
    points: [
      <>Sur ordinateur, <b>glisse</b> une unité de la liste vers la carte. Sur téléphone, <b>touche-la</b> dans la liste : elle apparaît au centre de la vue.</>,
      <>Glisse une unité posée pour la déplacer : son point de départ et la <b>distance parcourue</b> s'affichent.</>,
      <>Relâche une unité <b>hors de la table</b> pour la retirer.</>,
      <>Les unités déjà posées descendent en bas de la liste avec un ✓.</>,
    ],
  },
  {
    id: 'menu',
    title: "Le menu de l'unité",
    image: { src: img('unit-menu'), alt: 'Menu de l’unité sélectionnée et panneau de formation' },
    points: [
      <>Touche une unité posée : son menu apparaît en haut (ou en bas s'il la cachait).</>,
      <><b>⟲ ⟳</b> la font pivoter de 45°.</>,
      <>L'icône de <b>formation</b> ouvre : <b>Figurines</b> (+/− un socle), <b>Par rang</b>, <b>Écart</b> (collés, ½", 1", 2"), <b>Zone</b> (contour pointillé de 1" à 12") et <b>Déplacer</b> l'unité entière ou une seule figurine.</>,
    ],
  },
  {
    id: 'unites',
    title: 'Vue de la liste',
    image: { src: img('list-panel'), alt: 'Liste avec une unité menée dépliée' },
    points: [
      <>Un clic sur la <b>pastille</b> permet de changer la couleur du joueur et de ses figurines.</>,
      <>Le <b>+</b> ajoute une unité à la main : nom, nombre de socles, socle rond, ovale ou frame.</>,
      <>Le <b>chevron ▸</b> déplie une unité menée : une ligne par personnage ou escouade, et la <b>chaîne coupée</b> pour la détacher.</>,
      <>La <b>chaîne</b> d'un personnage seul l'attache : touche ensuite l'unité qu'il rejoint.</>,
      <><b>Split</b> coupe une unité en deux moitiés égales ; <b>Réunir</b> les rassemble.</>,
    ],
  },
  {
    id: 'crayon',
    title: 'Mesurer au crayon',
    image: { src: img('ruler'), alt: 'Ligne mesurée au crayon' },
    points: [
      <>Touche le <b>crayon</b>, puis le point de départ et le point d'arrivée : la longueur s'affiche en pouces.</>,
      <>Retouche le crayon avant la fin pour annuler.</>,
      <>Touche une ligne : sa <b>croix</b> la supprime, ses <b>extrémités</b> se déplacent en les glissant.</>,
    ],
  },
  {
    id: 'mission-carte',
    title: 'Voir la mission',
    image: { src: img('mission'), alt: 'Carte de mission principale' },
    points: [
      <><b>Mission</b> affiche ta mission principale ; <b>Adversaire</b> montre la sienne, <b>Verso</b> retourne la carte quand elle en a un.</>,
    ],
  },
  {
    id: 'sauver',
    title: 'Sauvegarder et capturer',
    points: [
      <>La <b>disquette</b> enregistre listes, carte, placements et lignes sous un nom. Ensuite : <b>Mettre à jour</b> ou <b>Nouvelle copie</b>.</>,
      <><b>Télécharger une capture</b> enregistre une image PNG de toute la table.</>,
    ],
  },
];

export function Guide() {
  const go = useStore((s) => s.go);
  return (
    <div className="setup guide">
      <header className="page-head">
        <button className="icon-btn" onClick={() => go('home')} aria-label="Retour">‹</button>
        <h2>Guide</h2>
      </header>

      <p className="guide-intro">
        Deploy5 sert à préparer ton déploiement : choisis la mission et la carte, importe les listes, pose les unités
        à l'échelle, mesure et sauvegarde.
      </p>

      <nav className="guide-toc">
        {SECTIONS.map((s, i) => <a key={s.id} href={`#${s.id}`}>{i + 1}. {s.title}</a>)}
      </nav>

      {SECTIONS.map((s, i) => (
        <section key={s.id} id={s.id} className="guide-section">
          <h3><span>{i + 1}</span>{s.title}</h3>
          <ul>{s.points.map((p, k) => <li key={k}>{p}</li>)}</ul>
          {s.image && <img src={s.image.src} alt={s.image.alt} loading="lazy" />}
        </section>
      ))}

      <button className="btn wide" onClick={() => go('home')}>Retour à l'accueil</button>
    </div>
  );
}
