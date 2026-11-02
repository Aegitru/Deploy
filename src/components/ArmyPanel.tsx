import { Fragment, useRef, useState } from 'react';
import { adjust, ARMY_COLORS, deployableUnits, partsOf, resolvedUnits, splitUnit, useStore, type ColorId, type Side } from '../store';
import type { Unit } from '../lib/parseList';
import { boardApi } from './Board';
import { AddUnitModal } from './AddUnitModal';

export const SIDE_TITLE: Record<Side, string> = { me: 'Mon armée', opp: 'Adversaire' };

type Drag = { unit: Unit; x: number; y: number; startX: number; startY: number; active: boolean };

/**
 * Liste des unités d'une armée. Glisser une ligne sur la table pour y poser l'unité ;
 * un simple appui la pose au centre de la vue (pratique au doigt).
 */
export function ArmyPanel({ side, onPlaced }: { side: Side; onPlaced?: () => void }) {
  const slot = useStore((s) => s.armies[side]);
  const placed = useStore((s) => s.placed);
  const store = useStore();
  const { splits, modelDelta: delta, place, select, split, merge, attach, detachPart } = store;
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const justDragged = useRef(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [attaching, setAttaching] = useState<string | null>(null); // personnage en attente d'une unité à rejoindre
  const [adding, setAdding] = useState(false);

  const addBtn = (
    <button className="icon-btn add-unit-btn" onClick={() => setAdding(true)} title="Ajouter une unité" aria-label="Ajouter une unité">+</button>
  );
  const addModal = adding && <AddUnitModal side={side} onClose={() => setAdding(false)} />;

  if (!slot) {
    return (
      <div className={`army-panel ${side}`}>
        <div className="army-head">
          <p className="panel-empty">Aucune liste. Ajoute-la avec le bouton « Listes ».</p>
          {addBtn}
        </div>
        {addModal}
      </div>
    );
  }

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
  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const isGroup = (u: Unit) => !splits[u.id] && partsOf(u).length > 1;
  const isLoneCharacter = (u: Unit) => !splits[u.id] && partsOf(u).length === 1 && partsOf(u)[0].character;

  const onTap = (unit: Unit) => {
    if (justDragged.current) { justDragged.current = false; return; }
    // Mode « attacher » : l'unité touchée accueille le personnage
    if (attaching) {
      if (unit.id !== attaching && !splits[unit.id]) attach(attaching, unit.id);
      setAttaching(null);
      return;
    }
    if (placed[unit.id]) { select(unit.id); onPlaced?.(); return; }
    const c = boardApi.viewCenter?.();
    if (c) { place(unit, c.x, c.y); onPlaced?.(); }
  };

  // Unités jouées (personnages attachés / détachés, socles ajoutés ou retirés) ;
  // une unité coupée est remplacée par ses deux moitiés
  const units = resolvedUnits(slot.army, store);
  const halves = (u: Unit) => splitUnit(u).map((h) => adjust(h, delta[h.id]));
  const deployable = deployableUnits(slot.army, store);
  const attachingName = attaching && units.find((u) => u.id === attaching)?.name;
  const total = deployable.length;
  const done = deployable.filter((u) => placed[u.id]).length;
  // Les unités déjà sur la table descendent en bas de la liste (une unité coupée : quand ses deux moitiés y sont)
  const isDone = (u: Unit) => (splits[u.id] ? halves(u).every((h) => placed[h.id]) : !!placed[u.id]);
  const ordered = [...units.filter((u) => !isDone(u)), ...units.filter(isDone)];

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const row = (u: Unit, child = false) => (
    <li
      key={u.id}
      className={[
        placed[u.id] && 'placed', child && 'child',
        attaching && (u.id === attaching ? 'attaching' : 'attach-target'),
      ].filter(Boolean).join(' ')}
      onPointerDown={(e) => onDown(e, u)}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => update(null)}
      onClick={() => onTap(u)}
    >
      <span className="grip" aria-hidden>{child ? '↳' : '⠿'}</span>
      <span className="count">{u.models.length}</span>
      <span className="uname">{u.name}</span>
      {isGroup(u) && (
        <button
          className="chev-btn"
          title={expanded.has(u.id) ? 'Replier' : 'Voir le personnage et l’escouade'}
          aria-label={expanded.has(u.id) ? `Replier ${u.name}` : `Déplier ${u.name}`}
          aria-expanded={expanded.has(u.id)}
          onPointerDown={stop}
          onClick={(e) => { stop(e); toggle(u.id); }}
        >
          {expanded.has(u.id) ? '▾' : '▸'}
        </button>
      )}
      {placed[u.id] && <span className="check">✓</span>}
      {u.models.some((m) => m.unknown) && <span className="warn" title="Socle inconnu : 32mm par défaut">?</span>}
      {!child && isLoneCharacter(u) && (
        <button
          className={`chain-btn ${attaching === u.id ? 'on' : ''}`}
          title="Attacher ce personnage à une unité"
          aria-label={`Attacher ${u.name} à une unité`}
          onPointerDown={stop}
          onClick={(e) => { stop(e); setAttaching(attaching === u.id ? null : u.id); }}
        >
          <ChainIcon />
        </button>
      )}
      {!child && u.models.length > 1 && (
        <button
          className="split-btn"
          title="Couper l'unité en deux"
          aria-label={`Couper ${u.name} en deux`}
          onPointerDown={stop}
          onClick={(e) => { stop(e); split(u); }}
        >
          Split
        </button>
      )}
    </li>
  );

  // Composantes d'une unité menée, chacune détachable
  const partRows = (u: Unit) =>
    partsOf(u).map((p, k) => (
      <li key={`${u.id}/${k}`} className="child part-row">
        <span className="grip" aria-hidden>↳</span>
        <span className="count">{p.count}</span>
        <span className="uname">{p.name}</span>
        <button
          className="chain-btn"
          title="Détacher de l'unité"
          aria-label={`Détacher ${p.name}`}
          onClick={() => detachPart(u.id, k)}
        >
          <BrokenChainIcon />
        </button>
      </li>
    ));

  return (
    <div className={`army-panel ${side}`}>
      <div className="army-head">
        <ColorPicker side={side} />
        <div>
          <div className="army-name">{slot.army.name}</div>
          <div className="army-sub">{slot.army.faction ?? 'Faction inconnue'} · {done}/{total} déployées</div>
        </div>
        {addBtn}
      </div>
      {addModal}
      {attaching && (
        <div className="attach-hint">
          <span>Touche l'unité que <b>{attachingName}</b> rejoint</span>
          <button className="link-btn" onClick={() => setAttaching(null)}>Annuler</button>
        </div>
      )}
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
            <Fragment key={u.id}>
              {row(u)}
              {isGroup(u) && expanded.has(u.id) && partRows(u)}
            </Fragment>
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

function ChainIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M6.5 9.5l3-3" />
      <path d="M7.2 4.6l1.1-1.1a2.6 2.6 0 0 1 3.7 3.7l-1.1 1.1" />
      <path d="M8.8 11.4l-1.1 1.1a2.6 2.6 0 0 1-3.7-3.7l1.1-1.1" />
    </svg>
  );
}

function BrokenChainIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M7.2 4.6l1.1-1.1a2.6 2.6 0 0 1 3.7 3.7l-1.1 1.1" />
      <path d="M8.8 11.4l-1.1 1.1a2.6 2.6 0 0 1-3.7-3.7l1.1-1.1" />
      <path d="M3 3l1.4 1.4M13 13l-1.4-1.4M6 1.5v1.6M10 14.5v-1.6" />
    </svg>
  );
}
