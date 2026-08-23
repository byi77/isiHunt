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
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import * as SoundSystem from '@/systems/SoundSystem';
import * as HapticsSystem from '@/systems/HapticsSystem';
import { FontSize, Palette, textStyle } from '@/ui/theme';
import {
  attachVerticalScroll,
  createBackButton,
  createButton,
  createMenuLayout,
  createPanel,
  createSceneBackdrop,
  PAGE_CONTENT_TOP,
} from '@/ui/widgets';

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Settings);
  }

  create(): void {
    SafeAreaSystem.showStatic('EINSTELLUNGEN');
    const world = getWorld(SaveSystem.load().lastWorldId);

    createSceneBackdrop(this, world);
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
    const soundY = sections.next(300);
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
          'Name, Level, Statistik und Mehrgeräte-Anmeldung an einem Ort.',
          textStyle(FontSize.small, Palette.ink),
        )
        .setOrigin(0.5)
        .setAlign('center'),
    );

    // Fuehrt unabhaengig vom Login-Status zum selben Ziel wie der
    // Hauptmenue-Knopf "PROFIL" (2026-08-18 zusammengefuehrt) - ProfileScene
    // zeigt bei Bedarf selbst den Anmelden-Weg.
    addContent(
      createButton(
        this,
        GAME_WIDTH / 2,
        profileY + 75,
        'PROFIL ÖFFNEN',
        () => this.scene.start(SceneKey.Profile),
        { width: 460, height: 76, accent: world.accent, fontSize: FontSize.small },
      ).container,
    );

    addContent(
      createPanel(this, GAME_WIDTH / 2, soundY, GAME_WIDTH - 120, 300, world.accent, {
        alpha: 0.5,
        radius: 20,
      }),
    );

    addContent(
      this.add
        .text(GAME_WIDTH / 2, soundY - 118, 'FEEDBACK', textStyle(FontSize.body, Palette.gold))
        .setOrigin(0.5)
        .setLetterSpacing(3),
    );

    const soundButton = createButton(
      this,
      GAME_WIDTH / 2,
      soundY - 35,
      SoundSystem.isEnabled() ? 'TON: AN' : 'TON: AUS',
      () => {
        const enabled = !SoundSystem.isEnabled();
        SoundSystem.setEnabled(enabled);
        soundButton.setLabel(enabled ? 'TON: AN' : 'TON: AUS');
      },
      { width: 360, height: 64, accent: world.accent, fontSize: FontSize.body },
    );
    addContent(soundButton.container);
    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          soundY + 5,
          'LAUTSTÄRKE: IPHONE-TASTEN',
          textStyle(FontSize.tiny, Palette.inkDim),
        )
        .setOrigin(0.5)
        .setLetterSpacing(2),
    );

    const hapticsButton = createButton(
      this,
      GAME_WIDTH / 2,
      soundY + 62,
      HapticsSystem.isEnabled() ? 'HAPTIK: AN' : 'HAPTIK: AUS',
      () => {
        const enabled = !HapticsSystem.isEnabled();
        HapticsSystem.setEnabled(enabled);
        hapticsButton.setLabel(enabled ? 'HAPTIK: AN' : 'HAPTIK: AUS');
      },
      { width: 360, height: 64, accent: world.accent, fontSize: FontSize.body },
    );
    addContent(hapticsButton.container);
    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          soundY + 105,
          'VIBRATION: GERAETEHAPTIK',
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
    attachVerticalScroll(this, {
      maxScroll,
      dragZoneTop: PAGE_CONTENT_TOP,
      dragZoneBottom: layout.contentBottom,
      onOffsetChange: (offset) => {
        content.y = -offset;
      },
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
