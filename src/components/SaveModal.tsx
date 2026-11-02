import { useState } from 'react';
import { DISPO_ABBR, layoutLabel, missionFor, useStore } from '../store';
import { downloadBoardCapture } from '../lib/capture';

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

export function SaveModal({ onClose }: { onClose: () => void }) {
  const { currentId, currentName, mine, opp, layout, saveBattle } = useStore();
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
    const mission = missionFor(mine!, opp!).name;
    const title = name.trim() || mission;
    const subtitle = `${mission} · ${DISPO_ABBR[mine!]} vs ${DISPO_ABBR[opp!]} · ${layoutLabel(layout!)}`;
    try {
      await downloadBoardCapture(svg, title, subtitle, `deploy-${slug(title)}.png`);
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
        <p className="note left">Listes, carte et placements sont enregistrés dans ton compte.</p>
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
