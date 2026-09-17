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
    void ProgressSyncSystem.flush().then(() => this.submitLeaderboardScore(stats));
    this.uploadSave();
  }

  /**
   * Jeder Solo-Run wird automatisch eingetragen, sofern ein Name vorhanden
   * ist. Ohne Namen oder ohne Backend bleibt der Bildschirm unveraendert.
   * Fehler sind bewusst still: Die Bestenliste ist eine Zugabe, kein Teil des
   * Runs.
   */
  private submitLeaderboardScore(stats: RunStats): void {
    if (
      !CloudSystem.isAvailable() ||
      SaveSystem.isTestProfileActive() ||
      !AuthSystem.isSignedIn()
    ) {
      return;
    }

    const name = CloudSystem.sanitizePlayerName(SaveSystem.load().playerName);
    if (!name) return;

    // Anonyme Score-Submission bleibt bewusst aus: Ein Gast kann keinen
    // serverseitig akzeptierten Progress-Nachweis fuer die Bestenliste tragen.
    const playerId = AuthSystem.currentUserId();
    if (!playerId) return;
    void CloudSystem.submitScoreSafely(
      playerId,
      name,
      stats.worldId,
      SaveSystem.load().level,
      stats.score,
      stats.bestCombo,
      stats.durationMs ?? 0,
      stats.collected,
      stats.completedAt ?? new Date().toISOString(),
    );
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
