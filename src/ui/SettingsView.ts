import type Phaser from 'phaser';
import * as SoundSystem from '@/systems/SoundSystem';
import * as HapticsSystem from '@/systems/HapticsSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import * as EffectsQualitySystem from '@/systems/EffectsQualitySystem';
import type { EffectsQuality } from '@/types';
import './settings.css';

export class SettingsView {
  private readonly root = document.createElement('div');
  private readonly observer: ResizeObserver;
  constructor(
    private readonly scene: Phaser.Scene,
    accent: number,
    openProfile: () => void,
    back: () => void,
  ) {
    this.root.className = 'isihunt-settings isihunt-interface';
    this.root.style.setProperty('--accent', `#${accent.toString(16).padStart(6, '0')}`);
    this.root.innerHTML = '<main aria-label="Einstellungen"></main><footer></footer>';
    const main = this.root.querySelector('main')!;
    const card = (title: string): HTMLElement => {
      const section = document.createElement('section');
      const heading = document.createElement('h2');
      heading.textContent = title;
      section.append(heading);
      main.append(section);
      return section;
    };
    const text = (parent: HTMLElement, value: string, hint = false): HTMLParagraphElement => {
      const paragraph = document.createElement('p');
      paragraph.textContent = value;
      if (hint) paragraph.className = 'hint';
      parent.append(paragraph);
      return paragraph;
    };
    const button = (
      parent: HTMLElement,
      label: string,
      click: (button: HTMLButtonElement) => void,
    ): HTMLButtonElement => {
      const element = document.createElement('button');
      element.type = 'button';
      element.textContent = label;
      element.onclick = () => click(element);
      parent.append(element);
      return element;
    };
    /**
     * Ein Schalter je An/Aus-Einstellung statt eines Knopfes "TON: AUS".
     * Der Knopf sah in beiden Zustaenden gleich aus; nur der Text verriet den
     * Zustand (Design-Review 28.10.2026, HIG toggles.md).
     */
    const toggle = (
      parent: HTMLElement,
      label: string,
      hint: string,
      isOn: () => boolean,
      flip: () => void,
    ): void => {
      const row = button(parent, '', (element) => {
        flip();
        element.setAttribute('aria-checked', String(isOn()));
      });
      row.className = 'settings-switch';
      row.setAttribute('role', 'switch');
      row.setAttribute('aria-label', label);
      row.setAttribute('aria-checked', String(isOn()));
      const caption = document.createElement('span');
      caption.className = 'settings-switch-text';
      const title = document.createElement('span');
      title.textContent = label;
      const detail = document.createElement('span');
      detail.className = 'hint';
      detail.textContent = hint;
      caption.append(title, detail);
      const track = document.createElement('span');
      track.className = 'settings-switch-track';
      track.setAttribute('aria-hidden', 'true');
      row.append(caption, track);
    };
    const profile = card('PROFIL & GERÄTE');
    text(profile, 'Name, Level, Statistik und Mehrgeräte-Anmeldung an einem Ort.');
    button(profile, 'Profil öffnen', () => {
      SoundSystem.playUiClick();
      openProfile();
    });
    const feedback = card('FEEDBACK');
    toggle(
      feedback,
      'Ton',
      'Spieltöne und Effekte',
      () => SoundSystem.isEnabled(),
      () => SoundSystem.setEnabled(!SoundSystem.isEnabled()),
    );
    toggle(
      feedback,
      'Haptik',
      'Vibration bei Treffern und Aktionen',
      () => HapticsSystem.isEnabled(),
      () => {
        HapticsSystem.setEnabled(!HapticsSystem.isEnabled());
        SoundSystem.playUiToggle(HapticsSystem.isEnabled());
      },
    );
    const graphics = card('GRAFIK');
    // Drei Stufen nebeneinander statt eines Knopfes, der reihum schaltet: So
    // sieht man alle Moeglichkeiten und waehlt direkt.
    const levels: readonly [EffectsQuality, string][] = [
      ['full', 'Voll'],
      ['medium', 'Mittel'],
      ['reduced', 'Sparsam'],
    ];
    const segment = document.createElement('div');
    segment.className = 'settings-segment';
    segment.setAttribute('role', 'group');
    segment.setAttribute('aria-label', 'Effekte');
    graphics.append(segment);
    const choices = levels.map(([quality, label]) => {
      const choice = button(segment, label, () => {
        EffectsQualitySystem.setQuality(quality);
        SoundSystem.playUiToggle(quality !== 'reduced');
        markQuality();
        hint.textContent = qualityHint();
      });
      return { choice, quality };
    });
    const markQuality = (): void =>
      choices.forEach(({ choice, quality }) =>
        choice.setAttribute('aria-pressed', String(quality === EffectsQualitySystem.current())),
      );
    markQuality();
    const qualityHint = (): string =>
      EffectsQualitySystem.wasLoweredAutomatically()
        ? 'Automatisch gesenkt – dein Gerät kam nicht mit'
        : 'Sparsam und Mittel schonen schwache Geräte';
    const hint = text(graphics, qualityHint(), true);
    toggle(
      graphics,
      'Bildrate anzeigen',
      'Im Run unten links: fps, längster Frame, Ruckler',
      () => SaveSystem.load().showFrameRate,
      () =>
        SaveSystem.update((data) => {
          data.showFrameRate = !data.showFrameRate;
        }),
    );
    const legal = card('IMPRESSUM');
    text(legal, 'PROGRAMMIERT VON YAVUZ ISIK');
    text(legal, 'BESONDERER DANK AN EMRE UND SIMAY');
    text(
      legal,
      'Für eure aussergewöhnliche Unterstützung bei der Planung, mit Vorschlägen und Ideen, beim Testen und Bugfixen. Eure Neugier und ehrlichen Rückmeldungen machen isiHunt mutiger, schöner und immer ein bisschen besser.',
    );
    text(legal, 'Dein Spielstand wird automatisch lokal gespeichert.', true);
    // Derselbe Pfeil wie am Canvas-Zurueck-Knopf aller anderen Unterseiten.
    const backButton = button(this.root.querySelector('footer')!, 'Zurück', () => {
      SoundSystem.playUiClick('back');
      back();
    });
    backButton.setAttribute('aria-label', 'Zurück');
    backButton.prepend(Object.assign(document.createElement('span'), { textContent: '← ' }));
    backButton.firstElementChild!.setAttribute('aria-hidden', 'true');
    document.body.append(this.root);
    this.observer = new ResizeObserver(this.position);
    this.observer.observe(scene.game.canvas);
    window.addEventListener('resize', this.position);
    this.position();
  }
  private readonly position = (): void => {
    const rect = this.scene.game.canvas.getBoundingClientRect();
    Object.assign(this.root.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  };
  destroy(): void {
    this.observer.disconnect();
    window.removeEventListener('resize', this.position);
    this.root.remove();
  }
}
