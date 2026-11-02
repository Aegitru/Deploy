import { useStore } from '../store';

export function Home() {
  const { newBattle, go, battles, layout, mine, opp } = useStore();
  const canResume = layout !== null && !!mine && !!opp;

  return (
    <div className="home">
      <header className="setup-head">
        <div className="eyebrow">Warhammer 40,000 · 11e édition</div>
        <h1>Deploy</h1>
      </header>
      <div className="home-actions">
        <button className="btn primary wide" onClick={newBattle}>Nouvelle bataille</button>
        <button className="btn wide" onClick={() => go('load')} disabled={!battles.length}>
          Charger {battles.length > 0 && <small className="badge">{battles.length}</small>}
        </button>
        {canResume && <button className="link-btn" onClick={() => go('battle')}>Reprendre la bataille en cours ›</button>}
      </div>
    </div>
  );
}
