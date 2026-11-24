// Capture PNG de la table : copie du SVG affiché, cadrée sur toute la table (sans le zoom en cours),
// avec les styles CSS recopiés en ligne et l'image de la carte intégrée, puis rendue dans un canvas.
// Les noms de toutes les unités sont placés sans se chevaucher, et les réserves s'affichent sous la carte.
import { layoutLabels } from './labelLayout';

const PX_PER_INCH = 25; // 44" x 60" → 1100 x 1500 px
const MARGIN = 0.5;
const HEADER = 64;
const BOARD_W = 44, BOARD_H = 60;
const LABEL_FONT = 0.56; // taille des noms, en pouces (14 px)

// Propriétés de rendu à figer sur chaque élément (le SVG isolé ne voit plus la feuille de style de l'app)
const STYLE_PROPS = [
  'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linejoin', 'opacity',
  'font-family', 'font-size', 'font-weight', 'letter-spacing', 'text-anchor', 'dominant-baseline', 'paint-order',
  'mix-blend-mode', 'stroke-linecap',
];

export type CaptureUnit = { name: string; color: string; models: { x: number; y: number; r: number }[] };
export type ReserveBlock = { color: string; units: { name: string; count: number }[] };

async function toDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Couleur d'armée éclaircie (35 % couleur, 65 % blanc), comme les noms sur la table. */
function tint(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c * 0.35 + 255 * 0.65);
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

const uiFont = () => getComputedStyle(document.documentElement).getPropertyValue('--ui').trim() || '"Barlow Condensed", Arial, sans-serif';

/** Noms des unités dans le SVG copié : placés sans chevauchement, dans la table, avec un trait fin si éloignés. */
function addLabels(clone: SVGSVGElement, units: CaptureUnit[], ctx: CanvasRenderingContext2D) {
  clone.querySelectorAll('.unit-label').forEach((el) => el.remove());
  const font = uiFont();
  ctx.font = `700 ${LABEL_FONT * PX_PER_INCH}px ${font}`;
  const measure = (s: string) => (ctx.measureText(s).width / PX_PER_INCH) + s.length * LABEL_FONT * 0.04;
  const labels = layoutLabels(units, LABEL_FONT, measure, BOARD_W, BOARD_H);
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');
  for (const l of labels) {
    const color = tint(units[l.unit].color);
    if (l.leader) {
      const line = document.createElementNS(ns, 'line');
      Object.entries({ x1: l.leader.x1, y1: l.leader.y1, x2: l.leader.x2, y2: l.leader.y2 }).forEach(([k, v]) => line.setAttribute(k, String(v)));
      line.setAttribute('style', `stroke:${color};stroke-width:0.06;stroke-linecap:round`);
      g.appendChild(line);
    }
  }
  for (const l of labels) {
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('style', [
      `fill:${tint(units[l.unit].color)}`, 'stroke:#0b0a08', `stroke-width:${LABEL_FONT * 0.28}`, 'stroke-linejoin:round',
      'paint-order:stroke', `font-family:${font}`, 'font-weight:700', `font-size:${LABEL_FONT}px`,
      `letter-spacing:${LABEL_FONT * 0.04}px`, 'text-anchor:middle',
    ].join(';'));
    l.lines.forEach((s, i) => {
      const t = document.createElementNS(ns, 'tspan');
      t.setAttribute('x', String(l.x));
      t.setAttribute('y', String(l.top + LABEL_FONT * 0.82 + i * l.lineH));
      t.textContent = s;
      text.appendChild(t);
    });
    g.appendChild(text);
  }
  clone.appendChild(g);
}

const RES = { pad: 24, title: 36, row: 24, colW: 250 };

/** Hauteur de la section « Reserves » sous la carte. */
function reservesHeight(blocks: ReserveBlock[], width: number): number {
  const shown = blocks.filter((b) => b.units.length);
  if (!shown.length) return RES.pad * 2 + RES.title + RES.row;
  const w = width / shown.length;
  const cols = Math.max(1, Math.floor((w - 2 * RES.pad) / RES.colW));
  const rows = Math.max(...shown.map((b) => Math.ceil(b.units.length / cols)));
  return RES.pad * 2 + RES.title + rows * RES.row;
}

/** Réserves de chaque camp, côte à côte ; un seul camp prend toute la largeur ; aucune : « No reserves. » */
function drawReserves(ctx: CanvasRenderingContext2D, blocks: ReserveBlock[], top: number, width: number) {
  const shown = blocks.filter((b) => b.units.length);
  const parts: (ReserveBlock | null)[] = shown.length ? shown : [null];
  const w = width / parts.length;
  const font = uiFont();
  ctx.strokeStyle = '#3a3428';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(RES.pad, top + 0.5);
  ctx.lineTo(width - RES.pad, top + 0.5);
  ctx.stroke();
  parts.forEach((b, k) => {
    const x0 = k * w + RES.pad, y0 = top + RES.pad;
    if (k > 0) {
      ctx.beginPath();
      ctx.moveTo(k * w + 0.5, top + RES.pad);
      ctx.lineTo(k * w + 0.5, top + reservesHeight(blocks, width) - RES.pad);
      ctx.stroke();
    }
    // Titre, précédé de la pastille de couleur du joueur
    let tx = x0;
    if (b) {
      ctx.beginPath();
      ctx.arc(x0 + 7, y0 + 11, 7, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.strokeStyle = '#0b0a08';
      ctx.stroke();
      tx = x0 + 22;
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e8cf8a';
    ctx.font = '600 20px Cinzel, Georgia, serif';
    ctx.fillText('Reserves', tx, y0 + 12);
    ctx.font = `600 17px ${font}`;
    if (!b) {
      ctx.fillStyle = '#9b917b';
      ctx.fillText('No reserves.', x0, y0 + RES.title + RES.row / 2);
      return;
    }
    const cols = Math.max(1, Math.floor((w - 2 * RES.pad) / RES.colW));
    const colW = (w - 2 * RES.pad) / cols;
    const rows = Math.ceil(b.units.length / cols);
    b.units.forEach((u, i) => {
      const col = Math.floor(i / rows), row = i % rows;
      const x = x0 + col * colW, y = y0 + RES.title + row * RES.row + RES.row / 2;
      const count = u.count > 1 ? ` ×${u.count}` : '';
      const countW = ctx.measureText(count).width;
      let name = u.name;
      const max = colW - 14 - countW;
      if (ctx.measureText(name).width > max) {
        while (name.length > 1 && ctx.measureText(`${name}...`).width > max) name = name.slice(0, -1);
        name = `${name.trimEnd()}...`;
      }
      ctx.fillStyle = '#e9e1cc';
      ctx.fillText(name, x, y);
      ctx.fillStyle = '#9b917b';
      ctx.fillText(count, x + ctx.measureText(name).width, y);
    });
  });
}

export type CaptureContent = { units: CaptureUnit[]; reserves: ReserveBlock[] };

/** Image de la table (PNG par défaut ; WebP pour l'envoi à Mago-stat, plus léger). */
export async function boardCaptureBlob(
  svg: SVGSVGElement, title: string, subtitle: string, { units, reserves }: CaptureContent, type = 'image/png',
): Promise<Blob> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const src = [svg, ...svg.querySelectorAll('*')];
  const dst = [clone, ...clone.querySelectorAll('*')];
  src.forEach((el, i) => {
    const cs = getComputedStyle(el);
    (dst[i] as SVGElement).setAttribute('style', STYLE_PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';'));
  });
  // Ni sélection, ni trace de déplacement sur la capture
  clone.querySelectorAll('.move-start, .move-distance, .ruler-del, .ruler.drafting, .ruler-hit').forEach((el) => el.remove());
  clone.querySelectorAll('.unit.selected *').forEach((el) => (el as SVGElement).style.setProperty('stroke', '#0b0a08'));

  const w = BOARD_W + 2 * MARGIN, h = BOARD_H + 2 * MARGIN;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  addLabels(clone, units, ctx);

  clone.setAttribute('viewBox', `${-MARGIN} ${-MARGIN} ${w} ${h}`);
  clone.setAttribute('width', String(w * PX_PER_INCH));
  clone.setAttribute('height', String(h * PX_PER_INCH));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const board = clone.querySelector('image');
  if (board) board.setAttribute('href', await toDataUrl(board.getAttribute('href')!));

  const svgUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
  try {
    const img = await loadImage(svgUrl);
    // La carte garde sa taille : l'image s'allonge vers le bas pour les réserves
    const boardPx = h * PX_PER_INCH;
    canvas.width = w * PX_PER_INCH;
    canvas.height = HEADER + boardPx + reservesHeight(reserves, canvas.width);
    ctx.fillStyle = '#0c0b09';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#e8cf8a';
    ctx.font = '600 28px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, canvas.width / 2, 34);
    ctx.fillStyle = '#9b917b';
    ctx.font = '600 16px "Barlow Condensed", Arial, sans-serif';
    ctx.fillText(subtitle.toUpperCase(), canvas.width / 2, 56);
    ctx.drawImage(img, 0, HEADER);
    drawReserves(ctx, reserves, HEADER + boardPx, canvas.width);
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), type, 0.9));
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export async function downloadBoardCapture(svg: SVGSVGElement, title: string, subtitle: string, fileName: string, content: CaptureContent) {
  const png = await boardCaptureBlob(svg, title, subtitle, content);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(png);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
