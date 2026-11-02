import { useStore } from './store';
import { Home } from './components/Home';
import { LoadBattles } from './components/LoadBattles';
import { Setup } from './components/Setup';
import { Battle } from './components/Battle';

export default function App() {
  const { view, mine, opp, layout } = useStore();
  if (view === 'battle' && mine && opp && layout !== null) return <Battle />;
  if (view === 'setup') return <Setup />;
  if (view === 'load') return <LoadBattles />;
  return <Home />;
}
