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

function updateAvailability(): void {
  const probe = document.getElementById('safe-top');
  const hasSafeTop = (probe?.getBoundingClientRect().top ?? 0) > 0;
  document.documentElement.classList.toggle('has-safe-top', hasSafeTop);
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
    'NEÜ WELTEN WARTEN AUF DICH',
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
}
