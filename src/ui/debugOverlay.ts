/**
 * Schwebender Debug-Knopf ausserhalb des Phaser-Canvas.
 *
 * Muss in JEDER Scene sichtbar bleiben - Bugs treten oft mitten im Run auf,
 * nicht nur im Menue. Eine Phaser-Parallel-Scene muesste dafuer in allen 17
 * Scenes einzeln gestartet werden (Fehlerquelle: neue Scene vergisst den
 * Start) und laege im gemeinsamen Canvas, muesste also vor jedem Screenshot
 * extra versteckt werden. Ein DOM-Element hat keine Scene-Grenze und landet
 * automatisch NICHT im Canvas-Screenshot - beides ist hier erwuenscht.
 *
 * Vorbild: RulerScene.installViewportRuler() und ui/hitDebug.ts::ensurePanel(),
 * beide haengen ihr Overlay direkt an document.documentElement statt an eine
 * Scene.
 */

import type Phaser from 'phaser';

import * as DebugSystem from '@/systems/DebugSystem';

const OVERLAY_ID = 'isihunt-debug-overlay';

let statusResetTimer: number | undefined;

function activeSceneKeys(game: Phaser.Game): string[] {
  return game.scene.getScenes(true).map((scene) => scene.scene.key);
}

async function handleTap(game: Phaser.Game, button: HTMLButtonElement): Promise<void> {
  if (button.disabled) return;

  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = '…';

  try {
    const result = await DebugSystem.shareReport(game.canvas, activeSceneKeys(game));
    button.textContent = result.ok ? '✓' : '⬇';
  } catch (error) {
    console.warn('[debugOverlay] Report fehlgeschlagen.', error);
    button.textContent = '✗';
  } finally {
    if (statusResetTimer !== undefined) window.clearTimeout(statusResetTimer);
    statusResetTimer = window.setTimeout(() => {
      button.textContent = originalLabel;
      button.disabled = false;
    }, 1500);
  }
}

/** Installiert den schwebenden Knopf. Ruft man ihn zweimal auf, bleibt nur einer uebrig. */
export function installDebugOverlay(game: Phaser.Game): void {
  document.getElementById(OVERLAY_ID)?.remove();

  const button = document.createElement('button');
  button.id = OVERLAY_ID;
  button.type = 'button';
  button.textContent = '🐞';
  button.setAttribute('aria-label', 'Debug-Report senden');
  Object.assign(button.style, {
    position: 'fixed',
    left: '10px',
    bottom: '10px',
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.35)',
    background: 'rgba(0,0,0,0.55)',
    color: '#fff',
    fontSize: '20px',
    lineHeight: '1',
    zIndex: '2147483000',
    pointerEvents: 'auto',
    touchAction: 'manipulation',
  } satisfies Partial<CSSStyleDeclaration>);

  button.addEventListener('click', () => void handleTap(game, button));

  document.body.appendChild(button);
}

/** Entfernt den schwebenden Knopf wieder - beim Ausschalten des Debug-Modus. */
export function removeDebugOverlay(): void {
  document.getElementById(OVERLAY_ID)?.remove();
  if (statusResetTimer !== undefined) {
    window.clearTimeout(statusResetTimer);
    statusResetTimer = undefined;
  }
}
