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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><g fill="white" stroke="white" stroke-width="0.2">${polygons}</g></svg>\n`;
  const destination = new URL(`ship${index}-preview.svg`, folder);
  await writeFile(destination, svg);
  console.log(fileURLToPath(destination));
}
