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

import { APP_VERSION, configureGameHeight, GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { isIos, isStandalone } from '@/core/display';
import { eventBus, GameEvent } from '@/core/EventBus';
import { requestPortraitOrientationLock } from '@/core/orientation';
import { keepCanvasBoundsFresh, waitForViewportToSettle } from '@/core/viewport';
import { AdminScene } from '@/scenes/AdminScene';
import { AdminPinScene } from '@/scenes/AdminPinScene';
import { AdminStatsScene } from '@/scenes/AdminStatsScene';
import { AdminUsersScene } from '@/scenes/AdminUsersScene';
import { AccountScene } from '@/scenes/AccountScene';
import { AchievementsScene } from '@/scenes/AchievementsScene';
import { BootScene } from '@/scenes/BootScene';
import { ChallengeScene } from '@/scenes/ChallengeScene';
import { GameScene } from '@/scenes/GameScene';
import { HudScene } from '@/scenes/HudScene';
import { LeaderboardScene } from '@/scenes/LeaderboardScene';
import { MenuScene } from '@/scenes/MenuScene';
import { OnlineDuelScene } from '@/scenes/OnlineDuelScene';
import { ProfileScene } from '@/scenes/ProfileScene';
import { ResultScene } from '@/scenes/ResultScene';
import { RulerScene } from '@/scenes/RulerScene';
import { SettingsScene } from '@/scenes/SettingsScene';
import { SceneKey } from '@/scenes/SceneKey';
import { SyncScene } from '@/scenes/SyncScene';
import { TalentScene } from '@/scenes/TalentScene';
import { WorldInfoScene } from '@/scenes/WorldInfoScene';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import * as AuthSystem from '@/systems/AuthSystem';
import * as DebugSystem from '@/systems/DebugSystem';
import * as SoundSystem from '@/systems/SoundSystem';
import { installDebugOverlay } from '@/ui/debugOverlay';
import { Palette } from '@/ui/theme';

function createGameConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: 'game',
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
      // WebGL loescht den Backbuffer sonst sofort nach dem Praesentieren -
      // DebugSystem.captureScreenshot() liest ueber canvas.toBlob() dann
      // einen bereits geleerten Puffer und liefert ein schwarzes Bild.
      preserveDrawingBuffer: true,
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
      AchievementsScene,
      WorldInfoScene,
      GameScene,
      HudScene,
      ResultScene,
      ChallengeScene,
      OnlineDuelScene,
      LeaderboardScene,
      SettingsScene,
      AccountScene,
      TalentScene,
      SyncScene,
      AdminScene,
      AdminPinScene,
      AdminStatsScene,
      AdminUsersScene,
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
SafeAreaSystem.initialize();
AuthSystem.initialize();

/**
 * Verdrahtet den rollierenden Debug-Ringpuffer, so frueh wie moeglich im
 * Lebenszyklus - er soll auch Ereignisse und Fehler festhalten, die vor dem
 * Einschalten des Debug-Modus passieren, damit im Ernstfall sichtbar bleibt,
 * was VOR einem Bug geschah (nicht nur der Zustand danach).
 */
function installDebugLogging(): void {
  DebugSystem.installConsoleCapture();
  DebugSystem.logAppStart({ standalone: isStandalone(), ios: isIos() });

  for (const key of Object.values(GameEvent)) {
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

void startGame();
