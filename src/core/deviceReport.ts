/**
 * Technische Daten, die eine Web-App ueber ihr aktuelles Geraet lesen darf.
 *
 * Wichtig: iOS gibt Webseiten weder das exakte iPhone-Modell noch den freien
 * Gesamtspeicher des Telefons. Der Bericht sagt das offen, statt aus der
 * Bildschirmgroesse ein Modell zu erraten.
 */

interface ConnectionHints {
  readonly effectiveType?: string;
  readonly type?: string;
  readonly downlink?: number;
}

interface NavigatorHints extends Navigator {
  readonly connection?: ConnectionHints;
  readonly deviceMemory?: number;
  readonly standalone?: boolean;
}

export interface DeviceReport {
  readonly lines: readonly string[];
  readonly storageLine: string;
}

function navigatorHints(): NavigatorHints {
  return navigator as NavigatorHints;
}

function platformName(): string {
  const ua = navigator.userAgent;
  const isIpadOs = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;

  if (/iPhone/.test(ua)) return 'iPhone (Modell nicht auslesbar)';
  if (/iPad/.test(ua) || isIpadOs) return 'iPad (Modell nicht auslesbar)';
  if (/Android/.test(ua)) return 'Android-Geraet';
  if (/Windows/.test(ua)) return 'Windows-PC';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Linux/.test(ua)) return 'Linux-Geraet';
  return 'Unbekanntes Geraet';
}

function osVersion(): string {
  const ua = navigator.userAgent;
  const ios = ua.match(/OS (\d+)[._](\d+)(?:[._](\d+))?/);
  if (ios) return `iOS ${ios[1]}.${ios[2]}${ios[3] ? `.${ios[3]}` : ''}`;

  const android = ua.match(/Android (\d+(?:\.\d+)+)/);
  if (android) return `Android ${android[1]}`;

  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'macOS';
  return 'System-Version nicht gemeldet';
}

function browserName(): string {
  const ua = navigator.userAgent;
  if (/CriOS/.test(ua)) return 'Chrome iOS';
  if (/FxiOS/.test(ua)) return 'Firefox iOS';
  if (/EdgiOS/.test(ua)) return 'Edge iOS';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Browser nicht erkannt';
}

function memoryLine(): string {
  const memory = navigatorHints().deviceMemory;
  return typeof memory === 'number' ? `RAM ca. ${memory} GB` : 'RAM nicht gemeldet';
}

function networkLine(): string {
  const connection = navigatorHints().connection;
  if (!connection) return 'Netzwerk nicht gemeldet';

  const kind = connection.effectiveType ?? connection.type;
  if (!kind) return 'Netzwerk erkannt, Details fehlen';

  const speed =
    typeof connection.downlink === 'number' ? `, ca. ${connection.downlink} Mbit/s` : '';
  return `${kind.toUpperCase()}${speed}`;
}

export function measureDevice(): DeviceReport {
  const screenWidth = Math.round(window.screen.width * window.devicePixelRatio);
  const screenHeight = Math.round(window.screen.height * window.devicePixelRatio);
  const hints = navigatorHints();

  return {
    lines: [
      `Geraet      ${platformName()}`,
      `System      ${osVersion()}  ·  ${browserName()}`,
      `Display     ${window.screen.width} x ${window.screen.height} CSS / ${screenWidth} x ${screenHeight} px`,
      `Pixelratio  ${window.devicePixelRatio.toFixed(2)}  ·  Touch ${navigator.maxTouchPoints}`,
      `CPU / RAM   ${hints.hardwareConcurrency ?? '?'} Kerne  ·  ${memoryLine()}`,
      `Netz        ${networkLine()}`,
    ],
    storageLine: 'Webspeicher wird gelesen ...',
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Speicher der Web-App, nicht der freie Gesamtspeicher des Telefons. */
export async function readWebStorageLine(): Promise<string> {
  if (!navigator.storage?.estimate) return 'Webspeicher nicht auslesbar';

  try {
    const estimate = await navigator.storage.estimate();
    if (typeof estimate.quota !== 'number') return 'Webspeicher nicht auslesbar';

    const used = typeof estimate.usage === 'number' ? formatBytes(estimate.usage) : '?';
    return `Webspeicher ${used} / ${formatBytes(estimate.quota)}  (nicht Geraetespeicher)`;
  } catch {
    return 'Webspeicher nicht auslesbar';
  }
}
