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
  DEBUG_PROTECTED_BUFFER_SIZE,
  DEBUG_PROTECTED_STORAGE_KEY,
  DEBUG_TOGGLE_TAP_COUNT,
  DEBUG_TOGGLE_TAP_WINDOW_MS,
} from '@/config/DebugConfig';
import { APP_VERSION } from '@/config/GameConfig';
import { measureDevice, readWebStorageLine } from '@/core/deviceReport';
import { formatLayout, measureLayout } from '@/core/layoutReport';

export type LogEntryKind = 'event' | 'error';

export interface LogEntry {
  readonly timestamp: number;
  readonly kind: LogEntryKind;
  readonly label: string;
  readonly detail: string;
}

const DEBUG_REPORT_VERSION = 2;
let droppedLogEntries = 0;
let droppedProtectedEntries = 0;
let persistFailures = 0;

const logBuffer: LogEntry[] = loadPersistedBuffer(DEBUG_LOG_STORAGE_KEY, DEBUG_LOG_BUFFER_SIZE);
const protectedBuffer: LogEntry[] = loadPersistedBuffer(
  DEBUG_PROTECTED_STORAGE_KEY,
  DEBUG_PROTECTED_BUFFER_SIZE,
);
let tapTimestamps: number[] = [];
let debugModeCache: boolean | null = null;
let consoleCaptureInstalled = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let soundDiagnosticsProvider: (() => string) | null = null;
let stateDiagnosticsProvider: (() => string) | null = null;
let lastServerContactAt: number | null = null;
const sessionId = createSessionId();

function createSessionId(): string {
  try {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // A restricted browser context may expose crypto without randomUUID.
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function correlationId(): string {
  try {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // Fall through to a non-secret local identifier.
  }
  return `rpc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeRpcText(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/bearer\s+[a-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/(token|secret|password|pin)\s*[=:]\s*[^\s,;]+/gi, '$1=[redacted]')
    .slice(0, maxLength);
}

/** Protokolliert die fachliche RPC-Antwort getrennt vom HTTP-/Transportergebnis. */
export function logRpcResponse(
  operation: string,
  response: unknown,
  requestCorrelationId = correlationId(),
): string {
  const record =
    response && typeof response === 'object' ? (response as Record<string, unknown>) : {};
  const error =
    record.error && typeof record.error === 'object'
      ? (record.error as Record<string, unknown>)
      : null;
  const detail = error
    ? [
        `correlation=${requestCorrelationId}`,
        `code=${safeRpcText(error.code) || 'unbekannt'}`,
        `message=${safeRpcText(error.message) || 'unbekannt'}`,
        `details=${safeRpcText(error.details) || '-'}`,
        `hint=${safeRpcText(error.hint) || '-'}`,
      ].join(' ')
    : `correlation=${requestCorrelationId} fachlich=ok`;
  pushProtectedLogEntry({
    timestamp: Date.now(),
    kind: error ? 'error' : 'event',
    label: `rpc:${operation}`,
    detail,
  });
  return requestCorrelationId;
}

/**
 * Laedt den beim letzten Beenden gespeicherten Puffer, damit ein
 * Fehlerbericht einen App-Neustart ueberlebt - siehe `DEBUG_LOG_STORAGE_KEY`.
 * Ungueltige oder fehlende Daten ergeben einen leeren Start statt eines
 * Fehlers; ein kaputter Debug-Log darf das eigentliche Spiel nie stoeren.
 *
 * Nimmt den Schluessel als Parameter, weil Haupt- und geschuetzter Puffer
 * dieselbe Ladelogik brauchen, aber getrennt liegen muessen.
 */
function isLogEntry(value: unknown): value is LogEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<LogEntry>;
  return (
    typeof entry.timestamp === 'number' &&
    Number.isFinite(entry.timestamp) &&
    (entry.kind === 'event' || entry.kind === 'error') &&
    typeof entry.label === 'string' &&
    entry.label.length <= 160 &&
    typeof entry.detail === 'string' &&
    entry.detail.length <= 4000
  );
}

function loadPersistedBuffer(storageKey: string, maxEntries: number): LogEntry[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(isLogEntry);
    return valid.slice(-maxEntries);
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

/** Schreibt beide Puffer sofort - fuer den Drossel-Timer und beim Seitenverlassen. */
function flushPersistedLogBuffer(): void {
  try {
    window.localStorage.setItem(DEBUG_LOG_STORAGE_KEY, JSON.stringify(logBuffer));
    window.localStorage.setItem(DEBUG_PROTECTED_STORAGE_KEY, JSON.stringify(protectedBuffer));
  } catch {
    persistFailures += 1;
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
  if (logBuffer.length > DEBUG_LOG_BUFFER_SIZE) {
    logBuffer.shift();
    droppedLogEntries += 1;
  }
  schedulePersist();
}

/**
 * Nimmt einen Eintrag in den GESCHUETZTEN Puffer auf - fuer seltene
 * Ereignisse, die eine Runde ueberleben muessen.
 *
 * **Warum ein zweiter Puffer noetig wurde.** Der Hauptpuffer fasst 400
 * Eintraege, ein Fang erzeugt drei (`run:collected`, `score:changed`,
 * `combo:changed`). Der Geraetebericht vom 2026-08-23 zaehlte 148 Relikte in
 * einer Runde: 444 Eintraege, mehr als der ganze Puffer. Alles, was beim
 * Rundenstart passierte - Kanalstatus, Sendeversuche, verworfene Meldungen -
 * war am Rundenende restlos ueberschrieben. Die Diagnose, die eigens dafuer
 * eingebaut worden war, erreichte den Bericht nie.
 *
 * Den Hauptpuffer einfach zu vergroessern waere der falsche Weg: er wird bei
 * jeder Aenderung vollstaendig nach `localStorage` serialisiert
 * (`flushPersistedLogBuffer`), die Kosten waechsen also mit jeder Zeile. Ein
 * eigener, kleiner Puffer loest das Problem an der Ursache: seltene
 * Ereignisse konkurrieren gar nicht erst mit haeufigen.
 *
 * Die Trennung folgt der Ereignisrate, nicht der Wichtigkeit: hier gehoert
 * hinein, was pro Runde einstellig auftritt (Kanalwechsel, Fehlschlaege,
 * einmalige Verwurfsgruende) - nichts, was im Takt feuert.
 */
export function pushProtectedLogEntry(entry: LogEntry): void {
  protectedBuffer.push(entry);
  if (protectedBuffer.length > DEBUG_PROTECTED_BUFFER_SIZE) {
    protectedBuffer.shift();
    droppedProtectedEntries += 1;
  }
  schedulePersist();
}

export function getLogBuffer(): readonly LogEntry[] {
  return logBuffer;
}

export function getProtectedLogBuffer(): readonly LogEntry[] {
  return protectedBuffer;
}

/**
 * Bindet die optionale Audio-Diagnose aus dem App-Einstieg an. Der Debug-
 * Kern bleibt dadurch frei von einem statischen SoundSystem-/Phaser-Import;
 * das haelt Cloud- und Testpfade klein und verhindert einen nutzlosen
 * dynamisch-plus-statisch-Import im Produktionsbundle.
 */
export function setSoundDiagnosticsProvider(provider: (() => string) | null): void {
  soundDiagnosticsProvider = provider;
}

/** Bindet den aktuellen Save-/Sync-/Auth-Zustand an den Report, ohne Systeme zu importieren. */
export function setStateDiagnosticsProvider(provider: (() => string) | null): void {
  stateDiagnosticsProvider = provider;
}

/** Merkt den letzten erhaltenen Serverkontakt; eine Antwort mit RPC-Fehler ist trotzdem Kontakt. */
export function markServerContact(timestamp = Date.now()): void {
  lastServerContactAt = timestamp;
}

/** Loescht beide Puffer auch aus dem localStorage - fuer Tests und einen moeglichen "Log leeren"-Knopf. */
export function clearLogBuffer(): void {
  logBuffer.length = 0;
  protectedBuffer.length = 0;
  droppedLogEntries = 0;
  droppedProtectedEntries = 0;
  persistFailures = 0;
  try {
    window.localStorage.removeItem(DEBUG_LOG_STORAGE_KEY);
    window.localStorage.removeItem(DEBUG_PROTECTED_STORAGE_KEY);
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

function formatBuffer(entries: readonly LogEntry[]): string {
  if (entries.length === 0) return '(keine Eintraege)';

  return entries
    .map((entry) => {
      const time = new Date(entry.timestamp).toISOString().slice(11, 23);
      return `${time}  [${entry.kind}]  ${entry.label}  ${entry.detail}`;
    })
    .join('\n');
}

function bufferSummary(name: string, entries: readonly LogEntry[], dropped: number): string {
  const first = entries[0]?.timestamp;
  const last = entries[entries.length - 1]?.timestamp;
  const range =
    first !== undefined && last !== undefined
      ? `${new Date(first).toISOString()} bis ${new Date(last).toISOString()}`
      : '(kein Zeitraum)';
  return `${name}: ${entries.length} Eintraege, verworfen=${dropped}, Zeitraum=${range}`;
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

/**
 * Beschreibt, ob der Screenshot ueberhaupt Inhalt tragen kann.
 *
 * Fragt den echten WebGL-Kontext statt die Build-Flags: `preserveDrawingBuffer`
 * wird beim Erzeugen des Kontexts festgelegt, und nur der Kontext weiss, was
 * daraus tatsaechlich geworden ist. Ein Bericht, der die Absicht wiederholt
 * statt den Zustand zu messen, haette den Fehler von 2026-08-23 nicht
 * aufgedeckt - dort war die Absicht "Screenshots im Debug-Modus" richtig, nur
 * die Bedingung im Code falsch.
 *
 * Steht hier "nein", ist ein schwarzes Bild erklaerbar statt raetselhaft: der
 * Debug-Modus wurde erst nach dem Start eingeschaltet, ein Neustart der App
 * behebt es.
 */
function screenshotDiagnosticsLine(canvas: HTMLCanvasElement): string {
  const context = (canvas.getContext('webgl2') ??
    canvas.getContext('webgl')) as WebGLRenderingContext | null;

  if (!context) {
    // Kein WebGL heisst Canvas-2D-Renderer - der haelt seinen Inhalt ohnehin,
    // `toBlob()` liefert dort immer ein Bild.
    return 'Bild moeglich    ja (Canvas-2D, kein WebGL)';
  }

  const preserved = context.getContextAttributes()?.preserveDrawingBuffer === true;
  return preserved
    ? 'Bild moeglich    ja'
    : 'Bild moeglich    NEIN - Screenshot bleibt schwarz. App neu starten, dann erneut berichten.';
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
    `Reportformat ${DEBUG_REPORT_VERSION}`,
    `Zeit        ${new Date().toISOString()}`,
    `Version     v${APP_VERSION}`,
    `Session     ${sessionId}`,
    `Sichtbarkeit ${document.visibilityState}`,
    `Online      ${navigator.onLine}  letzter Serverkontakt=${
      lastServerContactAt === null ? 'unbekannt' : new Date(lastServerContactAt).toISOString()
    }`,
    `Scenes      ${activeSceneKeys.join(', ') || '(keine)'}`,
    '',
    'GERÄT / BROWSER',
    ...device.lines,
    storageLine,
    '',
    'LAYOUT',
    formatLayout(measureLayout(canvas)),
    '',
    'SCREENSHOT',
    screenshotDiagnosticsLine(canvas),
    '',
    'TON-DIAGNOSE',
    soundDiagnosticsProvider?.() ?? 'Nicht verfuegbar (Audio-Diagnose nicht initialisiert)',
    '',
    'PUFFER',
    bufferSummary('Geschuetzt', protectedBuffer, droppedProtectedEntries),
    bufferSummary('Verlauf', logBuffer, droppedLogEntries),
    `Persistierungsfehler=${persistFailures}`,
    '',
    'ZUSTAND',
    stateDiagnosticsProvider?.() ?? 'Zustandsdiagnose nicht initialisiert',
    '',
    // Zuerst der geschuetzte Puffer: er traegt die seltenen Ereignisse, die
    // eine Diagnose ueberhaupt erst moeglich machen, und wuerde am Ende eines
    // langen Verlaufs leicht uebersehen.
    'WICHTIGE EREIGNISSE (ueberdauern eine ganze Runde)',
    formatBuffer(protectedBuffer),
    '',
    'VERLAUF (letzte Ereignisse und Fehler)',
    formatBuffer(logBuffer),
  ].join('\n');
}

/** Erzeugt Screenshot und Text-Report und reicht beide an das native Share-Sheet weiter. */
export async function shareReport(
  canvas: HTMLCanvasElement,
  activeSceneKeys: readonly string[],
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const reportText = await buildReport(canvas, activeSceneKeys);
  const reportFile = new File([reportText], `isihunt-debug-${Date.now()}.txt`, {
    type: 'text/plain',
  });

  let screenshot: File | null = null;
  try {
    screenshot = await captureScreenshot(canvas);
  } catch (error) {
    console.warn('[DebugSystem] Screenshot fehlgeschlagen, Textreport bleibt verfuegbar.', error);
  }

  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
  };

  if (
    screenshot &&
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

  if (screenshot) downloadFallback(screenshot);
  downloadFallback(reportFile);
  return {
    ok: false,
    reason: screenshot
      ? 'Teilen nicht verfuegbar - Dateien wurden heruntergeladen.'
      : 'Screenshot fehlgeschlagen - Textreport wurde heruntergeladen.',
  };
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
