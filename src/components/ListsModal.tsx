import { useState } from 'react';
import { useStore, type Side } from '../store';
import { SIDE_TITLE } from './ArmyPanel';

export function ListsModal({ onClose }: { onClose: () => void }) {
  const armies = useStore((s) => s.armies);
  const { importList, clearList } = useStore();
  const [side, setSide] = useState<Side>(armies.me ? (armies.opp ? 'me' : 'opp') : 'me');
  const [drafts, setDrafts] = useState<Record<Side, string>>({ me: armies.me?.text ?? '', opp: armies.opp?.text ?? '' });

  const slot = armies[side];
  const dirty = drafts[side].trim() !== (slot?.text ?? '').trim();

  const loadFile = async (f?: File) => {
    if (f) setDrafts({ ...drafts, [side]: await f.text() });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal lists-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>Listes d'armée</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">✕</button>
        </header>

        <div className="segmented">
          {(['me', 'opp'] as const).map((s) => (
            <button key={s} className={`${s} ${side === s ? 'on' : ''}`} onClick={() => setSide(s)}>
              <span className="army-dot" /> {SIDE_TITLE[s]} {armies[s] && <small>✓</small>}
            </button>
          ))}
        </div>

        <textarea
          value={drafts[side]}
          onChange={(e) => setDrafts({ ...drafts, [side]: e.target.value })}
          placeholder="Colle ici l'export texte de l'app Warhammer 40,000 ou de NewRecruit…"
          spellCheck={false}
        />

        <div className="modal-actions">
          <label className="btn ghost">
            Fichier .txt
            <input type="file" accept=".txt,text/plain" hidden onChange={(e) => loadFile(e.target.files?.[0])} />
          </label>
          {slot && <button className="btn ghost" onClick={() => { clearList(side); setDrafts({ ...drafts, [side]: '' }); }}>Effacer</button>}
          <button className="btn primary" disabled={!drafts[side].trim() || (!dirty && !!slot)} onClick={() => importList(side, drafts[side])}>
            {slot ? 'Remplacer' : 'Importer'}
          </button>
        </div>
        {slot && dirty && <p className="note">Remplacer la liste retire ses unités de la table.</p>}

        {slot && (
          <div className="import-summary">
            <div className="army-name">{slot.army.name}</div>
            <div className="army-sub">
              {slot.army.faction ?? 'Faction inconnue'} · {slot.army.units.length} unités · {slot.army.units.reduce((n, u) => n + u.models.length, 0)} figurines
            </div>
            {slot.army.warnings.map((w) => <p key={w} className="warning">{w}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}
