import { useEffect, useState } from 'react';
import { ARMY_COLORS, asset, DISPO_ABBR, DISPOSITIONS, missionFor, useStore, type Side } from '../store';
import { SaveModal } from './SaveModal';
import { Board } from './Board';
import { ArmyPanel, SIDE_TITLE } from './ArmyPanel';
import { ListsModal } from './ListsModal';
import { MissionOverlay } from './MissionOverlay';

const WIDE = '(min-width: 980px)';

function useWide() {
  const [wide, setWide] = useState(() => matchMedia(WIDE).matches);
  useEffect(() => {
    const mq = matchMedia(WIDE);
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

export function Battle() {
  const { mine, opp, layout, armies, go, currentName, colors } = useStore();
  const [lists, setLists] = useState(false);
  const [mission, setMission] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState<Side | null>(null);
  const wide = useWide();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setLists(false); setMission(false); setSheet(null); setSaving(false);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const m = missionFor(mine!, opp!);
  const dispoName = (id: string) => DISPOSITIONS.find((d) => d.id === id)?.name;
  // Couleurs d'armée choisies : toute l'interface et les socles lisent --me / --opp
  const palette = {
    '--me': ARMY_COLORS[colors.me].fill, '--me-ink': ARMY_COLORS[colors.me].ink,
    '--opp': ARMY_COLORS[colors.opp].fill, '--opp-ink': ARMY_COLORS[colors.opp].ink,
  } as React.CSSProperties;

  return (
    <div className={`battle ${wide ? 'wide' : 'narrow'}`} style={palette}>
      <header className="topbar">
        <button className="icon-btn" onClick={() => go('home')} aria-label="Accueil" title="Accueil">‹</button>
        <button className="btn ghost" onClick={() => setLists(true)}>
          ☰ <span className="hide-xs">Listes</span>
        </button>
        <button className="title-btn" onClick={() => go('setup')} title="Changer de disposition ou de carte">
          <span className="t1">{currentName || m.name}</span>
          <span className="t2">
            <span className="hide-xs">{currentName ? `${m.name} · ` : ''}</span>
            {wide ? `${dispoName(mine!)} vs ${dispoName(opp!)}` : `${DISPO_ABBR[mine!]} vs ${DISPO_ABBR[opp!]}`} · Carte {layout! + 1}
          </span>
        </button>
        <div className="topbar-right">
          <button className="icon-btn" onClick={() => setSaving(true)} aria-label="Sauvegarder" title="Sauvegarder la bataille">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 2h9l3 3v9H2z" /><path d="M5 2v4h5V2M5 14v-4h6v4" /></svg>
          </button>
          <button className="btn primary" onClick={() => setMission(true)}>Mission</button>
        </div>
      </header>

      <main className="battle-main">
        {wide && <aside className="side-panel"><ArmyPanel side="me" /></aside>}
        <Board image={asset(m.boards[layout!])} />
        {wide && <aside className="side-panel"><ArmyPanel side="opp" /></aside>}
      </main>

      {!wide && (
        <>
          {sheet && (
            <div className="sheet">
              <ArmyPanel side={sheet} onPlaced={() => setSheet(null)} />
            </div>
          )}
          <nav className="bottombar">
            {(['me', 'opp'] as const).map((s) => (
              <button key={s} className={`${s} ${sheet === s ? 'on' : ''}`} onClick={() => setSheet(sheet === s ? null : s)}>
                <span className="army-dot" /> {SIDE_TITLE[s]}
                {armies[s] && <small>{armies[s]!.army.units.length}</small>}
                <span className="chev">{sheet === s ? '▾' : '▴'}</span>
              </button>
            ))}
          </nav>
        </>
      )}

      {lists && <ListsModal onClose={() => setLists(false)} />}
      {mission && <MissionOverlay onClose={() => setMission(false)} />}
      {saving && <SaveModal onClose={() => setSaving(false)} />}
    </div>
  );
}
