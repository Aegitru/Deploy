import { useStore } from '../store';
import { supabase } from '../lib/supabase';

export function Home() {
  const { newBattle, go, battles, layout, mine, opp, user, syncError, setGuest } = useStore();
  const canResume = layout !== null && !!mine && !!opp;

  return (
    <div className="home">
      <header className="setup-head">
        <div className="eyebrow">Warhammer 40,000 · 11e édition</div>
        <h1>Deploy5</h1>
      </header>
      <div className="home-actions">
        <button className="btn primary wide" onClick={newBattle}>Nouvelle bataille</button>
        <button className="btn wide" onClick={() => go('load')} disabled={!battles.length}>
          Charger {battles.length > 0 && <small className="badge">{battles.length}</small>}
        </button>
        {canResume && <button className="link-btn" onClick={() => go('battle')}>Reprendre la bataille en cours ›</button>}
      </div>
      {user ? (
        <footer className="account">
          <span>{user.email}</span>
          <button className="link-btn" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
          {syncError && <p className="warning">Synchronisation impossible : {syncError}</p>}
        </footer>
      ) : (
        <footer className="account">
          <span className="guest-note">Sans compte : tes déploiements restent sur cet appareil.</span>
          <button className="link-btn" onClick={() => setGuest(false)}>Se connecter / créer un compte</button>
        </footer>
      )}
    </div>
  );
}
