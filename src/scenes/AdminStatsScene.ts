/** Serverseitig geschützte Nutzungsstatistik im Wartungsbereich. */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as CloudSystem from '@/systems/CloudSystem';
import type { AdminDashboard, AdminUserStats } from '@/systems/CloudSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import {
  createBackButton,
  createButton,
  createDriftLayers,
  createPanel,
  createVignette,
  createWorldBackdrop,
} from '@/ui/widgets';
import { enableVerticalScroll } from '@/ui/verticalScroll';

const PAGE_SIZE = 5;

function formatDuration(milliseconds: number): string {
  const totalMinutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

export class AdminStatsScene extends Phaser.Scene {
  private dashboard: AdminDashboard | null = null;
  private page = 0;
  private content: Phaser.GameObjects.GameObject[] = [];
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKey.AdminStats);
  }

  create(): void {
    SafeAreaSystem.showStatic('ONLINE-STATISTIK');
    const world = getWorld(SaveSystem.load().lastWorldId);
    const backdrop = createWorldBackdrop(
      this,
      GAME_WIDTH,
      GAME_HEIGHT,
      world.bgTop,
      world.bgBottom,
      world.accent,
      world.spaceVariant,
    );
    createDriftLayers(this, GAME_WIDTH, GAME_HEIGHT, world.spaceVariant);
    backdrop.setScrollFactor(0);
    const vignette = createVignette(this, GAME_WIDTH, GAME_HEIGHT).setScrollFactor(0);
    const back = createBackButton(this, () => this.scene.start(SceneKey.Admin));

    const title = this.add
      .text(
        GAME_WIDTH / 2,
        128,
        'ONLINE-STATISTIK',
        textStyle(FontSize.heading, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setLetterSpacing(3);
    const subtitle = this.add
      .text(
        GAME_WIDTH / 2,
        170,
        'Nur für serverseitig freigegebene Wartungsprofile',
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0.5);

    this.statusText = this.add
      .text(
        GAME_WIDTH / 2,
        540,
        'Statistik wird geladen …',
        textStyle(FontSize.small, Palette.inkDim),
      )
      .setOrigin(0.5)
      .setAlign('center')
      .setWordWrapWidth(GAME_WIDTH - 120);

    createButton(
      this,
      GAME_WIDTH / 2,
      1400,
      'AKTUALISIEREN',
      () => {
        void this.loadDashboard();
      },
      { width: 330, height: 62, accent: world.accent, fontSize: FontSize.small },
    );

    void this.loadDashboard();
    enableVerticalScroll(this, 1510, [backdrop, vignette, title, subtitle, back.container]);
  }

  private async loadDashboard(): Promise<void> {
    this.statusText.setText('Statistik wird geladen …').setColor(Palette.inkDim);
    const result = await CloudSystem.fetchAdminDashboard();
    if (!this.scene.isActive()) return;

    if (!result.ok) {
      this.clearContent();
      this.statusText
        .setText(`Kein Zugriff auf die Wartungsstatistik.\n${result.error}`)
        .setColor(Palette.danger);
      return;
    }
    if (!result.value) {
      this.clearContent();
      this.statusText.setText('Die Statistikantwort ist unvollständig.').setColor(Palette.danger);
      return;
    }

    this.dashboard = result.value;
    this.page = 0;
    this.statusText.setText('');
    this.renderDashboard();
  }

  private renderDashboard(): void {
    const dashboard = this.dashboard;
    if (!dashboard) return;
    this.clearContent();

    const world = getWorld(SaveSystem.load().lastWorldId);
    const summary = [
      `PROFILE\n${dashboard.profileCount.toLocaleString('de-DE')}`,
      `GESPIELT\n${dashboard.playedProfileCount.toLocaleString('de-DE')}`,
      `RUNS\n${dashboard.totalRuns.toLocaleString('de-DE')}`,
      `SPIELZEIT\n${formatDuration(dashboard.totalPlayTimeMs)}`,
      `COINS\n${dashboard.totalCoinsEarned.toLocaleString('de-DE')}`,
      `IN TASCHEN\n${dashboard.totalCoinsHeld.toLocaleString('de-DE')} C`,
      `DAILYS\n${dashboard.totalDailyRuns.toLocaleString('de-DE')}`,
      `EP\n${dashboard.totalXp.toLocaleString('de-DE')}`,
      `ERFOLGE\n${dashboard.totalAchievements.toLocaleString('de-DE')}`,
      `BESTWERT\n${dashboard.highestScore.toLocaleString('de-DE')}`,
    ];

    summary.forEach((entry, index) => {
      const column = index % 4;
      const row = Math.floor(index / 4);
      const x = 120 + column * 160;
      const y = 252 + row * 108;
      this.content.push(
        createPanel(this, x, y, 142, 88, world.accent, { alpha: 0.48, radius: 12 }),
        this.add
          .text(
            x,
            y,
            entry,
            textStyle(FontSize.tiny, Palette.ink, { fontStyle: 'bold', align: 'center' }),
          )
          .setOrigin(0.5)
          .setAlign('center')
          .setLineSpacing(5),
      );
    });

    this.content.push(
      this.add
        .text(58, 602, 'PROFILE', textStyle(FontSize.tiny, Palette.gold, { fontStyle: 'bold' }))
        .setOrigin(0, 0.5)
        .setLetterSpacing(3),
    );

    const pageCount = Math.max(1, Math.ceil(dashboard.users.length / PAGE_SIZE));
    this.page = Phaser.Math.Clamp(this.page, 0, pageCount - 1);
    const users = dashboard.users.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE);
    users.forEach((user, index) => this.renderUser(user, 668 + index * 132, world.accent));

    const pageLabel = this.add
      .text(
        GAME_WIDTH / 2,
        1350,
        dashboard.users.length === 0
          ? 'Keine Profile in der Datenbank.'
          : `SEITE ${this.page + 1} / ${pageCount} · ${dashboard.users.length} PROFILE`,
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0.5);
    const previous = createButton(
      this,
      GAME_WIDTH / 2 - 155,
      1350,
      '‹',
      () => {
        this.page -= 1;
        this.renderDashboard();
      },
      { width: 68, height: 54, accent: world.accent, fontSize: FontSize.heading },
    );
    const next = createButton(
      this,
      GAME_WIDTH / 2 + 155,
      1350,
      '›',
      () => {
        this.page += 1;
        this.renderDashboard();
      },
      { width: 68, height: 54, accent: world.accent, fontSize: FontSize.heading },
    );
    previous.setEnabled(this.page > 0);
    next.setEnabled(this.page < pageCount - 1);
    this.content.push(pageLabel, previous.container, next.container);
  }

  private renderUser(user: AdminUserStats, y: number, accent: number): void {
    this.content.push(
      createPanel(this, GAME_WIDTH / 2, y, GAME_WIDTH - 110, 116, accent, {
        alpha: 0.42,
        radius: 12,
      }),
      this.add
        .text(
          74,
          y - 25,
          user.playerName,
          textStyle(FontSize.small, Palette.ink, { fontStyle: 'bold' }),
        )
        .setOrigin(0, 0.5)
        .setWordWrapWidth(265),
      this.add
        .text(
          74,
          y + 6,
          `Level ${user.level} · ${user.totalRuns} Runs · ${formatDuration(user.totalPlayTimeMs)}`,
          textStyle(FontSize.tiny, Palette.inkDim),
        )
        .setOrigin(0, 0.5)
        .setWordWrapWidth(390),
      this.add
        .text(
          GAME_WIDTH - 74,
          y - 22,
          `Verdient ${user.totalCoinsEarned.toLocaleString('de-DE')} C`,
          textStyle(FontSize.small, Palette.gold, { fontStyle: 'bold' }),
        )
        .setOrigin(1, 0.5),
      this.add
        .text(
          GAME_WIDTH - 74,
          y + 4,
          `Tasche ${user.currentCoins.toLocaleString('de-DE')} C · ${user.totalDailyRuns} Dailys`,
          textStyle(FontSize.tiny, toCss(accent)),
        )
        .setOrigin(1, 0.5),
      this.add
        .text(
          GAME_WIDTH - 74,
          y + 30,
          `${user.totalXp.toLocaleString('de-DE')} EP · ${user.achievementCount} Erfolge · Bestwert ${user.bestScore.toLocaleString('de-DE')}`,
          textStyle(FontSize.tiny, Palette.inkDim),
        )
        .setOrigin(1, 0.5),
    );
  }

  private clearContent(): void {
    for (const item of this.content) item.destroy();
    this.content = [];
  }
}
