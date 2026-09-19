import type Phaser from 'phaser';
import { eventBus, GameEvent } from '@/core/EventBus';
import { SceneKey } from '@/scenes/SceneKey';
import { installLayoutAudit } from './layoutAudit';
import { GameBackdrop } from './GameBackdrop';
import { getWorld } from '@/config/worlds';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config/GameConfig';

/** Explicit development-only visual fixture: no GameScene, saves or network. */
export function installHudPreview(scene: Phaser.Scene, worldId: string, duel: boolean): void {
  if (new URLSearchParams(window.location.search).has('playfieldPreview')) {
    scene.children.removeAll(true);
    scene.tweens.killAll();
    const backdrop = new GameBackdrop(scene, GAME_WIDTH, GAME_HEIGHT, getWorld(worldId));
    const update = (_time: number, delta: number) =>
      backdrop.update(delta, scene.input.activePointer.x, scene.input.activePointer.y);
    scene.events.on('update', update);
    scene.events.once('shutdown', () => {
      scene.events.off('update', update);
      backdrop.destroy();
    });
  }
  installLayoutAudit(scene.game);
  if (new URLSearchParams(window.location.search).has('collectionPreview')) {
    void import('./collectionPreview').then(({ installCollectionPreview }) => {
      if (scene.scene.isActive()) installCollectionPreview(scene);
    });
  }
  scene.scene.launch(SceneKey.Hud, {
    worldId,
    durationMs: 90000,
    mode: duel ? 'challenge' : 'solo',
    showOpponentLive: duel,
    playerCount: 4,
    localPlayerIndex: 1,
    opponentLabels: ['AlexandertheGreat123456789', 'Du', 'Mira', 'Lichtjägerin'],
    talentSummary: duel
      ? ''
      : 'AKTIV · REICH R5 +24 · TEMPO R5 +18% · MAGNET R5 +35 · AUSDAUER R5 +10s · FOKUS R5 +100ms · SPÜRSINN R5 +12% · XP R5 +20% · PUNKTE R5 +20% · RESONANZ R5 +0,25x · SCHUTZFELD R5 -20%',
  });
  const controls = document.createElement('div');
  Object.assign(controls.style, { position: 'fixed', left: '0', bottom: '0', zIndex: '10000' });
  const sample = document.createElement('button');
  sample.textContent = 'HUD-Testwerte';
  sample.onclick = () => {
    eventBus.emitEvent(GameEvent.ScoreChanged, { score: 123456789 });
    eventBus.emitEvent(GameEvent.ComboChanged, { combo: 999, multiplier: 12.5, speedFactor: 1.18 });
    eventBus.emitEvent(GameEvent.TimerChanged, { remainingMs: 9000, totalMs: 90000 });
    for (const [playerIndex, activity] of [
      [0, 'playing'],
      [2, 'away'],
      [3, 'gone'],
    ] as const) {
      eventBus.emitEvent(GameEvent.OpponentLiveState, { playerIndex, activity, score: 98765432 });
    }
  };
  controls.append(sample);
  document.body.append(controls);
  let paused = false;
  const resumed = () => {
    paused = false;
  };
  const pause = () => {
    paused = !paused;
    if (paused) eventBus.emitEvent(GameEvent.RunPaused, { reason: 'manual' });
    else eventBus.emitEvent(GameEvent.RunResumed, undefined);
  };
  eventBus.onEvent(GameEvent.PauseRequested, pause);
  eventBus.onEvent(GameEvent.RunResumed, resumed);
  scene.events.once('shutdown', () => {
    controls.remove();
    eventBus.offEvent(GameEvent.PauseRequested, pause);
    eventBus.offEvent(GameEvent.RunResumed, resumed);
    scene.scene.stop(SceneKey.Hud);
  });
}
