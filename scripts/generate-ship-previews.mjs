import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Orthografische Silhouetten aus denselben CC0-OBJ-Dateien; keine Ersatzmodelle.
const folder = new URL('../public/assets/ego3d/cc0-spaceships/', import.meta.url);
for (let index = 1; index <= 9; index += 1) {
  const source = await readFile(new URL(`ship${index}.obj`, folder), 'utf8');
  const vertices = [];
  const faces = [];
  for (const line of source.split(/\r?\n/)) {
    const [kind, ...values] = line.trim().split(/\s+/);
    if (kind === 'v') vertices.push(values.map(Number));
    if (kind === 'f') faces.push(values.map((value) => Number(value.split('/')[0]) - 1));
  }
  // Blender exportiert teils lose Punkte ausserhalb des sichtbaren Rumpfs.
  // Wie OBJLoader nur Flaechenvertices fuer die Groessenanpassung verwenden.
  const used = [...new Set(faces.flat())].map((index) => vertices[index]);
  const xs = used.map((v) => v[0]);
  const zs = used.map((v) => v[2]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minZ = Math.min(...zs),
    maxZ = Math.max(...zs);
  const scale = 112 / Math.max(maxX - minX, maxZ - minZ);
  const project = (vertex) =>
    `${(64 + (vertex[0] - (minX + maxX) / 2) * scale).toFixed(2)},${(64 + (vertex[2] - (minZ + maxZ) / 2) * scale).toFixed(2)}`;
  const polygons = faces
    .map((face) => `<polygon points="${face.map((id) => project(vertices[id])).join(' ')}"/>`)
    .join('');
  const centerX = 64;
  const top = 64 + (minZ - (minZ + maxZ) / 2) * scale;
  const bottom = 64 + (maxZ - (minZ + maxZ) / 2) * scale;
  const length = bottom - top;
  const width = (maxX - minX) * scale;
  const canopyY = top + length * 0.21;
  const panelY = top + length * 0.48;
  const engineY = bottom - length * 0.09;
  const halfCanopy = Math.max(3.2, width * 0.085);
  const engineOffset = Math.max(5, width * 0.19);
  const panelOffset = Math.max(8, width * 0.29);
  // The OBJ pack's preview polygons are technically accurate, but read as
  // blank paper darts at shop size. Clip a small shared spacecraft language
  // to each original hull: a glass canopy, paired aft drives and armored
  // wing panels. The underlying CC0 silhouette stays untouched.
  const detail = `<g clip-path="url(#hull)" stroke-linejoin="round">
    <path d="M ${centerX} ${top + length * 0.08} L ${centerX + width * 0.095} ${top + length * 0.24} L ${centerX + width * 0.075} ${bottom - length * 0.12} L ${centerX} ${bottom - length * 0.05} L ${centerX - width * 0.075} ${bottom - length * 0.12} L ${centerX - width * 0.095} ${top + length * 0.24} Z" fill="#d9e5f1" fill-opacity=".78" stroke="#26384b" stroke-width="1.2"/>
    <path d="M ${centerX} ${canopyY - length * 0.07} Q ${centerX + halfCanopy} ${canopyY - length * 0.01} ${centerX + halfCanopy * 0.72} ${canopyY + length * 0.11} L ${centerX} ${canopyY + length * 0.18} L ${centerX - halfCanopy * 0.72} ${canopyY + length * 0.11} Q ${centerX - halfCanopy} ${canopyY - length * 0.01} ${centerX} ${canopyY - length * 0.07} Z" fill="#142b40" stroke="#e7f4ff" stroke-width="1.6"/>
    <path d="M ${centerX - halfCanopy * 0.42} ${canopyY - length * 0.015} L ${centerX - halfCanopy * 0.1} ${canopyY - length * 0.035} L ${centerX - halfCanopy * 0.18} ${canopyY + length * 0.075}" fill="none" stroke="#a7e7ff" stroke-width="1.5"/>
    <path d="M ${centerX - width * 0.09} ${panelY} L ${centerX - panelOffset} ${panelY + length * 0.11} L ${centerX - panelOffset * 0.78} ${panelY + length * 0.2} L ${centerX - width * 0.07} ${panelY + length * 0.12} Z M ${centerX + width * 0.09} ${panelY} L ${centerX + panelOffset} ${panelY + length * 0.11} L ${centerX + panelOffset * 0.78} ${panelY + length * 0.2} L ${centerX + width * 0.07} ${panelY + length * 0.12} Z" fill="#a8bacb" fill-opacity=".76" stroke="#344a5e" stroke-width="1.2"/>
    <path d="M ${centerX - panelOffset * 0.92} ${panelY + length * 0.13} L ${centerX - width * 0.12} ${panelY + length * 0.1} M ${centerX + panelOffset * 0.92} ${panelY + length * 0.13} L ${centerX + width * 0.12} ${panelY + length * 0.1}" stroke="#edf6ff" stroke-width="1.2"/>
    <g fill="#101b29" stroke="#d9e9f6" stroke-width="1.6"><circle cx="${centerX - engineOffset}" cy="${engineY}" r="${Math.max(2.5, width * 0.045)}"/><circle cx="${centerX + engineOffset}" cy="${engineY}" r="${Math.max(2.5, width * 0.045)}"/></g>
    <g fill="#6bdcff"><circle cx="${centerX - engineOffset}" cy="${engineY}" r="${Math.max(1.1, width * 0.018)}"/><circle cx="${centerX + engineOffset}" cy="${engineY}" r="${Math.max(1.1, width * 0.018)}"/></g>
    <path d="M ${centerX - width * 0.035} ${top + length * 0.36} h ${width * 0.07} M ${centerX - width * 0.035} ${top + length * 0.4} h ${width * 0.07} M ${centerX - width * 0.035} ${top + length * 0.44} h ${width * 0.07}" stroke="#344a5e" stroke-width="1.35"/>
  </g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><clipPath id="hull">${polygons}</clipPath></defs><g fill="#dbe5ef" stroke="#172534" stroke-width="1.1" stroke-linejoin="round">${polygons}</g>${detail}</svg>\n`;
  const destination = new URL(`ship${index}-preview.svg`, folder);
  await writeFile(destination, svg);
  console.log(fileURLToPath(destination));
}
