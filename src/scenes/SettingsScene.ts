/**
 * Einstellungen für Dinge, die nicht in den schnellen Spielstart gehören.
 *
 * Die Sprache bleibt bewusst kindgerecht: Die technische Funktion "Sync-Code"
 * heisst hier "Profil auf anderes Gerät". Der eigentliche Vergleich beider
 * Spielstaende bleibt im bestehenden Sync-Bildschirm erhalten.
 */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as AuthSystem from '@/systems/AuthSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import * as SoundSystem from '@/systems/SoundSystem';
import { FontSize, Palette, textStyle } from '@/ui/theme';
import {
  createBackButton,
  createButton,
  createDriftLayers,
  createPanel,
  createMenuLayout,
  createVignette,
  createWorldBackdrop,
  PAGE_CONTENT_TOP,
} from '@/ui/widgets';

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Settings);
  }

  create(): void {
    SafeAreaSystem.showStatic('EINSTELLUNGEN');
    const world = getWorld(SaveSystem.load().lastWorldId);

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
    createBackButton(this, () => this.scene.start(SceneKey.Menu));

    // Karten bewegen sich gemeinsam; Kopfzeile und Zurueck-Zone bleiben
    // ausserhalb dieses Containers fest am Bildschirm stehen.
    const content = this.add.container(0, 0);
    const addContent = (object: Phaser.GameObjects.GameObject): void => {
      content.add(object);
    };

    // Karten immer direkt unter dem letzten Abschnitt anfügen. Der Helfer
    // hält den kleinen Abstand zwischen Profil, Ton und Impressum konstant.
    // Die Scroll-Kopfzeile liegt außerhalb des Canvas. 36 px reichen als
    // Luft darunter; ein größerer Startwert erzeugt sichtbar unnötigen Raum.
    const layout = createMenuLayout();
    const sections = layout.sections;
    const profileY = sections.next(330);
    const soundY = sections.next(180);
    const legalY = sections.next(350);

    addContent(
      createPanel(this, GAME_WIDTH / 2, profileY, GAME_WIDTH - 120, 330, world.accent, {
        alpha: 0.58,
        radius: 20,
      }),
    );

    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          profileY - 115,
          'PROFIL & GERÄTE',
          textStyle(FontSize.body, Palette.gold),
        )
        .setOrigin(0.5)
        .setLetterSpacing(2),
    );

    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          profileY - 50,
          'Melde dich auf iPhone und iPad mit demselben Profil an.\nDein Fortschritt wird sicher in deinem Online-Profil gespeichert.',
          textStyle(FontSize.small, Palette.ink),
        )
        .setOrigin(0.5)
        .setAlign('center'),
    );

    const accountButton = createButton(
      this,
      GAME_WIDTH / 2,
      profileY + 75,
      AuthSystem.isSignedIn() ? 'PROFIL ÖFFNEN' : 'ANMELDEN / PROFIL ANLEGEN',
      () => this.scene.start(SceneKey.Account),
      { width: 460, height: 76, accent: world.accent, fontSize: FontSize.small },
    );
    addContent(accountButton.container);

    if (!AuthSystem.isConfigured()) {
      accountButton.setEnabled(false);
      addContent(
        this.add
          .text(
            GAME_WIDTH / 2,
            profileY + 140,
            'Das Online-Profil ist gerade nicht verfügbar.',
            textStyle(FontSize.tiny, Palette.inkDim),
          )
          .setOrigin(0.5)
          .setAlign('center'),
      );
    }

    addContent(
      createPanel(this, GAME_WIDTH / 2, soundY, GAME_WIDTH - 120, 180, world.accent, {
        alpha: 0.5,
        radius: 20,
      }),
    );

    addContent(
      this.add
        .text(GAME_WIDTH / 2, soundY - 60, 'TON', textStyle(FontSize.body, Palette.gold))
        .setOrigin(0.5)
        .setLetterSpacing(3),
    );

    const soundButton = createButton(
      this,
      GAME_WIDTH / 2,
      soundY + 10,
      SoundSystem.isEnabled() ? 'TON: AN' : 'TON: AUS',
      () => {
        const enabled = !SoundSystem.isEnabled();
        SoundSystem.setEnabled(enabled);
        soundButton.setLabel(enabled ? 'TON: AN' : 'TON: AUS');
      },
      { width: 360, height: 70, accent: world.accent, fontSize: FontSize.body },
    );
    addContent(soundButton.container);
    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          soundY + 55,
          'LAUTSTÄRKE: IPHONE-TASTEN',
          textStyle(FontSize.tiny, Palette.inkDim),
        )
        .setOrigin(0.5)
        .setLetterSpacing(2),
    );

    addContent(
      createPanel(this, GAME_WIDTH / 2, legalY, GAME_WIDTH - 120, 350, world.accent, {
        alpha: 0.5,
        radius: 20,
      }),
    );

    addContent(
      this.add
        .text(GAME_WIDTH / 2, legalY - 125, 'IMPRESSUM', textStyle(FontSize.body, Palette.gold))
        .setOrigin(0.5)
        .setLetterSpacing(3),
    );

    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          legalY - 70,
          'PROGRAMMIERT VON  YAVUZ ISIK',
          textStyle(FontSize.small, Palette.ink, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5),
    );

    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          legalY + 45,
          'BESONDERER DANK AN EMRE UND SIMAY\n' +
            'Für eure aussergewöhnliche Unterstützung bei der Planung,\n' +
            'mit Vorschlägen und Ideen, beim Testen und Bugfixen.\n' +
            'Eure Neugier und ehrlichen Rückmeldungen machen isiHunt\n' +
            'mutiger, schöner und immer ein bisschen besser.',
          textStyle(FontSize.small, Palette.inkDim, { lineSpacing: 3 }),
        )
        .setOrigin(0.5)
        .setAlign('center'),
    );

    const contentBottom = legalY + 350;
    const maxScroll = Math.max(0, contentBottom - layout.contentBottom);
    let scrollOffset = 0;
    let activePointerId: number | null = null;
    let pointerStartY = 0;
    let scrollStart = 0;

    const setScrollOffset = (value: number): void => {
      scrollOffset = Phaser.Math.Clamp(value, 0, maxScroll);
      content.y = -scrollOffset;
    };

    const onPointerDown = (pointer: Phaser.Input.Pointer): void => {
      if (maxScroll <= 0 || activePointerId !== null) return;
      if (pointer.y < PAGE_CONTENT_TOP || pointer.y > layout.contentBottom) return;
      activePointerId = pointer.id;
      pointerStartY = pointer.y;
      scrollStart = scrollOffset;
    };

    const onPointerMove = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.id !== activePointerId) return;
      setScrollOffset(scrollStart - (pointer.y - pointerStartY));
    };

    const releasePointer = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.id === activePointerId) activePointerId = null;
    };

    const onWheel = (
      _pointer: Phaser.Input.Pointer,
      _gameObjects: Phaser.GameObjects.GameObject[],
      _deltaX: number,
      deltaY: number,
    ): void => {
      if (maxScroll > 0) setScrollOffset(scrollOffset + deltaY);
    };

    this.input.on('pointerdown', onPointerDown);
    this.input.on('pointermove', onPointerMove);
    this.input.on('pointerup', releasePointer);
    this.input.on('pointerupoutside', releasePointer);
    this.input.on('wheel', onWheel);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', onPointerDown);
      this.input.off('pointermove', onPointerMove);
      this.input.off('pointerup', releasePointer);
      this.input.off('pointerupoutside', releasePointer);
      this.input.off('wheel', onWheel);
    });

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 180,
        'Dein Spielstand wird automatisch lokal gespeichert.',
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0.5);
  }
}
