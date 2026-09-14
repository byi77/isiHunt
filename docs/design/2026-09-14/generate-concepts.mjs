// Statische, reproduzierbare Entwürfe für die gemeinsame Designabstimmung.
// Keine Spielansicht und keine Änderung an produktiven Assets.
import { writeFileSync } from 'node:fs';
import { URL } from 'node:url';

const folder = new URL('./', import.meta.url);
const ink = '#f4f1e8';
const muted = '#b8c0d9';
const gold = '#ffd479';

const text = (x, y, value, size = 14, color = ink, extra = '') =>
  `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" ${extra}>${value}</text>`;

function defs() {
  return `<defs>
    <linearGradient id="space" x2="0" y2="1"><stop stop-color="#0b1721"/><stop offset="1" stop-color="#060b14"/></linearGradient>
    <radialGradient id="nebula"><stop stop-color="#2a7b70" stop-opacity=".28"/><stop offset="1" stop-color="#102025" stop-opacity="0"/></radialGradient>
    <radialGradient id="planet" cx=".27" cy=".2" r=".8"><stop stop-color="#b7e6c3"/><stop offset=".24" stop-color="#5a9f8b"/><stop offset=".55" stop-color="#275958"/><stop offset=".85" stop-color="#10282f"/><stop offset="1" stop-color="#071219"/></radialGradient>
    <radialGradient id="atmosphere"><stop offset=".72" stop-color="#94f5dc" stop-opacity="0"/><stop offset=".83" stop-color="#94f5dc" stop-opacity=".06"/><stop offset=".87" stop-color="#94f5dc" stop-opacity=".38"/><stop offset=".89" stop-color="#94f5dc" stop-opacity=".08"/><stop offset="1" stop-color="#94f5dc" stop-opacity="0"/></radialGradient>
    <linearGradient id="hull" x2="1" y2="1"><stop stop-color="#f0f7f7"/><stop offset=".48" stop-color="#98aeb9"/><stop offset="1" stop-color="#314858"/></linearGradient>
    <linearGradient id="button" x2="1" y2="1"><stop stop-color="#ffe3a4"/><stop offset="1" stop-color="#dfb564"/></linearGradient>
    <linearGradient id="trail" x2="0" y2="1"><stop stop-color="#b3f9f2" stop-opacity=".85"/><stop offset="1" stop-color="#7dd3fc" stop-opacity="0"/></linearGradient>
    <clipPath id="sphere"><circle r="100"/></clipPath>
    <g id="planet-art"><circle r="115" fill="url(#atmosphere)"/><circle r="100" fill="url(#planet)"/>
      <g clip-path="url(#sphere)" fill="none" stroke="#b8dfc4" opacity=".2">
        <path d="M-97-28 Q-50-85-8-60 T84-34 M-104-9 Q-45-56 0-28 T106-12 M-102 20 Q-52-12-12 5 T105 33" stroke-width="7"/>
        <path d="M-90 60 Q-35 25 13 48 T98 67" stroke-width="12"/>
      </g><path d="M-94 32 A100 100 0 0 1 30-95" fill="none" stroke="#d3f9de" stroke-width="1.4" opacity=".72"/>
    </g>
    <g id="ship-art">
      <path d="M-13 21 Q-7 45 0 58 Q7 44 13 21Z" fill="url(#trail)"/>
      <path d="M0-45 13-8 43 23 17 16 11 29-11 29-17 16-43 23-13-8Z" fill="url(#hull)" stroke="#bcced5" stroke-width="1"/>
      <path d="M0-45 0 24-11 29-13-8Z" fill="#d6e2e6"/>
      <path d="M0-25 6-5 0 7-6-5Z" fill="#62c6dd" stroke="#193746"/>
      <path d="M-34 18-14 6 M34 18 14 6" stroke="#ffd479" stroke-width="2"/>
      <path d="M-10 25H-3 M3 25H10" stroke="#c6fffa" stroke-width="4"/>
    </g>
  </defs>`;
}

function background(w, h, ticker) {
  const stars = Array.from({ length: 75 }, (_, i) => {
    const x = (i * 137 + 23) % w;
    const y = 36 + ((i * 211 + 41) % (h - 45));
    return `<circle cx="${x}" cy="${y}" r="${i % 7 === 0 ? 1.1 : 0.6}" fill="#dae8ed" opacity="${i % 3 === 0 ? 0.45 : 0.18}"/>`;
  }).join('');
  return `<rect width="${w}" height="${h}" fill="url(#space)"/>
    <ellipse cx="${w * 0.76}" cy="${h * 0.31}" rx="${w * 0.9}" ry="${h * 0.4}" fill="url(#nebula)"/>
    ${stars}<rect width="${w}" height="${ticker}" fill="#090e1a"/>
    ${text(w / 2, ticker / 2 + 4, 'J A G E   D A S   L I C H T', 10, muted, 'text-anchor="middle"')}`;
}

function button(id, x, y, w, h, label, primary = false, size = 14) {
  return `<g id="${id}" data-layout="button">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${primary ? 'url(#button)' : '#131f2b'}" stroke="${primary ? '#ffe2a3' : '#344753'}"/>
    ${text(x + w / 2, y + h / 2 + size * 0.35, label, size, primary ? '#15202a' : ink, 'text-anchor="middle" font-weight="700"')}
  </g>`;
}

function menu(w, h) {
  const compact = h < 700;
  const margin = compact ? 14 : 22;
  const center = w / 2;
  const ticker = compact ? 24 : 32;
  const profileY = compact ? 80 : 105;
  const profileH = compact ? 48 : 58;
  const planetY = compact ? 209 : 286;
  const planetScale = compact ? 0.66 : 1.06;
  const shipY = compact ? 247 : 371;
  const shipScale = compact ? 0.48 : 0.8;
  const titleY = compact ? 305 : 457;
  const primaryY = compact ? 350 : 515;
  const primaryH = compact ? 48 : 56;
  const secondaryY = primaryY + primaryH + 10;
  const rowH = compact ? 44 : 48;
  const thirdY = secondaryY + rowH + 10;
  const lastY = thirdY + rowH + 10;
  const gap = compact ? 8 : 10;
  const innerW = w - margin * 2;
  const halfW = (innerW - gap) / 2;
  const thirdW = (innerW - gap * 2) / 3;
  return `${background(w, h, ticker)}
    ${text(margin, compact ? 61 : 77, 'isiHunt', compact ? 28 : 34, ink, 'font-weight="700" font-style="italic"')}
    ${button('fullscreen', w - margin - 48, compact ? 30 : 42, 48, 44, '⛶', false, 23)}
    <g id="profile" data-layout="panel"><rect x="${margin}" y="${profileY}" width="${innerW}" height="${profileH}" rx="12" fill="#13212c" stroke="#2b424b"/>
      ${text(margin + 14, profileY + 21, 'GAST', 14, ink, 'font-weight="700"')}
      ${text(margin + 14, profileY + 39, 'Level 1 · Lokal gespeichert', 12, muted)}
      ${text(w - margin - 15, profileY + 22, 'Profil ›', 14, gold, 'text-anchor="end"')}
      ${text(w - margin - 15, profileY + 40, '0 Coins', 12, muted, 'text-anchor="end"')}
    </g>
    <use href="#planet-art" transform="translate(${center},${planetY}) scale(${planetScale})"/>
    <ellipse cx="${center}" cy="${shipY + 10}" rx="${compact ? 65 : 102}" ry="${compact ? 12 : 20}" fill="none" stroke="#8eb9b4" stroke-opacity=".24"/>
    <use href="#ship-art" transform="translate(${center},${shipY}) scale(${shipScale})"/>
    ${text(center, titleY, 'Sternenweide', compact ? 23 : 29, ink, 'text-anchor="middle" font-weight="700"')}
    ${text(center, titleY + (compact ? 20 : 25), 'Ruhige Nebel. Deine erste Lichtjagd.', 12, muted, 'text-anchor="middle"')}
    ${text(center, titleY + (compact ? 35 : 43), '●  ○  ○  ···', 11, gold, 'text-anchor="middle"')}
    ${button('jagd', margin, primaryY, innerW, primaryH, 'JAGD STARTEN  ›', true, compact ? 17 : 19)}
    ${button('tageslauf', margin, secondaryY, halfW, rowH, 'Tageslauf')}
    ${button('duell', margin + halfW + gap, secondaryY, halfW, rowH, 'Duell')}
    ${button('erfolge', margin, thirdY, thirdW, rowH, 'Erfolge', false, 13)}
    ${button('talente', margin + thirdW + gap, thirdY, thirdW, rowH, 'Talente', false, 13)}
    ${button('rangliste', margin + (thirdW + gap) * 2, thirdY, thirdW, rowH, 'Rangliste', false, 13)}
    ${button('settings', margin, lastY, halfW, rowH, 'Einstellungen', false, 13)}
    ${button('shop', margin + halfW + gap, lastY, halfW, rowH, 'Shop', false, 14)}
    ${compact ? '' : text(center, h - 35, 'STERNENWEIDE  /  LEVEL 1', 11, muted, 'text-anchor="middle" letter-spacing="1.3"')}`;
}

function game(w, h) {
  const compact = h < 700;
  const ticker = compact ? 24 : 32;
  const top = ticker + 12;
  const center = w / 2;
  const fieldStart = top + 113;
  const fieldH = h - fieldStart - 80;
  return `${background(w, h, ticker)}
    <g id="hud" data-layout="panel"><rect x="14" y="${top}" width="${w - 28}" height="98" rx="14" fill="#101c29" stroke="#2b3d4b"/>
      ${text(28, top + 21, 'PUNKTE', 11, muted, 'letter-spacing="1"')}
      ${text(28, top + 52, '2.450', 28, ink, 'font-weight="700"')}
      ${text(center + 10, top + 21, 'ZEIT', 11, muted, 'text-anchor="middle" letter-spacing="1"')}
      ${text(center + 10, top + 52, '0:58', 23, ink, 'text-anchor="middle" font-weight="700"')}
      ${text(w - 28, top + 21, 'COMBO', 11, muted, 'text-anchor="end" letter-spacing="1"')}
      ${text(w - 28, top + 52, '×3', 23, gold, 'text-anchor="end" font-weight="700"')}
      <rect x="28" y="${top + 68}" width="${w - 56}" height="4" rx="2" fill="#273740"/>
      <rect x="28" y="${top + 68}" width="${(w - 56) * 0.64}" height="4" rx="2" fill="#a6cac5"/>
      ${text(28, top + 89, 'Sternenweide', 12, muted)}
      ${text(w - 28, top + 89, 'Serie 12', 12, muted, 'text-anchor="end"')}
    </g>
    <use href="#planet-art" opacity=".12" transform="translate(${w * 0.87},${fieldStart + fieldH * 0.38}) scale(1.35)"/>
    <g transform="translate(${w * 0.24},${fieldStart + fieldH * 0.2})"><circle r="26" fill="none" stroke="#0070dd" stroke-width="2"/><use href="#planet-art" transform="scale(.22)"/>${text(0, 42, '◆', 13, '#66b3ff', 'text-anchor="middle"')}</g>
    <g transform="translate(${w * 0.7},${fieldStart + fieldH * 0.12})"><ellipse rx="35" ry="10" transform="rotate(-25)" fill="none" stroke="#ff8000" stroke-width="1.5"/><use href="#planet-art" transform="scale(.2)"/><path d="M-32 13 Q4 22 31-15" fill="none" stroke="#ff8000" stroke-width="2"/>${text(0, 40, '★', 14, '#ff8000', 'text-anchor="middle"')}</g>
    <g transform="translate(${w * 0.75},${fieldStart + fieldH * 0.7})"><circle r="21" fill="none" stroke="#ffffff" stroke-opacity=".6"/><use href="#planet-art" transform="scale(.18)"/></g>
    <path d="M${w * 0.3} ${fieldStart + fieldH * 0.53} Q${w * 0.36} ${fieldStart + fieldH * 0.68} ${center} ${fieldStart + fieldH * 0.6}" fill="none" stroke="#ffd479" stroke-opacity=".45" stroke-dasharray="2 9"/>
    <ellipse cx="${w * 0.3}" cy="${fieldStart + fieldH * 0.53}" rx="23" ry="10" fill="none" stroke="#ffd479" stroke-opacity=".45"/>
    <circle cx="${center}" cy="${fieldStart + fieldH * 0.6}" r="${compact ? 32 : 38}" fill="none" stroke="#a3d7ca" stroke-opacity=".55"/>
    <use href="#ship-art" transform="translate(${center},${fieldStart + fieldH * 0.6}) rotate(12) scale(${compact ? 0.46 : 0.6})"/>
    ${text(w * 0.31, fieldStart + fieldH * 0.46, '+45', 18, gold, 'text-anchor="middle" font-weight="700"')}
    ${button('pause', w - 64, h - 62, 48, 48, 'Ⅱ', false, 20)}`;
}

for (const [name, w, h, body] of [
  ['concept-menu-390x844', 390, 844, menu],
  ['concept-menu-320x568', 320, 568, menu],
  ['concept-game-390x844', 390, 844, game],
  ['concept-game-320x568', 320, 568, game],
]) {
  writeFileSync(
    new URL(`${name}.svg`, folder),
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title desc">
  <title id="title">isiHunt – ${name.includes('menu') ? 'Menü' : 'Spiel'} – Designentwurf</title>
  <desc id="desc">Statischer Entwurf zur Abstimmung, keine implementierte Spielansicht. Modell, Planeten, Zahlen und Zustände sind illustrative Platzhalter.</desc>
  ${defs()}<g font-family="'Trebuchet MS', 'Segoe UI', sans-serif">${body(w, h)}</g></svg>\n`,
    'utf8',
  );
}
