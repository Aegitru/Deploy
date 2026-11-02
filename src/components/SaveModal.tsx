import { useState } from 'react';
import { DISPO_ABBR, useStore } from '../store';

export function SaveModal({ onClose }: { onClose: () => void }) {
  const { currentId, currentName, mine, opp, saveBattle } = useStore();
  const [name, setName] = useState(currentName);
  const ok = name.trim().length > 0;
  const save = (asCopy = false) => {
    if (!ok) return;
    saveBattle(name.trim(), asCopy);
    onClose();
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
        <p className="note left">Listes, carte et placements sont enregistrés sur cet appareil.</p>
        <div className="modal-actions">
          {currentId && <button type="button" className="btn ghost" disabled={!ok} onClick={() => save(true)}>Nouvelle copie</button>}
          <button type="submit" className="btn primary" disabled={!ok}>{currentId ? 'Mettre à jour' : 'Enregistrer'}</button>
        </div>
      </form>
    </div>
  );
}
