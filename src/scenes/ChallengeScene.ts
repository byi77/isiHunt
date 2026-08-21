/**
 * Alle Phasen eines Duells, die nicht gespielt werden.
 *
 * Eine Scene fuer drei Zustaende statt drei Scenes: Einfuehrung, Uebergabe und
 * Ergebnis teilen Hintergrund, Panel-Layout und Knopfposition. Getrennte Scenes
 * haetten dasselbe dreimal aufgebaut. Welche Phase gilt, leitet sich aus dem
 * Duell-Zustand ab - die Scene braucht keine Parameter und kann von ueberall
 * mit `scene.start(SceneKey.Challenge)` betreten werden.
 *
 *   Menue --> [Einfuehrung] --> Runde 1 --> [Uebergabe] --> Runde 2 --> [Ergebnis]
 */

import Phaser from 'phaser';

import { CHALLENGE_DURATION_MS } from '@/config/challenge';
import {
  DAILY_COMPLETION_BONUS_COINS,
  DAILY_COMPLETION_BONUS_XP,
  DAILY_SCORE_BONUS_COINS,
  DAILY_SCORE_BONUS_MAX_TIERS,
  DAILY_SCORE_BONUS_XP,
  GAME_HEIGHT,
  GAME_WIDTH,
} from '@/config/GameConfig';
import { getWorld } from '@/config/worlds';
import type { WorldDef } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as ChallengeSystem from '@/systems/ChallengeSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { Depth } from '@/ui/depth';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import {
  createButton,
  createDriftLayers,
  createPanel,
  createVignette,
  createWorldBackdrop,
} from '@/ui/widgets';
import type { ChallengeState } from '@/types';

/** "1 Relikt" statt "1 Relikte" - der Fall tritt bei kurzen Duellen wirklich auf. */
function relics(count: number): string {
  return `${count} ${count === 1 ? 'Relikt' : 'Relikte'}`;
}

export class ChallengeScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Challenge);
  }

  create(): void {
    SafeAreaSystem.showStatic('DUELL');
    const state = ChallengeSystem.getState();

    // Ohne Duell-Zustand gibt es nichts anzuzeigen. Kann nur passieren, wenn
    // die Scene direkt angesprungen wird - dann zurueck ins Menue statt Absturz.
    if (!state) {
      this.scene.start(SceneKey.Menu);
      return;
    }

    const world = getWorld(state.worldId);
    this.buildBackground(world);

    if (ChallengeSystem.isComplete()) {
      this.buildResult(state, world);
    } else if (state.rounds.length === 0) {
      this.buildIntro(state, world);
    } else {
      this.buildHandover(state, world);
    }
  }

  private buildBackground(world: WorldDef): void {
    createWorldBackdrop(
      this,
      GAME_WIDTH,
      GAME_HEIGHT,
      world.bgTop,
      world.bgBottom,
      world.accent,
      world.spaceVariant,
    );
    createDriftLayers(this, GAME_WIDTH, GAME_HEIGHT, world.spaceVariant);
    createVignette(this, GAME_WIDTH, GAME_HEIGHT);
  }

  // --- Phase 1: Einfuehrung ---------------------------------------------------

  private buildIntro(state: ChallengeState, world: WorldDef): void {
    const kind = ChallengeSystem.kind();
    if (kind === 'daily' && state.dailyCompleted) {
      this.buildHeading('TAGESLAUF ERLEDIGT', 'Morgen wartet eine neue Herausforderung auf dich.');
      createPanel(this, GAME_WIDTH / 2, 560, GAME_WIDTH - 120, 260, world.accent);
      this.add
        .text(
          GAME_WIDTH / 2,
          520,
          'Diesen Tageslauf hast du heute bereits gespielt.',
          textStyle(FontSize.body, Palette.ink, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5)
        .setWordWrapWidth(GAME_WIDTH - 180)
        .setAlign('center');
      this.add
        .text(
          GAME_WIDTH / 2,
          610,
          'Ein neuer Lauf und ein neuer Bonus werden morgen freigeschaltet.',
          textStyle(FontSize.small, Palette.inkDim),
        )
        .setOrigin(0.5)
        .setWordWrapWidth(GAME_WIDTH - 180)
        .setAlign('center');
      this.buildBackToMenu('ZURÜCK ZUM MENÜ');
      return;
    }
    const title =
      kind === 'daily' ? 'TAGES-HERAUSFORDERUNG' : kind === 'bot' ? 'BOT-DUELL' : 'DUELL';
    const subtitle =
      kind === 'daily'
        ? 'Jeden Tag ein fester Lauf für alle.'
        : kind === 'bot'
          ? `Du spielst gegen den ${state.botDifficulty ?? 'normalen'} Bot.`
          : 'Spieler 1 gegen Spieler 2';
    this.buildHeading(title, subtitle);

    const seconds = Math.round(CHALLENGE_DURATION_MS / 1000);
    const rules: readonly string[] =
      kind === 'daily'
        ? [
            `Du spielst ${seconds} Sekunden.`,
            'Der Seed ist heute für alle gleich.',
            'Keine Talente - gleiche Voraussetzungen.',
            `Einmal täglich: bis zu ${DAILY_COMPLETION_BONUS_COINS + DAILY_SCORE_BONUS_MAX_TIERS * DAILY_SCORE_BONUS_COINS} Bonus-Coins und ${DAILY_COMPLETION_BONUS_XP + DAILY_SCORE_BONUS_MAX_TIERS * DAILY_SCORE_BONUS_XP} XP.`,
            'Der Lauf zählt zusätzlich als normaler Fortschritt.',
          ]
        : kind === 'bot'
          ? [
              `Du spielst ${seconds} Sekunden.`,
              'Der Bot passt sich an deinen Lauf an.',
              'Keine Talente - gleiche Voraussetzungen.',
              'Das Bot-Duell ändert deinen Spielstand nicht.',
            ]
          : [
              `Jeder spielt ${seconds} Sekunden.`,
              'Beide jagen exakt dieselben Relikte.',
              'Keine Talente - gleiche Voraussetzungen.',
              'Das Duell ändert euren Spielstand nicht.',
            ];

    createPanel(this, GAME_WIDTH / 2, 560, GAME_WIDTH - 120, 260, world.accent);

    rules.forEach((rule, index) => {
      this.add
        .text(100, 470 + index * 52, `·  ${rule}`, textStyle(FontSize.small, Palette.ink))
        .setOrigin(0, 0.5);
    });

    this.add
      .text(
        GAME_WIDTH / 2,
        760,
        `Welt: ${world.name}`,
        textStyle(FontSize.small, toCss(world.accent)),
      )
      .setOrigin(0.5);

    createButton(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 250,
      kind === 'daily'
        ? 'TAGESLAUF STARTEN'
        : kind === 'bot'
          ? 'BOT-DUELL STARTEN'
          : 'SPIELER 1 STARTET',
      () => this.scene.start(SceneKey.Game, { worldId: world.id, mode: kind }),
      { width: 460, accent: world.accent, fontSize: FontSize.large },
    );

    this.buildBackToMenu('ABBRECHEN');
  }

  // --- Phase 2: Uebergabe -----------------------------------------------------

  private buildHandover(state: ChallengeState, world: WorldDef): void {
    const finishedIndex = state.rounds.length - 1;
    const nextIndex = state.rounds.length;
    const finished = state.rounds[finishedIndex];
    if (!finished) return;

    this.buildHeading('GERÄT WEITERGEBEN', `${ChallengeSystem.playerLabel(nextIndex)} ist dran`);

    createPanel(this, GAME_WIDTH / 2, 500, GAME_WIDTH - 120, 230, world.accent);

    this.add
      .text(
        GAME_WIDTH / 2,
        424,
        `${ChallengeSystem.playerLabel(finishedIndex)} hat vorgelegt`,
        textStyle(FontSize.small, Palette.inkDim),
      )
      .setOrigin(0.5);

    const score = this.add
      .text(
        GAME_WIDTH / 2,
        500,
        finished.score.toLocaleString('de-DE'),
        textStyle(FontSize.title, Palette.ink, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setScale(0.4);

    this.tweens.add({ targets: score, scale: 1, duration: 420, ease: 'Back.Out' });

    this.add
      .text(
        GAME_WIDTH / 2,
        566,
        `${relics(finished.totalCollected)}  ·  beste Kette ${finished.bestCombo}`,
        textStyle(FontSize.small, toCss(world.accent)),
      )
      .setOrigin(0.5);

    createButton(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 250,
      `${ChallengeSystem.playerLabel(nextIndex).toUpperCase()} IST BEREIT`,
      () => this.scene.start(SceneKey.Game, { worldId: world.id, mode: 'challenge' }),
      { width: 460, accent: world.accent, fontSize: FontSize.large },
    );

    this.buildBackToMenu('DUELL ABBRECHEN');
  }

  // --- Phase 3: Ergebnis ------------------------------------------------------

  private buildResult(state: ChallengeState, world: WorldDef): void {
    if (ChallengeSystem.kind() === 'daily') {
      const round = state.rounds[0];
      this.buildHeading('TAGESLAUF GESCHAFFT', 'Morgen wartet der nächste Lauf auf dich.');
      if (round) this.buildResultCard(round, 0, world, false);
      this.add
        .text(
          GAME_WIDTH / 2,
          700,
          `TAGESBONUS  +${state.dailyRewardCoins ?? 0} COINS  ·  +${state.dailyRewardXp ?? 0} XP`,
          textStyle(FontSize.body, Palette.gold, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5);
      this.buildResultButtons(world);
      return;
    }

    const winner = ChallengeSystem.winnerIndex();

    this.buildHeading(
      winner === null
        ? 'UNENTSCHIEDEN'
        : `${ChallengeSystem.playerLabel(winner).toUpperCase()} GEWINNT`,
      winner === null ? 'Punktgleich - das muss wiederholt werden.' : 'Gut gejagt.',
    );

    state.rounds.forEach((round, index) => {
      const isWinner = winner === index;
      this.buildResultCard(round, index, world, isWinner);
    });

    // Abstand zwischen den beiden Ergebnissen - die eigentliche Pointe.
    const [first, second] = state.rounds;
    if (first && second) {
      const gap = Math.abs(first.score - second.score);
      this.add
        .text(
          GAME_WIDTH / 2,
          846,
          gap === 0 ? 'Kein Punkt Unterschied.' : `Abstand: ${gap.toLocaleString('de-DE')} Punkte`,
          textStyle(FontSize.small, Palette.inkDim),
        )
        .setOrigin(0.5);
    }

    this.buildResultButtons(world);
  }

  private buildResultCard(
    round: ChallengeState['rounds'][number],
    index: number,
    world: WorldDef,
    isWinner: boolean,
  ): void {
    const y = 470 + index * 190;
    const color = isWinner ? Palette.goldHex : world.accent;
    createPanel(this, GAME_WIDTH / 2, y, GAME_WIDTH - 120, 158, color, {
      alpha: isWinner ? 0.75 : 0.45,
    });
    this.add
      .text(
        104,
        y - 44,
        ChallengeSystem.playerLabel(index),
        textStyle(FontSize.body, isWinner ? Palette.gold : Palette.ink, { fontStyle: 'bold' }),
      )
      .setOrigin(0, 0.5);
    if (isWinner) {
      this.add
        .text(GAME_WIDTH - 104, y - 44, 'SIEG', textStyle(FontSize.tiny, Palette.gold))
        .setOrigin(1, 0.5)
        .setLetterSpacing(4);
    }
    this.add
      .text(
        104,
        y + 18,
        round.score.toLocaleString('de-DE'),
        textStyle(FontSize.heading, Palette.ink, { fontStyle: 'bold' }),
      )
      .setOrigin(0, 0.5);
    this.add
      .text(
        GAME_WIDTH - 104,
        y + 24,
        `${relics(round.totalCollected)}  ·  Kette ${round.bestCombo}`,
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(1, 0.5);
  }

  private buildResultButtons(world: WorldDef): void {
    if (ChallengeSystem.kind() === 'daily') {
      this.buildBackToMenu('ZURÜCK ZUM MENÜ');
      return;
    }
    createButton(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 250,
      'NOCH EINMAL',
      () => {
        ChallengeSystem.rematch();
        this.scene.restart();
      },
      { width: 460, accent: world.accent, fontSize: FontSize.large },
    );
    this.buildBackToMenu('ZUM MENÜ');
  }

  // --- Gemeinsame Bausteine ---------------------------------------------------

  private buildHeading(title: string, subtitle: string): void {
    this.add
      .text(
        GAME_WIDTH / 2,
        150,
        title,
        textStyle(FontSize.heading, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setLetterSpacing(3)
      .setDepth(Depth.Overlay);

    // Der Untertitel erklaert den naechsten Schritt (wer spielt, was ist
    // erledigt) - keine Dekoration, deshalb heller Standardton.
    this.add
      .text(GAME_WIDTH / 2, 212, subtitle, textStyle(FontSize.small, Palette.ink))
      .setOrigin(0.5)
      .setWordWrapWidth(GAME_WIDTH - 140)
      .setAlign('center')
      .setDepth(Depth.Overlay);
  }

  private buildBackToMenu(label: string): void {
    createButton(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 140,
      label,
      () => {
        ChallengeSystem.clear();
        this.scene.start(SceneKey.Menu);
      },
      { width: 300, height: 72, accent: 0x9aa3bd, fontSize: FontSize.small },
    );
  }
}
