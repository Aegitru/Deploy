// Extrait le texte du PDF Event Companion, page par page, en conservant les lignes (via la position Y).
// Usage : node pdf-text.mjs raw/event-companion.pdf > raw/event-companion.txt
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFile } from 'node:fs/promises';

const doc = await getDocument({ data: new Uint8Array(await readFile(process.argv[2])) }).promise;
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const { items } = await page.getTextContent();
  const lines = new Map();
  for (const it of items) {
    if (!it.str.trim()) continue;
    const y = Math.round(it.transform[5]);
    const key = [...lines.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push({ x: it.transform[4], s: it.str });
  }
  console.log(`=== PAGE ${p}`);
  for (const y of [...lines.keys()].sort((a, b) => b - a)) {
    console.log(lines.get(y).sort((a, b) => a.x - b.x).map((i) => `${Math.round(i.x)}:${i.s}`).join(' | '));
  }
}
