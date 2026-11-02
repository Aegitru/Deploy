import { Fragment, useRef, useState } from 'react';
import { adjust, ARMY_COLORS, deployableUnits, splitUnit, useStore, type ColorId, type Side } from '../store';
import type { Unit } from '../lib/parseList';
import { boardApi } from './Board';

export const SIDE_TITLE: Record<Side, string> = { me: 'Mon armée', opp: 'Adversaire' };

type Drag = { unit: Unit; x: number; y: number; startX: number; startY: number; active: boolean };

/**
 * Liste des unités d'une armée. Glisser une ligne sur la table pour y poser l'unité ;
 * un simple appui la pose au centre de la vue (pratique au doigt).
 */
export function ArmyPanel({ side, onPlaced }: { side: Side; onPlaced?: () => void }) {
  const slot = useStore((s) => s.armies[side]);
  const placed = useStore((s) => s.placed);
  const splits = useStore((s) => s.splits);
  const delta = useStore((s) => s.modelDelta);
  const { place, select, split, merge } = useStore();
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const justDragged = useRef(false);

  if (!slot) return <p className="panel-empty">Aucune liste. Ajoute-la avec le bouton « Listes ».</p>;

  const update = (d: Drag | null) => { dragRef.current = d; setDrag(d); };

  const onDown = (e: React.PointerEvent, unit: Unit) => {
    // Au doigt, seule la poignée déclenche le glisser : le reste de la ligne laisse défiler la liste.
    const fromGrip = (e.target as Element).closest('.grip');
    if (e.pointerType !== 'mouse' && !fromGrip) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    update({ unit, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, active: false });
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const active = d.active || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6;
    update({ ...d, x: e.clientX, y: e.clientY, active });
  };
  const onUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    update(null);
    if (!d?.active) return;
    justDragged.current = true; // le "click" qui suit le relâchement ne doit pas reposer l'unité
    const p = boardApi.clientToBoard?.(e.clientX, e.clientY);
    if (p) { place(d.unit, p.x, p.y); onPlaced?.(); }
  };
  const onTap = (unit: Unit) => {
    if (justDragged.current) { justDragged.current = false; return; }
    if (placed[unit.id]) { select(unit.id); onPlaced?.(); return; }
    const c = boardApi.viewCenter?.();
    if (c) { place(unit, c.x, c.y); onPlaced?.(); }
  };

  // Unités déployables : une unité coupée est remplacée par ses deux moitiés
  // (avec les socles ajoutés ou retirés à la main)
  const units = slot.army.units.map((u) => adjust(u, delta[u.id]));
  const halves = (u: Unit) => splitUnit(u).map((h) => adjust(h, delta[h.id]));
  const deployable = deployableUnits(slot.army, splits, delta);
  const total = deployable.length;
  const done = deployable.filter((u) => placed[u.id]).length;
  // Les unités déjà sur la table descendent en bas de la liste (une unité coupée : quand ses deux moitiés y sont)
  const isDone = (u: Unit) => (splits[u.id] ? halves(u).every((h) => placed[h.id]) : !!placed[u.id]);
  const ordered = [...units.filter((u) => !isDone(u)), ...units.filter(isDone)];

  const row = (u: Unit, child = false) => (
    <li
      key={u.id}
      className={`${placed[u.id] ? 'placed' : ''}${child ? ' child' : ''}`}
      onPointerDown={(e) => onDown(e, u)}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => update(null)}
      onClick={() => onTap(u)}
    >
      <span className="grip" aria-hidden>{child ? '↳' : '⠿'}</span>
      <span className="count">{u.models.length}</span>
      <span className="uname">{u.name}</span>
      {placed[u.id] && <span className="check">✓</span>}
      {u.models.some((m) => m.unknown) && <span className="warn" title="Socle inconnu : 32mm par défaut">?</span>}
      {!child && u.models.length > 1 && (
        <button
          className="split-btn"
          title="Couper l'unité en deux"
          aria-label={`Couper ${u.name} en deux`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); split(u); }}
        >
          Split
        </button>
      )}
    </li>
  );

  return (
    <div className={`army-panel ${side}`}>
      <div className="army-head">
        <ColorPicker side={side} />
        <div>
          <div className="army-name">{slot.army.name}</div>
          <div className="army-sub">{slot.army.faction ?? 'Faction inconnue'} · {done}/{total} déployées</div>
        </div>
      </div>
      <ul className="unit-list">
        {ordered.map((u) =>
          splits[u.id] ? (
            <Fragment key={u.id}>
              <li className="split-parent">
                <span className="grip" aria-hidden>⠿</span>
                <span className="count">{u.models.length}</span>
                <span className="uname">{u.name}</span>
                <button className="split-btn shown" title="Réunir les deux moitiés" onClick={() => merge(u)}>Réunir</button>
              </li>
              {halves(u).map((half) => row(half, true))}
            </Fragment>
          ) : (
            row(u)
          ),
        )}
      </ul>
      {drag?.active && (
        <div className={`drag-ghost ${side}`} style={{ left: drag.x, top: drag.y }}>
          <span className="army-dot" /> {drag.unit.name}
        </div>
      )}
    </div>
  );
}

/** Pastille de couleur de l'armée ; un appui ouvre les 5 couleurs proposées. */
function ColorPicker({ side }: { side: Side }) {
  const color = useStore((s) => s.colors[side]);
  const setColor = useStore((s) => s.setColor);
  const [open, setOpen] = useState(false);
  return (
    <div className="color-picker">
      <button className="swatch current" style={{ background: ARMY_COLORS[color].fill }} onClick={() => setOpen(!open)} title="Couleur de l'armée" aria-label="Couleur de l'armée" />
      {open && (
        <div className="swatches">
          {(Object.keys(ARMY_COLORS) as ColorId[]).map((id) => (
            <button
              key={id}
              className={`swatch ${id === color ? 'on' : ''}`}
              style={{ background: ARMY_COLORS[id].fill }}
              title={ARMY_COLORS[id].label}
              aria-label={ARMY_COLORS[id].label}
              onClick={() => { setColor(side, id); setOpen(false); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
