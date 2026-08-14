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
  // Der System-Blur des iPhone reicht optisch etwas unter die gemeldete Safe
  // Area. Die fruehere untere Home-Indicator-Reserve wird deshalb oben als
  // Freiraum vor dem Laufband genutzt; die Gesamthoehe bleibt praktisch gleich.
  document.documentElement.style.setProperty('--ticker-clearance', isIphone ? '32px' : '8px');
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
}
