import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BOARD_H, BOARD_W, findUnit, useStore, type ModelPos } from '../store';
import { MM_PER_INCH, type Base } from '../lib/bases';
import { SelectionBar } from './SelectionBar';

type Pt = { x: number; y: number };
type ViewBox = { x: number; y: number; w: number; h: number };

const MARGIN = 0.6;
const FIT: ViewBox = { x: -MARGIN, y: -MARGIN, w: BOARD_W + 2 * MARGIN, h: BOARD_H + 2 * MARGIN };
const MIN_W = 4; // zoom max : 4" de large à l'écran

/** Pont pour le glisser-déposer depuis les listes d'armée (hors du SVG). */
export const boardApi: { clientToBoard?: (x: number, y: number) => Pt | null; viewCenter?: () => Pt } = {};

export const isOffBoard = (p: Pt) => p.x < 0 || p.y < 0 || p.x > BOARD_W || p.y > BOARD_H;
export const centroid = (ps: ModelPos[]): Pt => ({
  x: ps.reduce((s, p) => s + p.x, 0) / ps.length,
  y: ps.reduce((s, p) => s + p.y, 0) / ps.length,
});

type Gesture =
  | { mode: 'none' }
  | { mode: 'pan'; moved: boolean; from?: Pt; line?: string; del?: string }
  | { mode: 'pinch'; dist: number }
  | { mode: 'drag'; unitId: string; idx: number | null; start: Pt; orig: ModelPos[]; moved: boolean }
  | { mode: 'lineEnd'; id: string; end: 'a' | 'b' };

export function Board({ image }: { image: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [vb, setVb] = useState<ViewBox>(FIT);
  const [pxPerIn, setPxPerIn] = useState(10);
  const [preview, setPreview] = useState<{ unitId: string; positions: ModelPos[]; single: boolean } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [singleModel, setSingleModel] = useState(false);
  // Crayon : actif, point de départ posé, position du curseur (aperçu à la souris), ligne sélectionnée
  const [pen, setPen] = useState(false);
  const [penStart, setPenStart] = useState<Pt | null>(null);
  const [penHover, setPenHover] = useState<Pt | null>(null);
  const [lineSel, setLineSel] = useState<string | null>(null);
  const [lineDrag, setLineDrag] = useState<{ id: string; end: 'a' | 'b'; p: Pt } | null>(null); // extrémité en cours de déplacement
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<Gesture>({ mode: 'none' });

  const store = useStore();
  const { placed, unitOpts, selected, showLabels, toggleLabels, move, remove, select, addLine, removeLine, moveLineEnd } = store;
  const lines = (store.lines ?? []).map((l) => (lineDrag?.id === l.id ? { ...l, [lineDrag.end]: lineDrag.p } : l));

  // Un nouvel appui sur le crayon annule le tracé en cours et le désactive
  const togglePen = () => {
    setPen(!pen);
    setPenStart(null);
    setPenHover(null);
    setLineSel(null);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPen(false); setPenStart(null); setLineSel(null); } };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const toSvg = (cx: number, cy: number): Pt => {
    const ctm = svgRef.current!.getScreenCTM()!.inverse();
    const p = new DOMPoint(cx, cy).matrixTransform(ctm);
    return { x: p.x, y: p.y };
  };

  const zoomAt = (p: Pt, factor: number) =>
    setVb((v) => {
      const w = Math.min(FIT.w * 1.3, Math.max(MIN_W, v.w / factor));
      const f = v.w / w;
      return { x: p.x - (p.x - v.x) / f, y: p.y - (p.y - v.y) / f, w, h: v.h / f };
    });

  // Pixels par pouce à l'écran (sert aux tailles de texte et de traits constantes)
  useLayoutEffect(() => {
    const svg = svgRef.current!;
    const update = () => {
      const r = svg.getBoundingClientRect();
      setPxPerIn(Math.min(r.width / vb.w, r.height / vb.h));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(svg);
    return () => ro.disconnect();
  }, [vb.w, vb.h]);

  useEffect(() => {
    const svg = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(toSvg(e.clientX, e.clientY), Math.exp(-e.deltaY * 0.0015));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    boardApi.clientToBoard = (x, y) => {
      const r = svg.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
      return toSvg(x, y);
    };
    boardApi.viewCenter = () => {
      const r = svg.getBoundingClientRect();
      const c = toSvg(r.left + r.width / 2, r.top + r.height / 2);
      return { x: Math.min(BOARD_W - 3, Math.max(3, c.x)), y: Math.min(BOARD_H - 3, Math.max(3, c.y)) };
    };
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const pinchInfo = () => {
    const [a, b] = [...pointers.current.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    svgRef.current!.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      setPreview(null);
      gesture.current = { mode: 'pinch', dist: pinchInfo().dist };
      return;
    }
    if (pointers.current.size > 2) return;
    const from = { x: e.clientX, y: e.clientY };
    // Crayon actif : un appui pose un point (un glisser fait défiler la table), les unités ne bougent pas
    if (pen) { gesture.current = { mode: 'pan', moved: false, from }; return; }
    const target = e.target as Element;
    // Extrémité d'une ligne sélectionnée : on la fait glisser
    const end = target.closest('[data-line-end]')?.getAttribute('data-line-end');
    if (end) {
      const [id, which] = end.split('|');
      gesture.current = { mode: 'lineEnd', id, end: which as 'a' | 'b' };
      return;
    }
    const del = target.closest('[data-line-del]')?.getAttribute('data-line-del');
    const line = target.closest('[data-line]')?.getAttribute('data-line');
    if (del || line) { gesture.current = { mode: 'pan', moved: false, from, del: del ?? undefined, line: line ?? undefined }; return; }
    const el = target.closest('[data-unit]');
    const unitId = el?.getAttribute('data-unit');
    if (unitId && placed[unitId]) {
      const idx = Number((e.target as Element).getAttribute('data-idx'));
      select(unitId);
      gesture.current = {
        mode: 'drag', unitId, idx: singleModel && !Number.isNaN(idx) ? idx : null,
        start: toSvg(e.clientX, e.clientY), orig: placed[unitId], moved: false,
      };
    } else {
      gesture.current = { mode: 'pan', moved: false, from };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    // Souris au survol (bouton relâché) : aperçu de la ligne en cours de tracé
    if (!prev) { if (pen && penStart) setPenHover(toSvg(e.clientX, e.clientY)); return; }
    const cur = { x: e.clientX, y: e.clientY };
    const g = gesture.current;
    if (g.mode === 'pinch') {
      const before = pinchInfo();
      pointers.current.set(e.pointerId, cur);
      const after = pinchInfo();
      const a = toSvg(before.mid.x, before.mid.y), b = toSvg(after.mid.x, after.mid.y);
      setVb((v) => ({ ...v, x: v.x + a.x - b.x, y: v.y + a.y - b.y }));
      zoomAt(a, after.dist / g.dist);
      g.dist = after.dist;
      return;
    }
    pointers.current.set(e.pointerId, cur);
    if (g.mode === 'pan') {
      // Un léger tremblement du doigt reste un appui (utile pour poser les points du crayon)
      if (!g.from || Math.hypot(cur.x - g.from.x, cur.y - g.from.y) > 6) g.moved = true;
      if (!g.moved) return;
      const a = toSvg(prev.x, prev.y), b = toSvg(cur.x, cur.y);
      setVb((v) => ({ ...v, x: v.x + a.x - b.x, y: v.y + a.y - b.y }));
    } else if (g.mode === 'lineEnd') {
      setLineDrag({ id: g.id, end: g.end, p: toSvg(cur.x, cur.y) });
    } else if (g.mode === 'drag') {
      const p = toSvg(cur.x, cur.y);
      const dx = p.x - g.start.x, dy = p.y - g.start.y;
      if (Math.hypot(dx, dy) * pxPerIn > 3) g.moved = true;
      if (!g.moved) return;
      setPreview({
        unitId: g.unitId, single: g.idx !== null,
        positions: g.orig.map((m, i) => (g.idx === null || g.idx === i ? { ...m, x: m.x + dx, y: m.y + dy } : m)),
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g.mode === 'drag' && preview) {
      // Une unité relâchée hors de la table est retirée (une figurine seule revient à sa place)
      if (g.idx === null && isOffBoard(centroid(preview.positions))) remove(g.unitId);
      else if (g.idx !== null && isOffBoard(preview.positions[g.idx])) move(g.unitId, g.orig);
      else move(g.unitId, preview.positions);
    }
    if (g.mode === 'lineEnd' && lineDrag) {
      moveLineEnd(lineDrag.id, lineDrag.end, lineDrag.p);
      setLineDrag(null);
    }
    if (g.mode === 'pan' && !g.moved) {
      if (pen) {
        // 1er appui : point de départ ; 2e appui : la ligne est tracée et le crayon se désactive
        const p = toSvg(e.clientX, e.clientY);
        if (!penStart) setPenStart(p);
        else { addLine(penStart, p); setPen(false); setPenStart(null); setPenHover(null); }
      } else if (g.del) {
        removeLine(g.del);
        setLineSel(null);
      } else if (g.line) {
        setLineSel(g.line === lineSel ? null : g.line);
      } else {
        select(null);
        setLineSel(null);
      }
    }
    setPreview(null);
    gesture.current = pointers.current.size === 1 ? { mode: 'pan', moved: true } : { mode: 'none' };
  };

  const stroke = 1.2 / pxPerIn;
  const labelSize = 13 / pxPerIn;

  const units = Object.entries(placed)
    .map(([id, ps]) => ({ id, ps: preview?.unitId === id ? preview.positions : ps, info: findUnit(store, id) }))
    .filter((u) => u.info);

  const dragging = preview && units.find((u) => u.id === preview.unitId);
  const removing = !!dragging && !preview.single && isOffBoard(centroid(dragging.ps));

  // Pendant un déplacement : point de départ (positions encore dans le store) et distance parcourue
  const start = dragging ? placed[dragging.id] : null;
  let measure: { from: Pt; to: Pt; dist: number } | null = null;
  if (dragging && start && !removing) {
    const moved = preview.single ? dragging.ps.findIndex((p, i) => p.x !== start[i].x || p.y !== start[i].y) : -1;
    const from = moved >= 0 ? start[moved] : centroid(start);
    const to = moved >= 0 ? dragging.ps[moved] : centroid(dragging.ps);
    measure = { from, to, dist: Math.hypot(to.x - from.x, to.y - from.y) };
  }

  return (
    <div className="board-wrap">
      <svg
        ref={svgRef}
        className={`board${pen ? ' drawing' : ''}`}
        data-board
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <rect x={-50} y={-50} width={BOARD_W + 100} height={BOARD_H + 100} className="board-outside" />
        <image href={image} x={0} y={0} width={BOARD_W} height={BOARD_H} preserveAspectRatio="none" />
        <rect x={0} y={0} width={BOARD_W} height={BOARD_H} className="board-edge" strokeWidth={stroke * 1.5} />

        {/* Zones : chaque socle grossi du rayon choisi ; l'opacité de groupe fusionne les bulles sans surcharge */}
        {units.map(({ id, ps, info }) => {
          const aura = unitOpts[id]?.aura ?? 0;
          if (!aura) return null;
          return (
            <g key={id} className={`aura ${info!.side}`} pointerEvents="none">
              {ps.map((p, i) => <Expanded key={i} base={info!.unit.models[i]?.base} pos={p} by={aura} />)}
            </g>
          );
        })}

        {dragging && start && measure && (
          <g className={`move-start ${dragging.info!.side}`} pointerEvents="none" strokeWidth={stroke}>
            {start.map((p, i) => (
              <Expanded key={i} base={dragging.info!.unit.models[i]?.base} pos={p} by={0} />
            ))}
            <line x1={measure.from.x} y1={measure.from.y} x2={measure.to.x} y2={measure.to.y} strokeWidth={stroke * 1.5} strokeDasharray={`${4 / pxPerIn} ${3 / pxPerIn}`} />
            <circle cx={measure.from.x} cy={measure.from.y} r={3 / pxPerIn} />
          </g>
        )}

        {units.map(({ id, ps, info }) => {
          const { unit, side } = info!;
          const isSel = selected === id;
          const ghost = removing && preview?.unitId === id;
          return (
            <g
              key={id}
              data-unit={id}
              className={`unit ${side}${isSel ? ' selected' : ''}${ghost ? ' removing' : ''}`}
              onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(id)}
              onPointerLeave={() => setHovered((h) => (h === id ? null : h))}
            >
              {ps.map((p, i) => (
                <Token key={i} idx={i} base={unit.models[i]?.base} pos={p} label={unit.label} stroke={stroke} pxPerIn={pxPerIn} />
              ))}
            </g>
          );
        })}

        {units
          .filter(({ id }) => showLabels || hovered === id || selected === id)
          .map(({ id, ps, info }) => {
            const c = centroid(ps);
            const top = Math.min(...ps.map((p, i) => p.y - extent(info!.unit.models[i]?.base) / 2));
            return (
              <text key={id} className={`unit-label ${info!.side}`} x={c.x} y={top - labelSize * 0.5} fontSize={labelSize} strokeWidth={labelSize * 0.28}>
                {info!.unit.name}
              </text>
            );
          })}

        {/* Lignes du crayon : longueur au milieu ; une ligne touchée affiche une croix pour la supprimer */}
        {lines.map((l) => (
          <Ruler key={l.id} id={l.id} a={l.a} b={l.b} px={pxPerIn} selected={lineSel === l.id} />
        ))}
        {pen && penStart && (
          <g className="ruler drafting" pointerEvents="none">
            <circle cx={penStart.x} cy={penStart.y} r={END_R / pxPerIn} strokeWidth={END_STROKE / pxPerIn} className="ruler-end" />
            {penHover && <Ruler a={penStart} b={penHover} px={pxPerIn} />}
          </g>
        )}

        {measure && (
          <text
            className={`move-distance ${dragging!.info!.side}`}
            x={(measure.from.x + measure.to.x) / 2}
            y={(measure.from.y + measure.to.y) / 2 - labelSize * 0.6}
            fontSize={labelSize * 1.3}
            strokeWidth={labelSize * 0.35}
          >
            {measure.dist.toFixed(1)}"
          </text>
        )}
      </svg>

      {removing && <div className="drop-hint">Relâcher pour retirer de la table</div>}

      <SelectionBar singleModel={singleModel} setSingleModel={setSingleModel} viewKey={`${vb.x},${vb.y},${vb.w},${pxPerIn}`} />

      <div className="zoom-ctrl">
        <button className={`labels-btn ${showLabels ? 'on' : ''}`} onClick={toggleLabels} title="Afficher les noms des unités">Aa</button>
        <button
          className={`pen-btn ${pen ? 'on' : ''}`}
          onClick={togglePen}
          aria-pressed={pen}
          aria-label="Crayon : tracer une ligne"
          title={pen ? (penStart ? 'Touche le point d’arrivée (ou annule)' : 'Touche le point de départ (ou annule)') : 'Crayon : mesurer une ligne droite'}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
            <path d="M12.5 2.5l3 3L6 15H3v-3z" />
            <path d="M10.5 4.5l3 3" />
          </svg>
        </button>
        <button onClick={() => setVb(FIT)} aria-label="Voir toute la table" title="Voir toute la table">⤢</button>
      </div>
    </div>
  );
}

// Extrémités des lignes, en pixels écran : point blanc bien visible, contour noir fin
const END_R = 4.5;
const END_STROKE = 1;

/**
 * Ligne mesurée : trait épais à liseré sombre, extrémités pointées et longueur en pouces.
 * Sélectionnée, ses extrémités deviennent des poignées à faire glisser.
 */
function Ruler({ id, a, b, px, selected = false }: { id?: string; a: Pt; b: Pt; px: number; selected?: boolean }) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const font = 14 / px;
  const del = { x: mid.x + font * 2.4, y: mid.y - font * 1.15 }; // à droite de la longueur
  const r = (selected ? END_R * 1.5 : END_R) / px;
  return (
    <g className={`ruler${selected ? ' selected' : ''}`} data-line={id}>
      <line className="ruler-hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={16 / px} />
      <line className="ruler-halo" x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={5 / px} />
      <line className="ruler-line" x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={2.5 / px} />
      {(['a', 'b'] as const).map((end) => {
        const p = end === 'a' ? a : b;
        return (
          <g key={end} data-line-end={selected && id ? `${id}|${end}` : undefined} className={selected ? 'ruler-handle' : undefined}>
            {selected && <circle className="ruler-end-hit" cx={p.x} cy={p.y} r={14 / px} />}
            <circle className="ruler-end" cx={p.x} cy={p.y} r={r} strokeWidth={END_STROKE / px} />
          </g>
        );
      })}
      <text className="ruler-label" x={mid.x} y={mid.y - font * 0.8} fontSize={font} strokeWidth={font * 0.35}>
        {len.toFixed(1)}"
      </text>
      {selected && id && (
        <g className="ruler-del" data-line-del={id}>
          <circle cx={del.x} cy={del.y} r={11 / px} strokeWidth={1.5 / px} />
          <path
            d={`M${del.x - 4 / px} ${del.y - 4 / px}L${del.x + 4 / px} ${del.y + 4 / px}M${del.x + 4 / px} ${del.y - 4 / px}L${del.x - 4 / px} ${del.y + 4 / px}`}
            strokeWidth={2 / px}
          />
        </g>
      )}
    </g>
  );
}

/** Silhouette d'un socle agrandie de `by` pouces dans toutes les directions. */
function Expanded({ base, pos, by }: { base?: Base; pos: ModelPos; by: number }) {
  if (!base) return null;
  const t = `rotate(${pos.rot} ${pos.x} ${pos.y})`;
  if (base.shape === 'circle') return <circle cx={pos.x} cy={pos.y} r={base.d / MM_PER_INCH / 2 + by} />;
  const w = base.w / MM_PER_INCH, h = base.h / MM_PER_INCH;
  if (base.shape === 'oval') return <ellipse cx={pos.x} cy={pos.y} rx={w / 2 + by} ry={h / 2 + by} transform={t} />;
  return <rect x={pos.x - w / 2 - by} y={pos.y - h / 2 - by} width={w + 2 * by} height={h + 2 * by} rx={by + h * 0.12} transform={t} />;
}

/** Plus grande dimension d'un socle en pouces (pour placer l'étiquette au-dessus de l'unité). */
function extent(b?: Base): number {
  if (!b) return 1;
  return (b.shape === 'circle' ? b.d : Math.max(b.w, b.h)) / MM_PER_INCH;
}

function Token({ base, pos, label, stroke, idx, pxPerIn }: { base?: Base; pos: ModelPos; label: string; stroke: number; idx: number; pxPerIn: number }) {
  if (!base) return null;
  const t = `rotate(${pos.rot} ${pos.x} ${pos.y})`;
  let shape: React.ReactNode;
  let small: number;
  if (base.shape === 'circle') {
    const r = base.d / MM_PER_INCH / 2;
    small = r * 2;
    shape = <circle data-idx={idx} cx={pos.x} cy={pos.y} r={r} strokeWidth={stroke} />;
  } else if (base.shape === 'oval') {
    const rx = base.w / MM_PER_INCH / 2, ry = base.h / MM_PER_INCH / 2;
    small = ry * 2;
    shape = <ellipse data-idx={idx} cx={pos.x} cy={pos.y} rx={rx} ry={ry} transform={t} strokeWidth={stroke} />;
  } else {
    const w = base.w / MM_PER_INCH, h = base.h / MM_PER_INCH;
    small = h;
    shape = <rect data-idx={idx} x={pos.x - w / 2} y={pos.y - h / 2} width={w} height={h} rx={h * 0.12} transform={t} strokeWidth={stroke} />;
  }
  const fontSize = small * 0.42;
  return (
    <>
      {shape}
      {fontSize * pxPerIn >= 7 && (
        <text className="token-text" x={pos.x} y={pos.y} fontSize={fontSize}>
          {label}
        </text>
      )}
    </>
  );
}
