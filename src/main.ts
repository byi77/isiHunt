/**
 * Einstiegspunkt: Phaser konfigurieren und starten.
 *
 * Skalierung: Das Spiel rendert intern in GAME_WIDTH x GAME_HEIGHT. Die Breite
 * bleibt 720, die Hoehe wird beim Start aus der verfuegbaren Portrait-Flaeche
 * berechnet (mindestens 1280). Phaser skaliert das per FIT auf das Geraet und
 * zentriert es horizontal und setzt es vertikal direkt unter den App-Kopf.
 * Szenen, die mit GAME_HEIGHT arbeiten, nutzen dadurch die zusaetzliche Hoehe
 * ohne geraeteabhaengige Sonderkoordinaten.
 */

import Phaser from 'phaser';

import {
  APP_VERSION,
  configureGameHeight,
  DEBUG_ENABLED,
  GAME_HEIGHT,
  GAME_WIDTH,
  PERFORMANCE_MODE,
  SAVE_VERSION,
} from '@/config/GameConfig';
import { BALANCE_BASELINES } from '@/config/balance';
import { isIos, isStandalone } from '@/core/display';
import { eventBus, GameEvent } from '@/core/EventBus';
import { requestPortraitOrientationLock } from '@/core/orientation';
import { keepCanvasBoundsFresh, waitForViewportToSettle } from '@/core/viewport';
import { AdminScene } from '@/scenes/AdminScene';
import { AdminPinScene } from '@/scenes/AdminPinScene';
import { AdminStatsScene } from '@/scenes/AdminStatsScene';
import { AdminUsersScene } from '@/scenes/AdminUsersScene';
import { AdminRewardCodesScene } from '@/scenes/AdminRewardCodesScene';
import { AccountScene } from '@/scenes/AccountScene';
import { AchievementsScene } from '@/scenes/AchievementsScene';
import { BootScene } from '@/scenes/BootScene';
import { ChallengeScene } from '@/scenes/ChallengeScene';
import { DuelSelectScene } from '@/scenes/DuelSelectScene';
import { GameScene } from '@/scenes/GameScene';
import { HudScene } from '@/scenes/HudScene';
import { LeaderboardScene } from '@/scenes/LeaderboardScene';
import { MenuScene } from '@/scenes/MenuScene';
import { OnlineDuelScene } from '@/scenes/OnlineDuelScene';
import { ProfileScene } from '@/scenes/ProfileScene';
import { RewardCodeScene } from '@/scenes/RewardCodeScene';
import { ResultScene } from '@/scenes/ResultScene';
import { RulerScene } from '@/scenes/RulerScene';
import { SettingsScene } from '@/scenes/SettingsScene';
import { SceneKey } from '@/scenes/SceneKey';
import { SyncScene } from '@/scenes/SyncScene';
import { ShopScene } from '@/scenes/ShopScene';
import { TalentScene } from '@/scenes/TalentScene';
import { WorldInfoScene } from '@/scenes/WorldInfoScene';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import * as AuthSystem from '@/systems/AuthSystem';
import * as DebugSystem from '@/systems/DebugSystem';
import * as ProgressSyncSystem from '@/systems/ProgressSyncSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SoundSystem from '@/systems/SoundSystem';
import { installDebugOverlay } from '@/ui/debugOverlay';
import { installLetterSpacingGuard } from '@/ui/letterSpacingGuard';
import { Palette } from '@/ui/theme';

function createGameConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    // Nicht `game`: dessen Padding (sichere Flaeche + Laufband) zieht Phaser
    // beim Messen nicht ab und skaliert den Canvas dadurch 32 px zu hoch -
    // der Pause-Knopf landet unter dem sichtbaren Rand. `game-canvas` fuellt
    // nur die Innenflaeche. Begruendung in index.html.
    parent: 'game-canvas',
    backgroundColor: Palette.backdrop,
    scale: {
      mode: Phaser.Scale.FIT,
      // Vertikal beginnt der Canvas direkt unter Safe Area und Laufband.
      // CENTER_BOTH erzeugt auf hohen iPhones einen sichtbaren Leerblock
      // zwischen Laufband und Menue; horizontal bleibt er zentriert.
      autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      // Das gesamte Spielfeld statt nur des Canvas in den Vollbildmodus
      // schicken. So bleibt die HTML-Laufschrift im Safe-Area-Bereich dabei.
      fullscreenTarget: 'game',
    },
    render: {
      antialias: true,
      // Runde Pixel: verhindert flimmernde Kanten bei nicht-ganzzahliger Skalierung.
      roundPixels: true,
      powerPreference: 'high-performance',
      // Der Screenshot im Fehlerbericht (`DebugSystem.captureScreenshot`)
      // liest den Canvas per `toBlob()` aus. WebGL gibt seinen Zeichenpuffer
      // ohne dieses Flag nach jedem Frame frei - `toBlob()` bekommt dann ein
      // schwarzes Bild statt des Bildschirminhalts.
      //
      // **Nicht an den DEV-Build koppeln.** Genau das war der Fehler bis
      // v0.1.249: die Bedingung lautete `DEBUG_ENABLED`, also
      // `import.meta.env.DEV`. Der Debug-Modus wird aber per Zehnfach-Tipp
      // aufs Logo eingeschaltet, und das geschieht auf dem Geraet - im
      // Production-Build, wo `DEBUG_ENABLED` false ist. Jeder Fehlerbericht
      // vom Handy trug deshalb ein schwarzes Bild (belegt 2026-08-23). Im
      // Dev-Build fiel es nie auf, weil dort beide Bedingungen zufaellig
      // zusammenfielen.
      //
      // Massgeblich ist deshalb der Debug-Modus, nicht der Build. Der Preis
      // (gehaltener Puffer kostet Speicherbandbreite und Akku) faellt damit
      // nur an, wo jemand Fehlerberichte erzeugt - fuer normale Spieler
      // bleibt der Puffer frei. `PERFORMANCE_MODE` sticht weiterhin alles:
      // eine Messung darf sich diesen Aufschlag nicht einhandeln.
      //
      // Zur Laufzeit ist das Flag nicht umschaltbar - WebGL legt es beim
      // Erzeugen des Kontexts fest. Wer den Debug-Modus gerade erst
      // eingeschaltet hat, braucht deshalb einen App-Neustart, bis
      // Screenshots Inhalt zeigen; `DebugSystem` sagt das im Bericht an.
      preserveDrawingBuffer:
        (DEBUG_ENABLED || DebugSystem.isDebugModeActive()) && !PERFORMANCE_MODE,
    },
    input: {
      activePointers: 3,
    },
    // Fuer Namens- und Code-Eingabe: ein echtes HTML-Eingabefeld ueber dem
    // Canvas. Phaser hat kein eigenes Textfeld, und nur ein echtes Feld oeffnet
    // auf dem Handy die Systemtastatur samt Autokorrektur und Zahlenblock.
    dom: {
      createContainer: true,
    },
    // Ohne Physik-Engine: Kollision ist ein Distanztest (siehe GameScene).
    scene: [
      BootScene,
      MenuScene,
      ProfileScene,
      RewardCodeScene,
      AchievementsScene,
      WorldInfoScene,
      GameScene,
      HudScene,
      ResultScene,
      ChallengeScene,
      DuelSelectScene,
      OnlineDuelScene,
      LeaderboardScene,
      SettingsScene,
      AccountScene,
      ShopScene,
      TalentScene,
      SyncScene,
      AdminScene,
      AdminPinScene,
      AdminStatsScene,
      AdminUsersScene,
      AdminRewardCodesScene,
      RulerScene,
    ],
  };
}

// Version in die Seite schreiben, bevor Phaser startet. Sie steht damit auch
// dann auf dem Bildschirm, wenn das Spiel selbst nicht hochkommt - beim Test
// auf einem fremden Geraet ist das die erste Frage: welcher Stand laeuft da?
const versionLabel = document.getElementById('version');
if (versionLabel) versionLabel.textContent = `v${APP_VERSION}`;

// So frueh wie moeglich, damit auch die folgenden initialize()-Aufrufe
// bereits mitgeloggt werden, falls dort etwas ueber console.warn meldet.
installDebugLogging();

// Alte iOS-Versionen melden installierte Web-Apps nicht immer ueber
// `display-mode: standalone`. Die Klasse aktiviert deshalb dieselbe 100vh-
// Umgehung auch fuer `navigator.standalone`.
if (isStandalone()) document.documentElement.classList.add('standalone-app');

// Der AudioContext darf auf iOS erst nach einer Nutzergeste laufen. Das
// SoundSystem wartet deshalb auf den ersten Tipp und bleibt ansonsten still.
SoundSystem.initialize();
DebugSystem.setSoundDiagnosticsProvider(() =>
  SoundSystem.formatDiagnostics(SoundSystem.getDiagnostics()),
);
SafeAreaSystem.initialize();
AuthSystem.initialize();
DebugSystem.setStateDiagnosticsProvider(() => {
  const save = SaveSystem.load();
  const userId = AuthSystem.currentUserId();
  const sync = ProgressSyncSystem.getDiagnostics();
  const account = userId ? `angemeldet:${userId.slice(0, 8)}` : 'nicht angemeldet';
  const oldest =
    sync.oldestPendingAt === null ? 'unbekannt' : new Date(sync.oldestPendingAt).toISOString();
  return [
    `Account=${account}`,
    `Level=${save.level} XP=${save.xp} Gesamt-XP=lokal nicht separat gespeichert`,
    `Coins=${save.coins} Bestwert=${save.bestScore} Runs=${save.totalRuns}`,
    `OutboxEvents=${sync.pendingEvents} ältestesEvent=${oldest} Tagesbonus=${sync.pendingDaily} BotSiege=${sync.pendingBotVictories} abgelehnt=${sync.rejectedEvents}`,
    `SpielstandVersion=${SAVE_VERSION} SchemaErwartung=66 (Serverzeit nicht abgefragt)`,
    `BalanceQuelle=balance-data.json Baseline=${BALANCE_BASELINES.capturedAt}`,
  ].join('  ');
});

/**
 * Ereignisse, die in jedem Frame feuern und deshalb nicht in den Ringpuffer
 * gehoeren.
 *
 * Bei ~60 Schuessen pro Sekunde fuellt ein einziges solches Ereignis die 1000
 * Plaetze des Puffers in gut 16 Sekunden. Alles Aeltere - App-Start, Login,
 * Cloud-Antworten, das Rundenende - ist dann verdraengt.
 *
 * Das ist zweimal passiert. Erst mit `TimerChanged` (Audit 2026-08-19), dann
 * erneut mit `ComboWindowChanged`, das spaeter dazukam und den Ausschluss
 * nicht mitbekam: Am 19.09. fehlte ein Run in der Bestenliste, und der
 * Debug-Report reichte nur bis 13 Sekunden VOR das Rundenende zurueck - die
 * entscheidende Frage, ob der Upload ueberhaupt versucht wurde, war aus dem
 * Puffer gespuelt.
 *
 * Deshalb eine Liste statt einer Sonderbehandlung: Ein neues Frame-Ereignis
 * wird hier eingetragen, nicht in einer `if`-Kette vergessen. Die Information
 * geht nicht verloren - `RunStarted` steht mit seiner Dauer im Puffer, und
 * jeder Eintrag traegt einen Zeitstempel.
 */
/**
 * Verdrahtet den rollierenden Debug-Ringpuffer, so frueh wie moeglich im
 * Lebenszyklus - er soll auch Ereignisse und Fehler festhalten, die vor dem
 * Einschalten des Debug-Modus passieren, damit im Ernstfall sichtbar bleibt,
 * was VOR einem Bug geschah (nicht nur der Zustand danach).
 */
function installDebugLogging(): void {
  // Die Menge steht INNERHALB der Funktion, nicht daneben: `main.ts` ruft
  // `installDebugLogging()` weit oben auf, waehrend eine Konstante auf
  // Modulebene erst an ihrer Zeile initialisiert wird. Als `const` daneben
  // startete die App gar nicht mehr ("Cannot access ... before
  // initialization") - und `npm run verify` sah das nicht, weil dort nie ein
  // Browser die Seite laedt. Erst `npm run smoke` faellt darueber.
  const frameEreignisse: ReadonlySet<string> = new Set<string>([
    GameEvent.TimerChanged,
    GameEvent.ComboWindowChanged,
  ]);
  DebugSystem.installConsoleCapture();
  DebugSystem.logAppStart({ standalone: isStandalone(), ios: isIos() });

  for (const key of Object.values(GameEvent)) {
    // Frame-Ereignisse bleiben draussen (siehe `frameEreignisse` oben).
    if (frameEreignisse.has(key)) continue;

    eventBus.onEvent(key, (payload) => {
      DebugSystem.pushLogEntry({
        timestamp: Date.now(),
        kind: 'event',
        label: key,
        detail: payload === undefined ? '' : JSON.stringify(payload),
      });
    });
  }

  window.addEventListener('error', (event) => {
    DebugSystem.pushLogEntry({
      timestamp: Date.now(),
      kind: 'error',
      label: event.message,
      detail: event.error instanceof Error ? (event.error.stack ?? '') : '',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as unknown;
    DebugSystem.pushLogEntry({
      timestamp: Date.now(),
      kind: 'error',
      label: 'unhandledrejection',
      detail: reason instanceof Error ? (reason.stack ?? reason.message) : String(reason),
    });
  });
}

// Manifest und installierte Web-App sperren die Ausrichtung bereits. Die
// Browser-API ist die zusaetzliche Moeglichkeit fuer Android; auf iOS Safari
// darf eine Webseite diese Sperre nicht erzwingen (siehe orientation.ts).
requestPortraitOrientationLock();

let game: Phaser.Game | null = null;

/**
 * Hält die App-Shell für einen vollständigen Offline-Neustart vor.
 *
 * Der Spielstand liegt zwar in `localStorage`, ohne gecachte HTML-/JS-Dateien
 * könnte der Browser die App nach einem Neustart ohne Netz aber gar nicht erst
 * öffnen. Im Dev-Server bleibt der Service Worker bewusst ausgeschaltet, damit
 * er Entwicklung und HMR nicht beeinflusst.
 */
function registerOfflineAppShell(): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;

  const register = (): void => {
    void navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .catch((error: unknown) => {
        console.warn('[isiHunt] Offline-App-Shell konnte nicht registriert werden.', error);
      });
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

/**
 * Dreimal tippen und danach lange auf die Versionsnummer druecken oeffnet
 * den Wartungsbildschirm.
 *
 * Der Zugang liegt am DOM-Element und nicht an einem Knopf im Spiel: Er soll
 * auffindbar sein fuer den, der davon weiss, und unauffaellig fuer alle
 * anderen - ein sichtbares "Spielstand zurücksetzen" waere fuer ein Kind eine
 * Falle.
 *
 * `pointer-events` ist fuer #version aus (die Nummer soll nichts abfangen), das
 * Ereignis kommt deshalb vom Fenster und wird ueber die Position zugeordnet.
 */
function installAdminLongPress(activeGame: Phaser.Game): void {
  if (!versionLabel) return;

  const ERFORDERLICHE_TIPPS = 3;
  const TIPP_FENSTER_MS = 1200;
  const LANGER_DRUCK_MS = 800;
  let holdTimer: number | undefined;
  let resetTapTimer: number | undefined;
  let tapCount = 0;

  const trifftVersion = (event: PointerEvent): boolean => {
    const box = versionLabel.getBoundingClientRect();
    // Grosszuegiger Rand: Die Nummer selbst ist winzig, und getroffen werden
    // soll sie mit dem Daumen (ART_STYLE.md 8).
    const rand = 24;
    return (
      event.clientX >= box.left - rand &&
      event.clientX <= box.right + rand &&
      event.clientY >= box.top - rand &&
      event.clientY <= box.bottom + rand
    );
  };

  window.addEventListener('pointerdown', (event) => {
    if (!trifftVersion(event)) return;
    if (tapCount < ERFORDERLICHE_TIPPS) return;

    holdTimer = window.setTimeout(() => {
      activeGame.scene.getScenes(true).forEach((scene) => scene.scene.stop());
      activeGame.scene.start(SceneKey.AdminPin);
      tapCount = 0;
    }, LANGER_DRUCK_MS);
  });

  const abbrechen = (event: PointerEvent): void => {
    if (holdTimer !== undefined) {
      window.clearTimeout(holdTimer);
      holdTimer = undefined;
    }

    if (!trifftVersion(event) || tapCount >= ERFORDERLICHE_TIPPS) return;

    tapCount += 1;
    if (resetTapTimer !== undefined) window.clearTimeout(resetTapTimer);
    resetTapTimer = window.setTimeout(() => {
      tapCount = 0;
      resetTapTimer = undefined;
    }, TIPP_FENSTER_MS);
  };

  window.addEventListener('pointerup', abbrechen);
  window.addEventListener('pointercancel', (event) => {
    if (holdTimer !== undefined) window.clearTimeout(holdTimer);
    holdTimer = undefined;
    if (trifftVersion(event)) tapCount = 0;
  });

  // Abbrechen erst, wenn der Finger die Nummer wirklich verlaesst. Ein
  // `pointermove`-Abbruch ohne diese Pruefung wuerde schon am Zittern eines
  // aufliegenden Daumens scheitern.
  window.addEventListener('pointermove', (event) => {
    if (holdTimer !== undefined && !trifftVersion(event)) {
      window.clearTimeout(holdTimer);
      holdTimer = undefined;
    }
  });
}

async function startGame(): Promise<void> {
  // iOS kann die PWA-Fensterhoehe erst nach dem ersten Layout-Frame
  // korrigieren. Erst danach darf GAME_HEIGHT fuer Phaser festgelegt werden.
  await waitForViewportToSettle();
  configureGameHeight();
  installLetterSpacingGuard();
  game = new Phaser.Game(createGameConfig());

  installAdminLongPress(game);

  // Bleibt eingeschaltet ueber Neustarts hinweg, damit ein Tester den Debug-
  // Modus nicht nach jedem Neuladen erneut per Logo-Geste aktivieren muss.
  if (DebugSystem.isDebugModeActive()) installDebugOverlay(game);

  // Ohne das liegen Trefferflaechen auf dem iPhone neben dem, was man sieht -
  // die Begruendung steht in core/viewport.ts.
  keepCanvasBoundsFresh(game);

  // Im Dev-Build ueber die Browser-Konsole erreichbar (`isiHunt.scale`,
  // `isiHunt.scene.getScene('Game')`). Im Production-Build entfaellt der Block.
  //
  // Bewusst NICHT `window.game`: Browser legen fuer jedes Element mit id einen
  // gleichnamigen Verweis auf window an, und index.html enthaelt <div id="game">.
  // `window.game` waere also schon belegt - der Name haette je nach Ladezeitpunkt
  // mal das Spiel und mal das DIV geliefert.
  if (import.meta.env.DEV) {
    (window as unknown as { isiHunt: Phaser.Game }).isiHunt = game;
  }
}

registerOfflineAppShell();
void startGame();
