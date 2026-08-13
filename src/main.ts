/**
 * Einstiegspunkt: Phaser konfigurieren und starten.
 *
 * Skalierung: Das Spiel rendert intern in GAME_WIDTH x GAME_HEIGHT. Die Breite
 * bleibt 720, die Hoehe wird beim Start aus der verfuegbaren Portrait-Flaeche
 * berechnet (mindestens 1280). Phaser skaliert das per FIT auf das Geraet und
 * zentriert es. Szenen, die mit GAME_HEIGHT arbeiten, nutzen dadurch die
 * zusaetzliche Hoehe ohne geraeteabhaengige Sonderkoordinaten.
 */

import Phaser from 'phaser';

import { APP_VERSION, configureGameHeight, GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { isStandalone } from '@/core/display';
import { requestPortraitOrientationLock } from '@/core/orientation';
import { keepCanvasBoundsFresh, waitForViewportToSettle } from '@/core/viewport';
import { AdminScene } from '@/scenes/AdminScene';
import { BootScene } from '@/scenes/BootScene';
import { ChallengeScene } from '@/scenes/ChallengeScene';
import { GameScene } from '@/scenes/GameScene';
import { HudScene } from '@/scenes/HudScene';
import { LeaderboardScene } from '@/scenes/LeaderboardScene';
import { MenuScene } from '@/scenes/MenuScene';
import { ProfileScene } from '@/scenes/ProfileScene';
import { ResultScene } from '@/scenes/ResultScene';
import { RulerScene } from '@/scenes/RulerScene';
import { SettingsScene } from '@/scenes/SettingsScene';
import { SceneKey } from '@/scenes/SceneKey';
import { SyncScene } from '@/scenes/SyncScene';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import * as SoundSystem from '@/systems/SoundSystem';
import { Palette } from '@/ui/theme';

function createGameConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: Palette.backdrop,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    render: {
      antialias: true,
      // Runde Pixel: verhindert flimmernde Kanten bei nicht-ganzzahliger Skalierung.
      roundPixels: true,
      powerPreference: 'high-performance',
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
      GameScene,
      HudScene,
      ResultScene,
      ChallengeScene,
      LeaderboardScene,
      SettingsScene,
      SyncScene,
      AdminScene,
      RulerScene,
    ],
  };
}

// Version in die Seite schreiben, bevor Phaser startet. Sie steht damit auch
// dann auf dem Bildschirm, wenn das Spiel selbst nicht hochkommt - beim Test
// auf einem fremden Geraet ist das die erste Frage: welcher Stand laeuft da?
const versionLabel = document.getElementById('version');
if (versionLabel) versionLabel.textContent = `v${APP_VERSION}`;

// Alte iOS-Versionen melden installierte Web-Apps nicht immer ueber
// `display-mode: standalone`. Die Klasse aktiviert deshalb dieselbe 100vh-
// Umgehung auch fuer `navigator.standalone`.
if (isStandalone()) document.documentElement.classList.add('standalone-app');

// Der AudioContext darf auf iOS erst nach einer Nutzergeste laufen. Das
// SoundSystem wartet deshalb auf den ersten Tipp und bleibt ansonsten still.
SoundSystem.initialize();
SafeAreaSystem.initialize();

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
 * anderen - ein sichtbares "Spielstand zuruecksetzen" waere fuer ein Kind eine
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
      activeGame.scene.start(SceneKey.Admin);
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
