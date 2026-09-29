/**
 * Spur des Jagdstarts - wird nur sichtbar, wenn der Start scheitert.
 *
 * Warum es das gibt: Am 2026-09-29 startete die Jagd auf einem iPhone 16 Pro
 * (v0.1.420) nicht mehr - "es passiert nichts". Am PC liess sich das weder in
 * Chromium noch in WebKit nachstellen, auch nicht mit demselben Spielstand,
 * und der Fehlerbericht braucht mehrere Schritte am Geraet. Diese Spur haelt
 * jeden Schritt des Starts fest und zeigt ihn als Text, sobald ein Fehler
 * fliegt oder die Spielszene nach `START_TRACE_TIMEOUT_MS` nicht laeuft. Ein
 * Screenshot genuegt dann.
 *
 * Reines DOM, kein Phaser: Die Spur muss auch erscheinen, wenn Phasers
 * Schleife abgestuerzt ist.
 */

import { APP_VERSION } from '@/config/GameConfig';
import { START_TRACE_TIMEOUT_MS } from '@/config/DebugConfig';

const PANEL_ID = 'isihunt-start-trace';

let steps: { ms: number; step: string }[] = [];
let startedAt = 0;
let timer: number | undefined;

/** Beginnt eine neue Spur. Ein laufender Start wird dabei verworfen. */
export function beginStartTrace(step: string): void {
  steps = [];
  startedAt = performance.now();
  markStart(step);
  window.clearTimeout(timer);
  timer = window.setTimeout(
    () => showStartTrace('Die Jagd ist nicht gestartet.'),
    START_TRACE_TIMEOUT_MS,
  );
}

/** Haelt einen Schritt fest - ohne laufende Spur passiert nichts. */
export function markStart(step: string): void {
  if (startedAt === 0) return;
  steps.push({ ms: Math.round(performance.now() - startedAt), step });
}

/** Der Start ist gelungen: Spur schliessen, nichts anzeigen. */
export function finishStartTrace(): void {
  if (startedAt === 0) return;
  window.clearTimeout(timer);
  startedAt = 0;
}

/** Ein Fehler waehrend eines laufenden Starts zeigt die Spur sofort. */
export function noteStartError(message: string): void {
  if (startedAt === 0) return;
  markStart(`FEHLER: ${message}`);
  showStartTrace('Beim Start der Jagd ist ein Fehler aufgetreten.');
}

function showStartTrace(title: string): void {
  window.clearTimeout(timer);
  const lines = [
    title,
    `isiHunt v${APP_VERSION} · ${navigator.userAgent}`,
    '',
    ...steps.map(({ ms, step }) => `${String(ms).padStart(6)} ms  ${step}`),
    '',
    'Bitte einen Screenshot davon schicken.',
  ];
  document.getElementById(PANEL_ID)?.remove();
  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.setAttribute('role', 'alert');
  Object.assign(panel.style, {
    position: 'fixed',
    inset: '12px',
    zIndex: '10000',
    overflow: 'auto',
    padding: '12px',
    background: 'rgba(8, 12, 20, 0.94)',
    color: '#ffd479',
    font: '12px/1.4 monospace',
    whiteSpace: 'pre-wrap',
    borderRadius: '8px',
  } satisfies Partial<CSSStyleDeclaration>);
  panel.textContent = lines.join('\n');
  panel.addEventListener('click', () => panel.remove());
  document.body.appendChild(panel);
}
