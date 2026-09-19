/**
 * Ergebnisbildschirm.
 *
 * Zweck ist nicht Statistik, sondern Belohnung: erst die Zahl, dann was sie
 * gebracht hat (Level, Welten, Achievements), dann sofort wieder rein. Der
 * "Nochmal"-Knopf liegt bewusst dort, wo beim Spielen der Daumen ohnehin war.
 */

import Phaser from 'phaser';

import { getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as CloudSystem from '@/systems/CloudSystem';
import * as AuthSystem from '@/systems/AuthSystem';
import * as DebugSystem from '@/systems/DebugSystem';
import * as ProgressSyncSystem from '@/systems/ProgressSyncSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { createSceneBackdrop } from '@/ui/widgets';
import { ResultView } from '@/ui/ResultView';
import { soloResultContent } from '@/ui/resultContent';
import type { ProgressionResult, RunStats } from '@/types';

export interface ResultSceneData {
  stats: RunStats;
  progression: ProgressionResult;
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Result);
  }

  create(data: ResultSceneData): void {
    SafeAreaSystem.showStatic('RUN BEENDET');
    const { stats, progression } = data;
    const world = getWorld(stats.worldId);

    createSceneBackdrop(this, world);
    new ResultView(this, soloResultContent(stats, progression, SaveSystem.load()), world.accent, [
      {
        label: 'NOCHMAL',
        run: () => {
          this.scene.start(SceneKey.Game, { worldId: stats.worldId });
        },
      },
      {
        label: 'ZUM MENUE',
        run: () => {
          this.scene.start(SceneKey.Menu);
        },
      },
    ]);
    ProgressSyncSystem.enqueueRun(stats, progression);
    // Fuer eingeloggte Scores muss das zugehoerige Progress-Event zuerst
    // serverseitig akzeptiert sein; die Bestenliste bleibt dadurch kein
    // unabhaengiger Schreibpfad fuer dieselben Client-Zahlen.
    //
    // Der Bestwert haengt an `finally`, nicht an `then`: Wirft `flush()` - und
    // das kann es, `adoptProfileProgress` laeuft dort ungeschuetzt -, dann
    // uebersprang ein `then` den Upload wortlos, weil `void` die Rejection
    // schluckt. Der Run war gespielt, der Punktestand stand auf dem Schirm,
    // und in der Bestenliste kam nie etwas an.
    void ProgressSyncSystem.flush()
      .catch((error: unknown) => {
        DebugSystem.pushProtectedLogEntry({
          timestamp: Date.now(),
          kind: 'error',
          label: 'run:sync-abbruch',
          detail: error instanceof Error ? error.message : 'Unbekannter Fehler',
        });
      })
      .finally(() => this.submitLeaderboardScore(stats));
    this.uploadSave();
  }

  /**
   * Jeder Solo-Run wird automatisch eingetragen, sofern ein Name vorhanden
   * ist. Ohne Namen oder ohne Backend bleibt der Bildschirm unveraendert.
   * Fehler sind bewusst still: Die Bestenliste ist eine Zugabe, kein Teil des
   * Runs.
   *
   * **Still heisst nicht spurlos.** Jeder Ausstieg schreibt in den geschuetzten
   * Puffer, warum er ausstieg. Am 19.09. fehlte ein Run mit ueber 120000
   * Punkten in der Bestenliste, und der Debug-Report konnte nicht einmal
   * sagen, ob der Upload versucht worden war - drei Diagnoserunden fuer eine
   * Frage, die eine einzige Zeile beantwortet.
   */
  private submitLeaderboardScore(stats: RunStats): void {
    const merke = (detail: string): void => {
      DebugSystem.pushProtectedLogEntry({
        timestamp: Date.now(),
        kind: 'event',
        label: 'run:bestwert',
        detail,
      });
    };

    if (!CloudSystem.isAvailable()) return merke('uebersprungen: kein Online-Dienst');
    if (SaveSystem.isTestProfileActive()) return merke('uebersprungen: Testprofil');
    if (!AuthSystem.isSignedIn()) return merke('uebersprungen: nicht angemeldet');

    const name = CloudSystem.sanitizePlayerName(SaveSystem.load().playerName);
    if (!name) return merke('uebersprungen: kein gueltiger Name');

    // Anonyme Score-Submission bleibt bewusst aus: Ein Gast kann keinen
    // serverseitig akzeptierten Progress-Nachweis fuer die Bestenliste tragen.
    const playerId = AuthSystem.currentUserId();
    if (!playerId) return merke('uebersprungen: keine Konto-Kennung');

    const score = stats.score;
    const combo = stats.bestCombo;
    merke(`gesendet: ${score} Punkte, Kette ${combo}, ${stats.worldId}`);
    void CloudSystem.submitScoreSafely(
      playerId,
      name,
      stats.worldId,
      SaveSystem.load().level,
      score,
      combo,
      stats.durationMs ?? 0,
      stats.collected,
      stats.completedAt ?? new Date().toISOString(),
    ).then((result) => {
      merke(result.ok ? `angenommen: ${score}` : `abgelehnt: ${result.error}`);
    });
  }

  /**
   * Der Run ist bereits lokal gespeichert. Der Cloud-Versuch darf bei
   * schlechtem oder fehlendem Netz weder den Ergebnisbildschirm noch den Run
   * beeinflussen; MenuScene prueft beim naechsten Start erneut.
   */
  private uploadSave(): void {
    if (!CloudSystem.isAvailable() || SaveSystem.isTestProfileActive()) return;
    // Ein namenloser Gast spielt vollständig lokal. Erst ein Name oder ein
    // Login macht einen späteren Cloud-Abgleich sinnvoll.
    if (!AuthSystem.isSignedIn() && !SaveSystem.load().playerName) return;
    void ProgressSyncSystem.flush();
    if (!AuthSystem.isSignedIn()) void CloudSystem.syncSaveSafely();
  }
}
