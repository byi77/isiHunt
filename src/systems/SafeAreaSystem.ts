/**
 * Kleine Anzeige in der oberen Safe Area.
 *
 * In installierten iOS-Apps liegt der Text unterhalb des Systemblurs. Der
 * dazwischenliegende Bereich bleibt transparent und zeigt den Welt-Hintergrund.
 */

import { eventBus, GameEvent } from '@/core/EventBus';
import { isIos, isStandalone } from '@/core/display';

let area: HTMLElement | null = null;
let tickerTimer: number | undefined;
let tickerItems: readonly string[] = [];
let tickerIndex = 0;

/** WebKit meldet die obere Safe Area in installierten Apps gelegentlich als 0. */
function configureIosStatusArea(): void {
  if (!isIos() || !isStandalone()) return;

  const isIphone = /iPhone|iPod/.test(navigator.userAgent);
  const longScreenEdge = Math.max(window.screen.width, window.screen.height);

  let fallback = 24;
  if (isIphone && longScreenEdge >= 870) fallback = 62;
  else if (isIphone && longScreenEdge >= 850) fallback = 59;
  else if (isIphone && longScreenEdge >= 812) fallback = 47;
  else if (isIphone) fallback = 20;

  document.documentElement.style.setProperty(
    '--app-safe-top',
    `max(env(safe-area-inset-top, 0px), ${fallback}px)`,
  );
  document.documentElement.style.setProperty('--ticker-offset', isIphone ? '32px' : '8px');
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

  configureIosStatusArea();
  registerGameEvents();
}
