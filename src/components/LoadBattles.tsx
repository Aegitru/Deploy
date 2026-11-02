import { useState } from 'react';
import { DISPO_ABBR, useStore } from '../store';

export function LoadBattles() {
  const { battles, loadBattle, deleteBattle, go } = useStore();
  const [confirm, setConfirm] = useState<string | null>(null);

  return (
    <div className="setup">
      <header className="page-head">
        <button className="icon-btn" onClick={() => go('home')} aria-label="Retour">‹</button>
        <h2>Batailles sauvegardées</h2>
      </header>
      {!battles.length && <p className="panel-empty">Aucune bataille sauvegardée.</p>}
      <ul className="battle-list">
        {battles.map((b) => (
          <li key={b.id}>
            <button className="battle-row" onClick={() => loadBattle(b.id)}>
              <span className="bname">{b.name}</span>
              <span className="bdispo">
                {b.mine && b.opp ? `${DISPO_ABBR[b.mine]} vs ${DISPO_ABBR[b.opp]}` : ''}
              </span>
            </button>
            {/* Premier appui : demande confirmation ; second appui : supprime */}
            <button
              className={`del-btn ${confirm === b.id ? 'armed' : ''}`}
              onClick={() => (confirm === b.id ? deleteBattle(b.id) : setConfirm(b.id))}
              onBlur={() => setConfirm(null)}
              aria-label={`Supprimer ${b.name}`}
              title="Supprimer"
            >
              {confirm === b.id ? 'Supprimer ?' : '✕'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
