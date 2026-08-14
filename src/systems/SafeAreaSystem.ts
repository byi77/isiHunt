/**
 * Kleine Anzeige in der oberen Safe Area.
 *
 * In installierten iOS-Apps liegt der Bereich direkt unter der undurchsichtigen
 * Systemstatusleiste. Dadurch bleiben Uhr und Dynamic Island unangetastet und
 * der Lauftext wird nicht vom Systemblur weichgezeichnet.
 */

import { eventBus, GameEvent } from '@/core/EventBus';
import { isIos, isStandalone } from '@/core/display';

let area: HTMLElement | null = null;
let tickerTimer: number | undefined;
let tickerItems: readonly string[] = [];
let tickerIndex = 0;

/**
 * Mit der undurchsichtigen iOS-Statusleiste beginnt der Web-Viewport bereits
 * unter Uhr und Dynamic Island. Ein zusaetzliches Safe-Area-Padding wuerde den
 * freigewordenen Platz doppelt reservieren und als Leerstreifen erscheinen.
 */
function configureIosStatusArea(): void {
  if (!isIos() || !isStandalone()) return;
  document.documentElement.style.setProperty('--app-safe-top', '0px');
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
