/**
 * Debug-Modus fuer Tester ohne Admin-Zugang.
 *
 * ## Warum getrennt vom Wartungsbildschirm (AdminScene)
 *
 * Der Wartungsbereich ist bewusst hinter einer PIN versteckt - er kann den
 * Spielstand loeschen. Dieser Modus soll dagegen von jedem Tester (auch
 * einem Kind) ohne PIN einschaltbar sein: er liest nur, veraendert nichts.
 * Der Zugang ist deshalb eine reine Geste (zehnmal aufs Logo tippen), keine
 * Berechtigungspruefung.
 *
 * ## Warum ein Modul-Singleton ohne `offEvent`
 *
 * Der Ereignis-Ringpuffer lauscht fuer die gesamte Lebensdauer der Seite auf
 * den EventBus - anders als ein Scene-Listener (CODE_STYLE.md 1.4) gibt es
 * hier keinen Neustart, an den ein Abmelden andocken koennte. Die Regel "jeder
 * `onEvent` braucht ein `offEvent`" gilt fuer Scenes, die wiederholt erzeugt
 * werden; ein einmalig beim App-Start verdrahteter Singleton-Listener ist die
 * bewusste Ausnahme (ADR-0016).
 *
 * ## Warum kein Phaser-Import
 *
 * `systems/` kennt Phaser nicht (CODE_STYLE.md 1.6). Screenshot und aktive
 * Scenes kommen deshalb als Parameter von aussen herein, genau wie
 * `layoutReport.ts::measureLayout(canvas)` es bereits vormacht.
 */

import {
  DEBUG_LOG_BUFFER_SIZE,
  DEBUG_LOG_STORAGE_KEY,
  DEBUG_MODE_STORAGE_KEY,
  DEBUG_TOGGLE_TAP_COUNT,
  DEBUG_TOGGLE_TAP_WINDOW_MS,
} from '@/config/DebugConfig';
import { APP_VERSION } from '@/config/GameConfig';
import { measureDevice, readWebStorageLine } from '@/core/deviceReport';
import { formatLayout, measureLayout } from '@/core/layoutReport';
import * as SoundSystem from '@/systems/SoundSystem';

export type LogEntryKind = 'event' | 'error';

export interface LogEntry {
  readonly timestamp: number;
  readonly kind: LogEntryKind;
  readonly label: string;
  readonly detail: string;
}

const logBuffer: LogEntry[] = loadPersistedLogBuffer();
let tapTimestamps: number[] = [];
let debugModeCache: boolean | null = null;
let consoleCaptureInstalled = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Laedt den beim letzten Beenden gespeicherten Puffer, damit ein
 * Fehlerbericht einen App-Neustart ueberlebt - siehe `DEBUG_LOG_STORAGE_KEY`.
 * Ungueltige oder fehlende Daten ergeben einen leeren Start statt eines
 * Fehlers; ein kaputter Debug-Log darf das eigentliche Spiel nie stoeren.
 */
function loadPersistedLogBuffer(): LogEntry[] {
  try {
    const raw = window.localStorage.getItem(DEBUG_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LogEntry[]) : [];
  } catch {
    return [];
  }
}

/**
 * Schreibt den Puffer gedrosselt zurueck, statt bei jedem einzelnen Eintrag
 * synchron zu speichern. `TimerChanged` feuert waehrend eines Runs jeden
 * Frame (~60x/s) - ein synchrones `localStorage.setItem` bei jedem dieser
 * Aufrufe wuerde den Main-Thread spuerbar belasten. Ein Timeout von wenigen
 * hundert Millisekunden reicht, damit beim Wegwechseln der App (siehe
 * `flushPersistedLogBuffer`) hoechstens der letzte kurze Moment fehlt.
 */
function schedulePersist(): void {
  if (persistTimer !== null) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    flushPersistedLogBuffer();
  }, 500);
}

/** Schreibt den Puffer sofort - fuer den Drossel-Timer und beim Seitenverlassen. */
function flushPersistedLogBuffer(): void {
  try {
    window.localStorage.setItem(DEBUG_LOG_STORAGE_KEY, JSON.stringify(logBuffer));
  } catch {
    // Privater Browsermodus oder voller Speicher duerfen das Spiel nicht
    // stoeren - der Puffer bleibt dann nur In-Memory gueltig.
  }
}

if (typeof document !== 'undefined') {
  // 'visibilitychange' statt nur 'pagehide': auf iOS ist das der
  // zuverlaessige Zeitpunkt fuer "App verlassen" - pagehide feuert dort beim
  // App-Wechsel (im Gegensatz zu einem echten Tab-Schliessen) nicht
  // garantiert.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPersistedLogBuffer();
  });
}

/** Nimmt einen Eintrag in den Ringpuffer auf; verwirft den aeltesten bei Ueberlauf. */
export function pushLogEntry(entry: LogEntry): void {
  logBuffer.push(entry);
  if (logBuffer.length > DEBUG_LOG_BUFFER_SIZE) logBuffer.shift();
  schedulePersist();
}

export function getLogBuffer(): readonly LogEntry[] {
  return logBuffer;
}

/** Loescht den Puffer auch aus dem localStorage - fuer Tests und einen moeglichen "Log leeren"-Knopf. */
export function clearLogBuffer(): void {
  logBuffer.length = 0;
  try {
    window.localStorage.removeItem(DEBUG_LOG_STORAGE_KEY);
  } catch {
    // Siehe flushPersistedLogBuffer.
  }
}

function argsToDetail(args: unknown[]): string {
  return args
    .map((arg) => {
      if (arg instanceof Error) return arg.stack ?? arg.message;
      if (typeof arg === 'string') return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
}

/**
 * Faengt console.warn/console.error ab und schreibt jeden Aufruf zusaetzlich
 * in den Ringpuffer, bevor die Originalfunktion wie gewohnt in die Konsole
 * schreibt. Deckt die vielen bereits bestehenden `console.warn(...)`-Stellen
 * in SaveSystem/CloudSystem/ProgressSyncSystem etc. ab, ohne jede einzeln
 * anzufassen - genau dort stecken die Fehler, die bisher am schwersten zu
 * diagnostizieren waren, weil eine Konsole am iPhone nicht erreichbar ist.
 *
 * Idempotent: ein zweiter Aufruf (z.B. durch Hot-Reload im Dev-Build) hängt
 * sich nicht ein zweites Mal ein.
 */
export function installConsoleCapture(): void {
  if (consoleCaptureInstalled) return;
  consoleCaptureInstalled = true;

  const record = (level: 'warn' | 'error', args: unknown[]): void => {
    pushLogEntry({
      timestamp: Date.now(),
      kind: 'error',
      label: `console.${level}`,
      detail: argsToDetail(args),
    });
  };

  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    record('warn', args);
    originalWarn(...args);
  };

  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    record('error', args);
    originalError(...args);
  };
}

function formatLogBuffer(): string {
  if (logBuffer.length === 0) return '(keine Eintraege)';

  return logBuffer
    .map((entry) => {
      const time = new Date(entry.timestamp).toISOString().slice(11, 23);
      return `${time}  [${entry.kind}]  ${entry.label}  ${entry.detail}`;
    })
    .join('\n');
}

/** True, wenn der Debug-Modus aktuell eingeschaltet ist. */
export function isDebugModeActive(): boolean {
  if (debugModeCache !== null) return debugModeCache;

  try {
    debugModeCache = window.localStorage.getItem(DEBUG_MODE_STORAGE_KEY) === '1';
  } catch {
    debugModeCache = false;
  }
  return debugModeCache;
}

function setDebugModeActive(active: boolean): void {
  debugModeCache = active;
  try {
    if (active) {
      window.localStorage.setItem(DEBUG_MODE_STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(DEBUG_MODE_STORAGE_KEY);
    }
  } catch (error) {
    console.warn('[DebugSystem] Zustand nicht speicherbar.', error);
  }
}

/**
 * Zaehlt einen Tipp auf das Logo. Bei Erreichen der Schwelle innerhalb des
 * Zeitfensters wird der Debug-Modus umgeschaltet und der neue Zustand
 * zurueckgegeben; sonst `null`.
 *
 * Der Zaehler lebt als Modul-Zustand statt als Scene-Feld, weil MenuScene bei
 * jedem Zurueck-Navigieren neu erzeugt wird (`create()` laeuft erneut) - ein
 * Scene-Feld wuerde bei jeder Rueckkehr ins Menue auf 0 zurueckfallen.
 */
export function registerLogoTap(now: number = Date.now()): boolean | null {
  tapTimestamps = tapTimestamps.filter((t) => now - t <= DEBUG_TOGGLE_TAP_WINDOW_MS);
  tapTimestamps.push(now);

  if (tapTimestamps.length < DEBUG_TOGGLE_TAP_COUNT) return null;

  tapTimestamps = [];
  const next = !isDebugModeActive();
  setDebugModeActive(next);
  return next;
}

/**
 * Haelt den Ausgangszustand beim App-Start fest - Version, Startweg,
 * Netzwerkstatus. Ohne diesen expliziten Eintrag begaenne der Verlauf erst
 * beim ersten Spiel-Event; ein Bug, der schon vor dem ersten Tastendruck
 * auftritt (z.B. ein fehlgeschlagener Sync direkt beim Start), waere sonst
 * nicht im Report sichtbar.
 */
export function logAppStart(context: { standalone: boolean; ios: boolean }): void {
  pushLogEntry({
    timestamp: Date.now(),
    kind: 'event',
    label: 'app:start',
    detail: `v${APP_VERSION}  standalone=${context.standalone}  ios=${context.ios}  online=${navigator.onLine}`,
  });
}

/** Wandelt einen Canvas-Inhalt in eine PNG-Datei fuer das Share-Sheet um. */
export function captureScreenshot(canvas: HTMLCanvasElement): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Screenshot konnte nicht erzeugt werden.'));
        return;
      }
      resolve(new File([blob], `isihunt-debug-${Date.now()}.png`, { type: 'image/png' }));
    }, 'image/png');
  });
}

/** Baut den zusammenhaengenden Text-Report: Momentaufnahme plus Ereignisverlauf. */
export async function buildReport(
  canvas: HTMLCanvasElement,
  activeSceneKeys: readonly string[],
): Promise<string> {
  const device = measureDevice();
  const storageLine = await readWebStorageLine();

  return [
    `isiHunt Debug-Report`,
    `Zeit        ${new Date().toISOString()}`,
    `Version     v${APP_VERSION}`,
    `Scenes      ${activeSceneKeys.join(', ') || '(keine)'}`,
    '',
    'GERÄT / BROWSER',
    ...device.lines,
    storageLine,
    '',
    'LAYOUT',
    formatLayout(measureLayout(canvas)),
    '',
    'TON-DIAGNOSE',
    SoundSystem.formatDiagnostics(SoundSystem.getDiagnostics()),
    '',
    'VERLAUF (letzte Ereignisse und Fehler)',
    formatLogBuffer(),
  ].join('\n');
}

/** Erzeugt Screenshot und Text-Report und reicht beide an das native Share-Sheet weiter. */
export async function shareReport(
  canvas: HTMLCanvasElement,
  activeSceneKeys: readonly string[],
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [screenshot, reportText] = await Promise.all([
    captureScreenshot(canvas),
    buildReport(canvas, activeSceneKeys),
  ]);
  const reportFile = new File([reportText], `isihunt-debug-${Date.now()}.txt`, {
    type: 'text/plain',
  });

  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
  };

  if (
    typeof nav.share === 'function' &&
    (!nav.canShare || nav.canShare({ files: [screenshot, reportFile] }))
  ) {
    try {
      await nav.share({
        text: `isiHunt Debug-Report v${APP_VERSION}`,
        files: [screenshot, reportFile],
      });
      return { ok: true };
    } catch (error) {
      // Abbruch durch den Nutzer (AbortError) ist kein Fehlerfall.
      if (error instanceof Error && error.name === 'AbortError') return { ok: true };
      console.warn('[DebugSystem] Teilen fehlgeschlagen, weiche auf Download aus.', error);
    }
  }

  downloadFallback(screenshot);
  downloadFallback(reportFile);
  return { ok: false, reason: 'Teilen nicht verfuegbar - Dateien wurden heruntergeladen.' };
}

/** Loest einen unsichtbaren Download aus - Fallback fuer Plattformen ohne Web Share API. */
function downloadFallback(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
