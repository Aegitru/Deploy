import { useEffect, useState } from 'react';
import { useStore } from './store';
import { supabase } from './lib/supabase';
import { Auth, NewPassword } from './components/Auth';
import { Home } from './components/Home';
import { LoadBattles } from './components/LoadBattles';
import { Setup } from './components/Setup';
import { Battle } from './components/Battle';

// En développement uniquement : VITE_SKIP_AUTH=1 permet de tester la table sans compte (batailles non synchronisées)
const SKIP_AUTH = import.meta.env.DEV && import.meta.env.VITE_SKIP_AUTH === '1';

export default function App() {
  const { view, mine, opp, layout, user, setUser, pullBattles } = useStore();
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false);

  // Session Supabase : à la connexion, on récupère les batailles du joueur
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true); // retour du lien « mot de passe oublié »
      const u = session?.user;
      setUser(u ? { id: u.id, email: u.email ?? '' } : null);
      setReady(true);
      if (u) setTimeout(() => void pullBattles(), 0); // hors du callback d'auth (recommandé par Supabase)
    });
    return () => data.subscription.unsubscribe();
  }, [setUser, pullBattles]);

  if (!ready) return null;
  if (recovery) return <NewPassword onDone={() => setRecovery(false)} />;
  if (!user && !SKIP_AUTH) return <Auth />;
  if (view === 'battle' && mine && opp && layout !== null) return <Battle />;
  if (view === 'setup') return <Setup />;
  if (view === 'load') return <LoadBattles />;
  return <Home />;
}
