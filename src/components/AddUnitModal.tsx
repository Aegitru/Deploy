import { useState } from 'react';
import { useStore, type Side } from '../store';
import type { Base } from '../lib/bases';
import { SIDE_TITLE } from './ArmyPanel';

type Footprint = 'circle' | 'oval' | 'rect';

const FOOTPRINTS: { id: Footprint; label: string }[] = [
  { id: 'circle', label: 'Socle rond' },
  { id: 'oval', label: 'Socle ovale' },
  { id: 'rect', label: 'Frame' },
];

/** Création d'une unité à la main : nom, nombre de socles et empreinte (dimensions en mm). */
export function AddUnitModal({ side, onClose }: { side: Side; onClose: () => void }) {
  const addUnit = useStore((s) => s.addUnit);
  const [name, setName] = useState('');
  const [count, setCount] = useState('1');
  const [shape, setShape] = useState<Footprint>('circle');
  const [a, setA] = useState('');
  const [b, setB] = useState('');

  const n = Math.floor(Number(count));
  const x = Number(a), y = Number(b);
  const sizeOk = x > 0 && (shape === 'circle' || y > 0);
  const ok = name.trim().length > 0 && n >= 1 && n <= 100 && sizeOk;

  const create = () => {
    if (!ok) return;
    // Ovales et frames : grand axe horizontal, comme les socles de la liste
    const base: Base = shape === 'circle' ? { shape, d: x } : { shape, w: Math.max(x, y), h: Math.min(x, y) };
    addUnit(side, name.trim(), n, base);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal add-unit-modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); create(); }}>
        <header className="modal-head">
          <h2>Ajouter une unité</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">✕</button>
        </header>
        <p className="note left">{SIDE_TITLE[side]}</p>
        <label className="field">
          <span>Nom</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Rhino" maxLength={60} />
        </label>
        <label className="field">
          <span>Nombre de socles</span>
          <input type="number" inputMode="numeric" min={1} max={100} value={count} onChange={(e) => setCount(e.target.value)} />
        </label>
        <div className="field">
          <span>Empreinte</span>
          <div className="segmented">
            {FOOTPRINTS.map((f) => (
              <button key={f.id} type="button" className={shape === f.id ? 'on' : ''} onClick={() => setShape(f.id)}>{f.label}</button>
            ))}
          </div>
        </div>
        {shape === 'circle' ? (
          <label className="field">
            <span>Diamètre (mm)</span>
            <input type="number" inputMode="decimal" min={1} value={a} onChange={(e) => setA(e.target.value)} placeholder="32" />
          </label>
        ) : (
          <div className="field">
            <span>{shape === 'oval' ? 'Tailles du socle (mm)' : 'Largeur × longueur (mm)'}</span>
            <div className="field-row">
              <input type="number" inputMode="decimal" min={1} value={a} onChange={(e) => setA(e.target.value)} placeholder={shape === 'oval' ? '60' : '70'} aria-label={shape === 'oval' ? 'Petit axe' : 'Largeur'} />
              <span>×</span>
              <input type="number" inputMode="decimal" min={1} value={b} onChange={(e) => setB(e.target.value)} placeholder={shape === 'oval' ? '35' : '115'} aria-label={shape === 'oval' ? 'Grand axe' : 'Longueur'} />
            </div>
          </div>
        )}
        <div className="modal-actions">
          <button type="submit" className="btn primary" disabled={!ok}>Créer</button>
        </div>
      </form>
    </div>
  );
}
