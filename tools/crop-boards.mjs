// Exporte uniquement la table (44"x60", intérieur du cadre noir) de chaque carte de layout
// dans public/assets/boards/*.webp. Usage : node crop-boards.mjs
//
// Les cartes gdmissions (1653x2833) existent en deux gabarits. Les rectangles ci-dessous ont été
// mesurés sur les pixels (bord extérieur du cadre + 7px d'épaisseur) ; ratio ≈ 44/60 = 0.733.
import sharp from 'sharp';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SRC = path.resolve(import.meta.dirname, 'raw/layouts');
const DST = path.resolve(import.meta.dirname, '../public/assets/boards');

const TEMPLATES = {
  standard: { left: 270, top: 760, width: 1113, height: 1518 },
  portrait: { left: 268, top: 764, width: 1118, height: 1525 },
};

await mkdir(DST, { recursive: true });
for (const f of (await readdir(SRC)).filter((f) => f.endsWith('.png'))) {
  const box = f.endsWith('-portrait.png') ? TEMPLATES.portrait : TEMPLATES.standard;
  const out = await sharp(await readFile(path.join(SRC, f)))
    .extract(box)
    .resize(1100, 1500, { fit: 'fill' })
    .webp({ quality: 85 })
    .toBuffer();
  await writeFile(path.join(DST, f.replace(/\.png$/, '.webp')), out);
}
console.log('Tables exportées dans', DST);
