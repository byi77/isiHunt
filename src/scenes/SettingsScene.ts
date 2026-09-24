/**
 * Einstellungen für Dinge, die nicht in den schnellen Spielstart gehören.
 *
 * Die Sprache bleibt bewusst kindgerecht: Die technische Funktion "Sync-Code"
 * heisst hier "Profil auf anderes Gerät". Der eigentliche Vergleich beider
 * Spielstaende bleibt im bestehenden Sync-Bildschirm erhalten.
 */

import Phaser from 'phaser';

import { GAME_WIDTH } from '@/config/GameConfig';
import { getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import * as SoundSystem from '@/systems/SoundSystem';
import * as HapticsSystem from '@/systems/HapticsSystem';
import * as EffectsQualitySystem from '@/systems/EffectsQualitySystem';
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
    // Vermessene Innenränder: Alle Texte bleiben mindestens 42 px von der
    // Kartenkante und mindestens 14 px von einer Buttonkante entfernt.
    const profileY = sections.next(350);
    const soundY = sections.next(350);
    const graphicsY = sections.next(230);
    const legalY = sections.next(430);

    addContent(
      createPanel(this, GAME_WIDTH / 2, profileY, GAME_WIDTH - 120, 350, world.accent, {
        alpha: 0.58,
        radius: 20,
      }),
    );

    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          profileY - 135,
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
          profileY - 76,
          'Name, Level, Statistik und Mehrgeräte-Anmeldung an einem Ort.',
          textStyle(FontSize.small, Palette.ink),
        )
        .setOrigin(0.5)
        .setAlign('center')
        .setWordWrapWidth(GAME_WIDTH - 240),
    );

    // Fuehrt unabhaengig vom Login-Status zum selben Ziel wie der
    // Hauptmenue-Knopf "PROFIL" (2026-08-18 zusammengefuehrt) - ProfileScene
    // zeigt bei Bedarf selbst den Anmelden-Weg.
    addContent(
      createButton(
        this,
        GAME_WIDTH / 2,
        profileY + 85,
        'PROFIL ÖFFNEN',
        () => this.scene.start(SceneKey.Profile),
        { width: 460, height: 76, accent: world.accent, fontSize: FontSize.small },
      ).container,
    );

    addContent(
      createPanel(this, GAME_WIDTH / 2, soundY, GAME_WIDTH - 120, 350, world.accent, {
        alpha: 0.5,
        radius: 20,
      }),
    );

    addContent(
      this.add
        .text(GAME_WIDTH / 2, soundY - 135, 'FEEDBACK', textStyle(FontSize.body, Palette.gold))
        .setOrigin(0.5)
        .setLetterSpacing(3),
    );

    const soundButton = createButton(
      this,
      GAME_WIDTH / 2,
      soundY - 55,
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
          soundY - 2,
          'Spieltöne und Effekte',
          textStyle(FontSize.tiny, Palette.inkDim),
        )
        .setOrigin(0.5)
        .setLetterSpacing(2),
    );

    const hapticsButton = createButton(
      this,
      GAME_WIDTH / 2,
      soundY + 72,
      HapticsSystem.isEnabled() ? 'HAPTIK: AN' : 'HAPTIK: AUS',
      () => {
        const enabled = !HapticsSystem.isEnabled();
        HapticsSystem.setEnabled(enabled);
        SoundSystem.playUiToggle(enabled);
        hapticsButton.setLabel(enabled ? 'HAPTIK: AN' : 'HAPTIK: AUS');
      },
      { width: 360, height: 64, accent: world.accent, fontSize: FontSize.body, sound: 'none' },
    );
    addContent(hapticsButton.container);
    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          soundY + 125,
          'Vibration bei Treffern und Aktionen',
          textStyle(FontSize.tiny, Palette.inkDim),
        )
        .setOrigin(0.5)
        .setLetterSpacing(2),
    );

    addContent(
      createPanel(this, GAME_WIDTH / 2, graphicsY, GAME_WIDTH - 120, 230, world.accent, {
        alpha: 0.5,
        radius: 20,
      }),
    );

    addContent(
      this.add
        .text(GAME_WIDTH / 2, graphicsY - 75, 'GRAFIK', textStyle(FontSize.body, Palette.gold))
        .setOrigin(0.5)
        .setLetterSpacing(3),
    );

    const effectsLabel = (): string =>
      EffectsQualitySystem.isFull() ? 'EFFEKTE: VOLL' : 'EFFEKTE: SPARSAM';
    const effectsButton = createButton(
      this,
      GAME_WIDTH / 2,
      graphicsY + 5,
      effectsLabel(),
      () => {
        EffectsQualitySystem.setQuality(EffectsQualitySystem.isFull() ? 'reduced' : 'full');
        SoundSystem.playUiToggle(EffectsQualitySystem.isFull());
        effectsButton.setLabel(effectsLabel());
      },
      { width: 360, height: 64, accent: world.accent, fontSize: FontSize.body, sound: 'none' },
    );
    addContent(effectsButton.container);
    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          graphicsY + 62,
          'Sparsam schont schwache Geräte',
          textStyle(FontSize.tiny, Palette.inkDim),
        )
        .setOrigin(0.5)
        .setLetterSpacing(2),
    );

    addContent(
      createPanel(this, GAME_WIDTH / 2, legalY, GAME_WIDTH - 120, 430, world.accent, {
        alpha: 0.5,
        radius: 20,
      }),
    );

    addContent(
      this.add
        .text(GAME_WIDTH / 2, legalY - 165, 'IMPRESSUM', textStyle(FontSize.body, Palette.gold))
        .setOrigin(0.5)
        .setLetterSpacing(3),
    );

    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          legalY - 105,
          'PROGRAMMIERT VON  YAVUZ ISIK',
          textStyle(FontSize.small, Palette.ink, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5),
    );

    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          legalY + 15,
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

    const contentBottom = legalY + 215;
    const maxScroll = Math.max(0, contentBottom - layout.contentBottom);
    attachVerticalScroll(this, {
      maxScroll,
      dragZoneTop: PAGE_CONTENT_TOP,
      dragZoneBottom: layout.contentBottom,
      onOffsetChange: (offset) => {
        content.y = -offset;
      },
    });

    // Der Hinweis gehoert in die Impressumskarte. Als feste Textzeile bei
    // GAME_HEIGHT - 180 lag er direkt ueber der scrollbaren Ueberschrift
    // "IMPRESSUM" und kollidierte beim ersten Seitenaufbau mit ihr.
    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          legalY + 126,
          'Dein Spielstand wird automatisch lokal gespeichert.',
          textStyle(FontSize.tiny, Palette.inkDim),
        )
        .setOrigin(0.5),
    );
  }
}
