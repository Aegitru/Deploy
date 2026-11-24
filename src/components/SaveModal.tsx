import { useState } from 'react';
import { ARMY_COLORS, bodiesOf, deployableUnits, DISPO_ABBR, findUnit, layoutLabel, missionFor, useStore } from '../store';
import { downloadBoardCapture } from '../lib/capture';
import { track } from '../lib/track';

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

export function SaveModal({ onClose }: { onClose: () => void }) {
  const { currentId, currentName, mine, opp, layout, saveBattle, user } = useStore();
  const [name, setName] = useState(currentName);
  const [capturing, setCapturing] = useState(false);
  const ok = name.trim().length > 0;
  const save = (asCopy = false) => {
    if (!ok) return;
    saveBattle(name.trim(), asCopy);
    onClose();
  };

  const capture = async () => {
    const svg = document.querySelector<SVGSVGElement>('svg.board');
    if (!svg) return;
    setCapturing(true);
    track('capture');
    const mission = missionFor(mine!, opp!).name;
    const title = name.trim() || mission;
    const subtitle = `${mission} · ${DISPO_ABBR[mine!]} vs ${DISPO_ABBR[opp!]} · ${layoutLabel(layout!)}`;
    // Noms de toutes les unités posées et réserves (unités pas encore sur la table) de chaque camp
    const s = useStore.getState();
    const units = Object.entries(s.placed).flatMap(([id, ps]) => {
      const info = findUnit(s, id);
      if (!info) return [];
      const bodies = bodiesOf(s, id, ps);
      return [{ name: info.unit.name, color: ARMY_COLORS[s.colors[info.side]].fill, models: bodies.map((b) => ({ x: b.x, y: b.y, r: b.r })) }];
    });
    const reserves = (['me', 'opp'] as const)
      .filter((side) => s.armies[side])
      .map((side) => ({
        color: ARMY_COLORS[s.colors[side]].fill,
        units: deployableUnits(s.armies[side]!.army, s).filter((u) => !s.placed[u.id]).map((u) => ({ name: u.name, count: u.models.length })),
      }));
    try {
      await downloadBoardCapture(svg, title, subtitle, `deploy5-${slug(title)}.png`, { units, reserves });
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal save-modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save(); }}>
        <header className="modal-head">
          <h2>Sauvegarder</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">✕</button>
        </header>
        <label className="field">
          <span>Nom de la bataille</span>
          <div className="field-row">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Tournoi Lyon R2" maxLength={60} />
            <span className="bdispo">{DISPO_ABBR[mine!]} vs {DISPO_ABBR[opp!]}</span>
          </div>
        </label>
        <p className="note left">Listes, carte et placements sont enregistrés {user ? 'dans ton compte' : 'sur cet appareil (sans compte)'}.</p>
        <div className="modal-actions">
          <button type="button" className="btn ghost capture-btn" disabled={capturing} onClick={capture} title="Image PNG de la table avec les unités placées">
            {capturing ? '…' : '⤓ Télécharger une capture'}
          </button>
          {currentId && <button type="button" className="btn ghost" disabled={!ok} onClick={() => save(true)}>Nouvelle copie</button>}
          <button type="submit" className="btn primary" disabled={!ok}>{currentId ? 'Mettre à jour' : 'Enregistrer'}</button>
        </div>
      </form>
    </div>
  );
}
