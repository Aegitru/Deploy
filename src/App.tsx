import { useEffect, useState } from 'react';
import { useStore } from './store';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { Home } from './components/Home';
import { LoadBattles } from './components/LoadBattles';
import { Setup } from './components/Setup';
import { Battle } from './components/Battle';

export default function App() {
  const { view, mine, opp, layout, user, setUser, pullBattles } = useStore();
  const [ready, setReady] = useState(false);

  // Session Supabase : à la connexion, on récupère les batailles du joueur
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      setUser(u ? { id: u.id, email: u.email ?? '' } : null);
      setReady(true);
      if (u) setTimeout(() => void pullBattles(), 0); // hors du callback d'auth (recommandé par Supabase)
    });
    return () => data.subscription.unsubscribe();
  }, [setUser, pullBattles]);

  if (!ready) return null;
  if (!user) return <Auth />;
  if (view === 'battle' && mine && opp && layout !== null) return <Battle />;
  if (view === 'setup') return <Setup />;
  if (view === 'load') return <LoadBattles />;
  return <Home />;
}
