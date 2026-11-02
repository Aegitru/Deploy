// Capture PNG de la table : copie du SVG affiché, cadrée sur toute la table (sans le zoom en cours),
// avec les styles CSS recopiés en ligne et l'image de la carte intégrée, puis rendue dans un canvas.

const PX_PER_INCH = 25; // 44" x 60" → 1100 x 1500 px
const MARGIN = 0.5;
const HEADER = 64;

// Propriétés de rendu à figer sur chaque élément (le SVG isolé ne voit plus la feuille de style de l'app)
const STYLE_PROPS = [
  'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linejoin', 'opacity',
  'font-family', 'font-size', 'font-weight', 'letter-spacing', 'text-anchor', 'dominant-baseline', 'paint-order',
  'mix-blend-mode', 'stroke-linecap',
];

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

export async function downloadBoardCapture(svg: SVGSVGElement, title: string, subtitle: string, fileName: string) {
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

  const w = 44 + 2 * MARGIN, h = 60 + 2 * MARGIN;
  clone.setAttribute('viewBox', `${-MARGIN} ${-MARGIN} ${w} ${h}`);
  clone.setAttribute('width', String(w * PX_PER_INCH));
  clone.setAttribute('height', String(h * PX_PER_INCH));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const board = clone.querySelector('image');
  if (board) board.setAttribute('href', await toDataUrl(board.getAttribute('href')!));

  const svgUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
  try {
    const img = await loadImage(svgUrl);
    const canvas = document.createElement('canvas');
    canvas.width = w * PX_PER_INCH;
    canvas.height = h * PX_PER_INCH + HEADER;
    const ctx = canvas.getContext('2d')!;
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
    const png = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(png);
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
