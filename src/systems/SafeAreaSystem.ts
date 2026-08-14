/**
 * Kleine Anzeige in der oberen Safe Area.
 *
 * Der Bereich liegt oberhalb von Spielpixel 0 und damit unter Statusleiste /
 * Dynamic Island. Er ist nur sichtbar, wenn das Geraet dort tatsaechlich
 * sicheren Platz meldet. Die Systemuhr bleibt unangetastet.
 */

import { eventBus, GameEvent } from '@/core/EventBus';

let area: HTMLElement | null = null;
let tickerTimer: number | undefined;
let tickerItems: readonly string[] = [];
let tickerIndex = 0;

/**
 * Die Safe Area ist auf iOS nicht immer identisch mit `env(...)`: Besonders
 * installierte Web-Apps melden den Wert gelegentlich zu klein. Die Oberkante
 * des Canvas ist dagegen der echte Beginn von Spielpixel 0 und damit die
 * belastbare Unterkante fuer die Laufzeile.
 */
function updateTickerLayout(): void {
  if (!area) return;

  const canvas = document.querySelector<HTMLCanvasElement>('#game canvas');
  const canvasTop = canvas?.getBoundingClientRect().top ?? 0;
  if (canvasTop <= 0) return;

  const height = Math.round(canvasTop);
  area.style.height = `${height}px`;
  area.style.minHeight = `${height}px`;
}

function updateAvailability(): void {
  const probe = document.getElementById('safe-top');
  const hasSafeTop = (probe?.getBoundingClientRect().top ?? 0) > 0;
  document.documentElement.classList.toggle('has-safe-top', hasSafeTop);
  updateTickerLayout();
}

function write(message: string): void {
  if (!area) return;
  area.textContent = message;
}

function stopTicker(): void {
  if (tickerTimer !== undefined) {
    window.clearInterval(tickerTimer);
    tickerTimer = undefined;
  }
  tickerItems = [];
  tickerIndex = 0;
}

function showNextTickerItem(): void {
  if (tickerItems.length === 0) return;
  write(tickerItems[tickerIndex % tickerItems.length] ?? '');
  tickerIndex += 1;
}

export function showMenuTicker(): void {
  stopTicker();
  tickerItems = [
    'JAGE DAS LICHT  ·  SAMMLE PLANETEN',
    'KETTEN BRINGEN MEHR PUNKTE',
    'NEUE WELTEN WARTEN AUF DICH',
    'SCHAFFE DEINEN BESTWERT',
  ];
  showNextTickerItem();
  tickerTimer = window.setInterval(showNextTickerItem, 3800);
}

export function showRunTimer(remainingMs: number): void {
  stopTicker();
  write(`${Math.max(0, Math.ceil(remainingMs / 1000))} SEKUNDEN`);
}

export function showStatic(message: string): void {
  stopTicker();
  write(message);
}

export function hide(): void {
  stopTicker();
  write('');
}

function registerGameEvents(): void {
  eventBus.onEvent(GameEvent.RunStarted, ({ durationMs }) => showRunTimer(durationMs));
  eventBus.onEvent(GameEvent.TimerChanged, ({ remainingMs }) => showRunTimer(remainingMs));
  eventBus.onEvent(GameEvent.RunEnded, () => showStatic('RUN BEENDET'));
}

/** Einmalig beim App-Start aufrufen. */
export function initialize(): void {
  area = document.getElementById('safe-area-content');
  if (!area) return;

  updateAvailability();
  registerGameEvents();
  window.addEventListener('resize', updateAvailability);
  window.addEventListener('orientationchange', updateAvailability);

  // Phaser erzeugt den Canvas erst nach dem App-Start. Mehrere Frames decken
  // sowohl den normalen Browserstart als auch den verzögerten iOS-PWA-Layout-
  // Sprung ab.
  let attempts = 0;
  const measureAfterBoot = (): void => {
    updateTickerLayout();
    if (attempts++ < 10) window.requestAnimationFrame(measureAfterBoot);
  };
  window.requestAnimationFrame(measureAfterBoot);
}
