import type Phaser from 'phaser';
import * as SoundSystem from '@/systems/SoundSystem';
import * as HapticsSystem from '@/systems/HapticsSystem';
import * as EffectsQualitySystem from '@/systems/EffectsQualitySystem';
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
    const profile = card('PROFIL & GERÄTE');
    text(profile, 'Name, Level, Statistik und Mehrgeräte-Anmeldung an einem Ort.');
    button(profile, 'PROFIL ÖFFNEN', () => {
      SoundSystem.playUiClick();
      openProfile();
    });
    const feedback = card('FEEDBACK');
    const soundLabel = (): string => `TON: ${SoundSystem.isEnabled() ? 'AN' : 'AUS'}`;
    const sound = button(feedback, soundLabel(), (element) => {
      SoundSystem.setEnabled(!SoundSystem.isEnabled());
      element.textContent = soundLabel();
      element.setAttribute('aria-pressed', String(SoundSystem.isEnabled()));
    });
    sound.setAttribute('aria-pressed', String(SoundSystem.isEnabled()));
    text(feedback, 'Spieltöne und Effekte', true);
    const hapticsLabel = (): string => `HAPTIK: ${HapticsSystem.isEnabled() ? 'AN' : 'AUS'}`;
    const haptics = button(feedback, hapticsLabel(), (element) => {
      HapticsSystem.setEnabled(!HapticsSystem.isEnabled());
      SoundSystem.playUiToggle(HapticsSystem.isEnabled());
      element.textContent = hapticsLabel();
      element.setAttribute('aria-pressed', String(HapticsSystem.isEnabled()));
    });
    haptics.setAttribute('aria-pressed', String(HapticsSystem.isEnabled()));
    text(feedback, 'Vibration bei Treffern und Aktionen', true);
    const graphics = card('GRAFIK');
    const labels = { full: 'VOLL', medium: 'MITTEL', reduced: 'SPARSAM' };
    const qualityLabel = (): string => `EFFEKTE: ${labels[EffectsQualitySystem.current()]}`;
    const qualityButton = button(graphics, qualityLabel(), (element) => {
      const next = EffectsQualitySystem.nextManual();
      EffectsQualitySystem.setQuality(next);
      SoundSystem.playUiToggle(next !== 'reduced');
      element.textContent = qualityLabel();
      element.setAttribute('aria-label', `Effektqualität wechseln. ${qualityLabel()}`);
      hint.textContent = qualityHint();
    });
    qualityButton.setAttribute('aria-label', `Effektqualität wechseln. ${qualityLabel()}`);
    const qualityHint = (): string =>
      EffectsQualitySystem.wasLoweredAutomatically()
        ? 'Automatisch gesenkt – dein Gerät kam nicht mit'
        : 'Sparsam und Mittel schonen schwache Geräte';
    const hint = text(graphics, qualityHint(), true);
    const legal = card('IMPRESSUM');
    text(legal, 'PROGRAMMIERT VON YAVUZ ISIK');
    text(legal, 'BESONDERER DANK AN EMRE UND SIMAY');
    text(
      legal,
      'Für eure aussergewöhnliche Unterstützung bei der Planung, mit Vorschlägen und Ideen, beim Testen und Bugfixen. Eure Neugier und ehrlichen Rückmeldungen machen isiHunt mutiger, schöner und immer ein bisschen besser.',
    );
    text(legal, 'Dein Spielstand wird automatisch lokal gespeichert.', true);
    button(this.root.querySelector('footer')!, 'ZURÜCK', () => {
      SoundSystem.playUiClick('back');
      back();
    });
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
