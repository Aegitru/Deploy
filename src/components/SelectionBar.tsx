import { useLayoutEffect, useRef, useState } from 'react';
import { defaultOpts, findUnit, useStore, type ModelPos } from '../store';

/** Rotation d'une formation autour de son centre (chaque socle pivote aussi). */
function rotate(ps: ModelPos[], deg: number): ModelPos[] {
  const cx = ps.reduce((s, p) => s + p.x, 0) / ps.length;
  const cy = ps.reduce((s, p) => s + p.y, 0) / ps.length;
  const a = (deg * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  return ps.map((p) => ({
    x: cx + (p.x - cx) * cos - (p.y - cy) * sin,
    y: cy + (p.x - cx) * sin + (p.y - cy) * cos,
    rot: (p.rot + deg) % 360,
  }));
}

const STEP = 45;
const GAPS = [
  { v: 0, label: 'Collés' },
  { v: 0.5, label: '½"' },
  { v: 1, label: '1"' },
  { v: 2, label: '2"' },
];
const AURAS = [
  { v: 0, label: 'Aucune' },
  { v: 1, label: '1"' },
  { v: 2, label: '2"' },
  { v: 6, label: '6"' },
  { v: 8, label: '8"' },
  { v: 12, label: '12"' },
];

/** Petit bonhomme suivi d'un + ou d'un − */
function ModelIcon({ sign }: { sign: string }) {
  return (
    <span className="model-icon">
      <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" aria-hidden>
        <circle cx="6" cy="3" r="2.4" />
        <path d="M2 7.2C2 6.5 2.6 6 3.3 6h5.4c.7 0 1.3.5 1.3 1.2V11H8.4v4.2H3.6V11H2z" />
      </svg>
      <b>{sign}</b>
    </span>
  );
}

type Anchor = 'top' | 'bottom';

/**
 * Le menu se place en haut de la table, ou en bas s'il masquerait l'unité sélectionnée.
 * Recalculé quand la vue (zoom, déplacement), l'unité ou l'ouverture du panneau changent.
 */
function useAnchor(selected: string | null, deps: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<Anchor>('top');
  useLayoutEffect(() => {
    const el = ref.current;
    const unit = selected ? document.querySelector(`[data-unit="${CSS.escape(selected)}"]`) : null;
    if (!el || !unit || !el.parentElement) return;
    const box = el.parentElement.getBoundingClientRect();
    const me = el.getBoundingClientRect();
    const u = unit.getBoundingClientRect();
    // Surface masquée si le menu était placé à (left, top) ; en haut il est centré, en bas aligné à gauche (cf. CSS)
    const overlap = (left: number, top: number) => {
      const h = Math.max(0, Math.min(top + me.height, u.bottom) - Math.max(top, u.top));
      const w = Math.max(0, Math.min(left + me.width, u.right) - Math.max(left, u.left));
      return h * w;
    };
    const atTop = overlap(box.left + (box.width - me.width) / 2, box.top + 10);
    const atBottom = overlap(box.left + 10, box.bottom - 10 - me.height);
    setAnchor(atTop === 0 ? 'top' : atBottom < atTop ? 'bottom' : 'top');
  }, [selected, deps]);
  return { ref, anchor };
}

type Props = { singleModel: boolean; setSingleModel: (v: boolean) => void; viewKey: string };

export function SelectionBar({ singleModel, setSingleModel, viewKey }: Props) {
  const store = useStore();
  const { selected, placed, unitOpts, move, setUnitOpts, addModel, removeModel } = store;
  const [tools, setTools] = useState(false);
  const ps = selected ? placed[selected] : undefined;
  const { ref, anchor } = useAnchor(selected, `${viewKey}|${tools}|${JSON.stringify(ps ?? null)}`);
  if (!selected || !ps) return null;
  const info = findUnit(store, selected);
  if (!info) return null;
  const { unit, side } = info;
  const multi = ps.length > 1;
  const opts = unitOpts[selected] ?? defaultOpts(unit);
  const rowChoices = [1, 2, 3, 4, 5].filter((n) => n <= ps.length);
  if (ps.length > 5) rowChoices.push(defaultOpts(unit).perRow > 5 ? defaultOpts(unit).perRow : 10);

  return (
    <div ref={ref} className={`selection-wrap ${side} ${anchor}`} onPointerDown={(e) => e.stopPropagation()}>
      <div className="selection-bar">
        <span className="sel-name" title={unit.name}>
          {unit.name} <em>· {ps.length}</em>
        </span>
        <button onClick={() => move(selected, rotate(ps, -STEP))} aria-label="Pivoter à gauche" title="Pivoter de 45° à gauche">⟲</button>
        <button onClick={() => move(selected, rotate(ps, STEP))} aria-label="Pivoter à droite" title="Pivoter de 45° à droite">⟳</button>
        <button className={tools ? 'on' : ''} onClick={() => setTools(!tools)} title="Formation et zones">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="4" r="2" /><circle cx="8" cy="4" r="2" /><circle cx="12.5" cy="4" r="2" /><circle cx="5.7" cy="10" r="2" /><circle cx="10.3" cy="10" r="2" /><circle cx="8" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" opacity=".7" /></svg>
        </button>
      </div>

      {tools && (
        <div className="tools-panel">
          <div className="tool-row">
            <span>Figurines</span>
            <div className="chips">
              <button className="model-btn" onClick={() => removeModel(selected)} disabled={ps.length <= 1} aria-label="Retirer un socle" title="Retirer un socle">
                <ModelIcon sign="−" />
              </button>
              <button className="model-btn" onClick={() => addModel(selected)} aria-label="Ajouter un socle" title="Ajouter un socle">
                <ModelIcon sign="+" />
              </button>
            </div>
          </div>
          {multi && (
            <>
              <div className="tool-row">
                <span>Par rang</span>
                <div className="chips">
                  {rowChoices.map((n) => (
                    <button key={n} className={opts.perRow === n ? 'on' : ''} onClick={() => setUnitOpts(unit, { perRow: n })}>{n}</button>
                  ))}
                </div>
              </div>
              <div className="tool-row">
                <span>Écart</span>
                <div className="chips">
                  {GAPS.map((g) => (
                    <button key={g.v} className={opts.gap === g.v ? 'on' : ''} onClick={() => setUnitOpts(unit, { gap: g.v })}>{g.label}</button>
                  ))}
                </div>
              </div>
            </>
          )}
          <div className="tool-row">
            <span>Zone</span>
            <div className="chips">
              {AURAS.map((a) => (
                <button key={a.v} className={opts.aura === a.v ? 'on' : ''} onClick={() => setUnitOpts(unit, { aura: a.v })}>{a.label}</button>
              ))}
            </div>
          </div>
          {multi && (
            <div className="tool-row">
              <span>Déplacer</span>
              <div className="chips">
                <button className={!singleModel ? 'on' : ''} onClick={() => setSingleModel(false)}>Unité</button>
                <button className={singleModel ? 'on' : ''} onClick={() => setSingleModel(true)}>Figurine</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
