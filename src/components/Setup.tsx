import { asset, DISPOSITIONS, missionFor, useStore, type DispositionId } from '../store';

export function Setup() {
  const { mine, opp, layout, setDispositions, setLayout, go } = useStore();
  const mission = mine && opp ? missionFor(mine, opp) : null;

  const pick = (row: 'mine' | 'opp', id: DispositionId) =>
    row === 'mine' ? setDispositions(id, opp) : setDispositions(mine, id);

  return (
    <div className="setup">
      <header className="page-head">
        {/* Depuis une bataille en cours, retour sur la table ; sinon à l'accueil */}
        <button className="icon-btn" onClick={() => go(layout !== null ? 'battle' : 'home')} aria-label="Retour">‹</button>
        <h2>Nouvelle bataille</h2>
      </header>

      {(['mine', 'opp'] as const).map((row) => (
        <section key={row} className="dispo-row">
          <h3>{row === 'mine' ? 'Ma disposition' : 'Disposition adverse'}</h3>
          <div className={`dispo-grid ${row === 'mine' ? 'me' : 'opp'}`}>
            {DISPOSITIONS.map((d) => (
              <button key={d.id} className={(row === 'mine' ? mine : opp) === d.id ? 'on' : ''} onClick={() => pick(row, d.id as DispositionId)}>
                {d.name}
              </button>
            ))}
          </div>
        </section>
      ))}

      {mission && (
        <section className="layouts">
          <div className="mission-title">
            <span className="eyebrow">Mission principale</span>
            <h2>{mission.name}</h2>
          </div>
          <div className="layout-grid">
            {mission.boards.map((b, i) => (
              <button key={b} className="layout-thumb" onClick={() => setLayout(i)}>
                <img src={asset(b)} alt={`Carte ${i + 1}`} loading="lazy" />
                <span>Carte {i + 1}</span>
              </button>
            ))}
          </div>
          <button className="btn primary wide" onClick={() => setLayout(Math.floor(Math.random() * mission.boards.length))}>
            ⚄ Carte au hasard
          </button>
        </section>
      )}
    </div>
  );
}
