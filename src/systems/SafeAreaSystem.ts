/**
 * Kleine Anzeige in der oberen Safe Area.
 *
 * Der dunkle Bereich darf unter die iOS-Statusleiste reichen. Sein Text liegt
 * durch ein Safe-Area-Padding unterhalb von Systemuhr und Dynamic Island.
 */

import { eventBus, GameEvent } from '@/core/EventBus';
import { isIos, isStandalone } from '@/core/display';

let area: HTMLElement | null = null;
let tickerTimer: number | undefined;
let tickerItems: readonly string[] = [];
let tickerIndex = 0;
const TICKER_HEIGHT_PX = 32;

/**
 * WebKit meldet `safe-area-inset-top` in installierten Apps auf einzelnen
 * iOS-Staenden als 0. Fuer diese Kombination stellen wir einen geraeteweisen
 * Mindestwert bereit. `env(...)` gewinnt weiterhin, sobald iOS korrekt misst.
 */
function installIosSafeTopFallback(): void {
  if (!isIos() || !isStandalone()) return;

  const userAgent = navigator.userAgent;
  const isIphone = /iPhone|iPod/.test(userAgent);
  const longScreenEdge = Math.max(window.screen.width, window.screen.height);

  let fallback = 24; // iPad und aeltere iOS-Geraete
  if (isIphone && longScreenEdge >= 870)
    fallback = 62; // iPhone 16 Pro / Pro Max
  else if (isIphone && longScreenEdge >= 850)
    fallback = 59; // iPhone 14/15 Pro
  else if (isIphone && longScreenEdge >= 812)
    fallback = 47; // klassische Notch
  else if (isIphone) fallback = 20;

  document.documentElement.style.setProperty(
    '--app-safe-top',
    `max(env(safe-area-inset-top, 0px), ${fallback}px)`,
  );
}

/**
 * Der Canvas kann im hohen iPhone-Viewport zusaetzlich vertikal zentriert
 * werden. Das Laufband soll dann nicht am Displayrand kleben, sondern direkt
 * ueber dem sichtbaren Canvas beginnen. Das vermeidet gleichzeitig den
 * grossen Leerraum vor dem Logo und ein Ueberlappen der Canvas-Oberkante.
 */
function alignTickerToCanvas(): void {
  if (!area) return;

  const game = document.getElementById('game');
  const canvas = game?.querySelector<HTMLCanvasElement>('canvas');
  if (!game || !canvas) return;

  const gameTop = game.getBoundingClientRect().top;
  const canvasTop = canvas.getBoundingClientRect().top - gameTop;
  if (canvasTop <= TICKER_HEIGHT_PX) return;

  const safeTop = Number.parseFloat(
    window.getComputedStyle(document.documentElement).getPropertyValue('--app-safe-top'),
  );
  const desiredTop = Math.max(Number.isFinite(safeTop) ? safeTop : 0, canvasTop - TICKER_HEIGHT_PX);

  area.style.top = `${Math.round(desiredTop)}px`;
  area.style.height = `${TICKER_HEIGHT_PX}px`;
  area.style.minHeight = `${TICKER_HEIGHT_PX}px`;
  area.style.padding = '0 18px';
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

  installIosSafeTopFallback();
  registerGameEvents();

  window.addEventListener('resize', alignTickerToCanvas);
  window.addEventListener('orientationchange', alignTickerToCanvas);

  // Phaser erzeugt den Canvas erst nach dem Start. Mehrere Frames decken den
  // ersten Layoutsprung der installierten iOS-App ab.
  let attempts = 0;
  const measureAfterBoot = (): void => {
    alignTickerToCanvas();
    if (attempts++ < 12) window.requestAnimationFrame(measureAfterBoot);
  };
  window.requestAnimationFrame(measureAfterBoot);
}
