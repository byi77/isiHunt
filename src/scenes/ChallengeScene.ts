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

import {
  CHALLENGE_DURATION_MS,
  DUEL_TALENT_DRAFT_DURATION_MS,
  DUEL_TALENT_POINT_BUDGET,
} from '@/config/challenge';
import {
  BOT_VICTORY_BONUS_COINS,
  BOT_VICTORY_BONUS_XP,
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
import * as AuthSystem from '@/systems/AuthSystem';
import * as ChallengeSystem from '@/systems/ChallengeSystem';
import * as CloudSystem from '@/systems/CloudSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { Depth } from '@/ui/depth';
import { createTalentDraftView, type TalentDraftView } from '@/ui/talentDraft';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import { createButton, createPanel, createSceneBackdrop } from '@/ui/widgets';
import type { ChallengeState } from '@/types';

/** "1 Relikt" statt "1 Relikte" - der Fall tritt bei kurzen Duellen wirklich auf. */
function relics(count: number): string {
  return `${count} ${count === 1 ? 'Relikt' : 'Relikte'}`;
}

function usesTalentDraft(kind: string): boolean {
  return kind === 'duel' || kind === 'bot';
}

export class ChallengeScene extends Phaser.Scene {
  private talentDraftView: TalentDraftView | null = null;
  private talentDraftTimer: Phaser.Time.TimerEvent | null = null;
  private talentDraftDeadline = 0;

  constructor() {
    super(SceneKey.Challenge);
  }

  create(): void {
    SafeAreaSystem.showStatic('DUELL');
    this.talentDraftView = null;
    this.talentDraftTimer = null;
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
    createSceneBackdrop(this, world);
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
          ? 'Du spielst gegen einen mittelstarken Bot.'
          : `${state.playerCount ?? 2} Spieler spielen um den hoechsten Score.`;
    this.buildHeading(title, subtitle);

    const needsDraft = usesTalentDraft(kind);
    if (needsDraft) {
      this.buildTalentDraft(world, kind as 'duel' | 'bot', 420, 286);
      return;
    }

    const seconds = Math.round(CHALLENGE_DURATION_MS / 1000);
    const rules: readonly string[] =
      kind === 'daily'
        ? [
            `Du spielst mindestens ${seconds} Sekunden.`,
            'Der Seed ist heute für alle gleich.',
            'Deine gekauften Talente und ihre Wirkungen sind aktiv.',
            `Einmal täglich: bis zu ${DAILY_COMPLETION_BONUS_COINS + DAILY_SCORE_BONUS_MAX_TIERS * DAILY_SCORE_BONUS_COINS} Bonus-Coins und ${DAILY_COMPLETION_BONUS_XP + DAILY_SCORE_BONUS_MAX_TIERS * DAILY_SCORE_BONUS_XP} XP.`,
            'Der Lauf zählt zusätzlich als normaler Fortschritt.',
          ]
        : kind === 'bot'
          ? [
              `Du spielst ${seconds} Sekunden.`,
              'Der Bot passt sich an deinen Lauf an.',
              'Temporärer Build mit gleichem Punktebudget.',
              'Das Bot-Duell ändert deinen Spielstand nicht.',
            ]
          : [
              `Jeder spielt ${seconds} Sekunden.`,
              'Beide jagen exakt dieselben Relikte.',
              'Temporärer Build mit gleichem Punktebudget.',
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

  /**
   * Temporäre Duell-Talente vor jedem lokalen Durchgang.
   *
   * Der Vorschlag kommt aus dem vorherigen Duell/Rematch. Die Änderungen
   * bleiben ausschließlich im ChallengeSystem und berühren den persistenten
   * Talentbaum deshalb nicht.
   */
  private buildTalentDraft(
    world: WorldDef,
    kind: 'duel' | 'bot',
    topY: number,
    infoY?: number,
  ): void {
    const playerIndex = kind === 'bot' ? 0 : ChallengeSystem.currentPlayerIndex();
    const initialRanks = ChallengeSystem.duelTalentDraftFor(playerIndex);
    const hasSuggestion = Object.values(initialRanks).some((rank) => rank > 0);
    if (infoY !== undefined) {
      this.add
        .text(
          GAME_WIDTH / 2,
          infoY,
          kind === 'bot'
            ? `Mittelstarker Bot: Halte deine Serie aktiv. Siegbonus: +${BOT_VICTORY_BONUS_COINS} Coins und +${BOT_VICTORY_BONUS_XP} XP.`
            : hasSuggestion
              ? 'Dein Build aus dem letzten Duell ist vorgeschlagen. Ändere ihn mit + und −.'
              : `Verteile ${DUEL_TALENT_POINT_BUDGET} Punkte mit + und −.`,
          textStyle(FontSize.small, Palette.ink),
        )
        .setOrigin(0.5)
        .setWordWrapWidth(GAME_WIDTH - 100)
        .setAlign('center');
    }

    this.talentDraftView = createTalentDraftView(this, {
      initialRanks,
      accent: world.accent,
      topY,
      onChange: (ranks) => {
        ChallengeSystem.setDuelTalentDraft(playerIndex, ranks);
      },
    });

    const timerText = this.add
      .text(GAME_WIDTH / 2, topY + 320, '', textStyle(FontSize.small, Palette.gold))
      .setOrigin(0.5);

    const start = (): void => {
      if (!this.scene.isActive()) return;
      if (this.talentDraftTimer) {
        this.talentDraftTimer.remove();
        this.talentDraftTimer = null;
      }
      this.talentDraftView?.setEnabled(false);
      this.scene.start(SceneKey.Game, {
        worldId: world.id,
        mode: kind === 'bot' ? 'bot' : 'challenge',
      });
    };

    const updateTimer = (): void => {
      const remaining = Math.max(0, this.talentDraftDeadline - Date.now());
      const remainingSeconds = Math.ceil(remaining / 1000);
      timerText.setText(
        remaining > 0
          ? `${remainingSeconds} Sekunden zur Talentvergabe`
          : 'Talentvergabe beendet - Duell startet ...',
      );
      if (remaining <= 0) start();
    };

    this.talentDraftDeadline = Date.now() + DUEL_TALENT_DRAFT_DURATION_MS;
    updateTimer();
    this.talentDraftTimer = this.time.addEvent({ delay: 250, loop: true, callback: updateTimer });

    createButton(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 250,
      hasSuggestion ? 'VORSCHLAG ÜBERNEHMEN' : 'TALENTE BESTÄTIGEN',
      start,
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

    createPanel(this, GAME_WIDTH / 2, 465, GAME_WIDTH - 120, 180, world.accent);

    this.add
      .text(
        GAME_WIDTH / 2,
        400,
        `${ChallengeSystem.playerLabel(finishedIndex)} hat vorgelegt`,
        textStyle(FontSize.small, Palette.inkDim),
      )
      .setOrigin(0.5);

    const score = this.add
      .text(
        GAME_WIDTH / 2,
        465,
        finished.score.toLocaleString('de-DE'),
        textStyle(FontSize.title, Palette.ink, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setScale(0.4);

    this.tweens.add({ targets: score, scale: 1, duration: 420, ease: 'Back.Out' });

    this.add
      .text(
        GAME_WIDTH / 2,
        525,
        `${relics(finished.totalCollected)}  ·  beste Kette ${finished.bestCombo}`,
        textStyle(FontSize.small, toCss(world.accent)),
      )
      .setOrigin(0.5);

    // Die Uebergabe-Karte erklaert den naechsten Schritt bereits in der
    // Kopfzeile. Eine zusaetzliche Infobox haette zwischen Ergebniszeile,
    // Zusammenfassung und Talentkarten keinen sicheren Abstand.
    this.buildTalentDraft(world, 'duel', 630);
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

    const playerCount = state.playerCount ?? 2;
    const compactCards = playerCount > 2;
    const firstCardY = compactCards ? 400 : 470;
    const cardHeight = compactCards ? 122 : 158;
    const cardStep = compactCards ? 150 : 190;

    state.rounds.forEach((round, index) => {
      const isWinner = winner === index;
      this.buildResultCard(
        round,
        index,
        world,
        isWinner,
        firstCardY + index * cardStep,
        cardHeight,
      );
    });

    // Der Abstand bleibt auch bei drei oder vier Spielern sichtbar.
    const scores = state.rounds.map((round) => round.score);
    if (scores.length > 1) {
      const gap = Math.max(...scores) - Math.min(...scores);
      const infoY = compactCards
        ? firstCardY + (state.rounds.length - 1) * cardStep + cardHeight / 2 + 28
        : 846;
      this.add
        .text(
          GAME_WIDTH / 2,
          infoY,
          state.botVictoryReward
            ? `BOT BESIEGT  +${state.botVictoryReward.coins} COINS  |  +${state.botVictoryReward.xp} XP`
            : gap === 0
              ? 'Kein Punkt Unterschied.'
              : `Abstand: ${gap.toLocaleString('de-DE')} Punkte`,
          textStyle(
            FontSize.small,
            state.botVictoryReward ? Palette.gold : Palette.inkDim,
            state.botVictoryReward ? { fontStyle: 'bold' } : undefined,
          ),
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
    y = 470 + index * 190,
    height = 158,
  ): void {
    const color = isWinner ? Palette.goldHex : world.accent;
    createPanel(this, GAME_WIDTH / 2, y, GAME_WIDTH - 120, height, color, {
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
      'REMATCH',
      () => void this.startRematch(),
      { width: 460, accent: world.accent, fontSize: FontSize.large },
    );
    this.buildBackToMenu('ZUM MENÜ');
  }

  private async startRematch(): Promise<void> {
    const current = ChallengeSystem.getState();
    if (!current) return;
    let botMatchId: string | undefined;
    if (current.kind === 'bot' && AuthSystem.isSignedIn()) {
      const started = await CloudSystem.startBotMatch();
      if (started.ok) botMatchId = started.value;
    }
    if (!this.scene.isActive()) return;
    if (current.kind === 'bot') {
      ChallengeSystem.startBot(
        current.worldId,
        current.botDifficulty,
        current.duelTalentDrafts,
        botMatchId,
      );
    } else {
      ChallengeSystem.rematch();
    }
    this.scene.restart();
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
