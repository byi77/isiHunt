/**
 * Ein echtes HTML-Eingabefeld ueber dem Canvas.
 *
 * Warum kein selbstgebautes Textfeld: Auf dem Handy muss die Systemtastatur
 * aufgehen. Das tut sie nur fuer ein echtes `<input>`. Alles andere - eigene
 * Bildschirmtastatur, Zeichen fuer Zeichen abfangen - bedeutet Wochen Arbeit
 * fuer ein schlechteres Ergebnis, ohne Autokorrektur, ohne Einfuegen, ohne
 * Zahlenblock.
 *
 * Phaser positioniert und skaliert das Feld zusammen mit dem Canvas, sodass es
 * sich im Layout wie ein normales Spielelement verhaelt.
 */

import type Phaser from 'phaser';
import { GAME_WIDTH } from '@/config/GameConfig';

import {
  FONT_FAMILY,
  uiUnit,
  uiFont,
  InterfaceStyle,
  Palette,
  canvasUiPixels,
  toCss,
} from '@/ui/theme';

export interface TextInputHandle {
  element: Phaser.GameObjects.DOMElement;
  getValue(): string;
  setValue(value: string): void;
  focus(): void;
  destroy(): void;
}

export interface TextInputOptions {
  placeholder?: string;
  maxLength?: number;
  inputType?: 'text' | 'email' | 'password';
  width?: number;
  accent?: number;
  /** Grossbuchstaben erzwingen und Autokorrektur abschalten - fuer Codes. */
  uppercase?: boolean;
  /** Numerische Tastatur und nur Ziffern - fuer den sechsstelligen PIN. */
  numeric?: boolean;
  /** Nur numerische Tastatur, ohne bestehende Legacy-Passwörter zu filtern. */
  numericKeyboard?: boolean;
  onSubmit?: (value: string) => void;
}

export function createTextInput(
  scene: Phaser.Scene,
  x: number,
  y: number,
  options: TextInputOptions = {},
): TextInputHandle {
  const width = options.width ?? 420;
  const accent = options.accent ?? Palette.goldHex;

  const input = document.createElement('input');
  input.type = options.inputType ?? 'text';
  input.placeholder = options.placeholder ?? '';
  if (options.maxLength) input.maxLength = options.maxLength;

  // Bei Codes stoeren Autokorrektur und Gross-/Kleinschreibhilfe mehr, als sie
  // helfen - iOS macht sonst aus "AB12CD" gern "Ab12cd" oder ein Wort daraus.
  if (options.uppercase) {
    input.autocapitalize = 'characters';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('autocorrect', 'off');
  }

  if (input.type === 'email') {
    input.autocomplete = 'email';
    input.inputMode = 'email';
  } else if (input.type === 'password') {
    input.autocomplete = 'current-password';
  }
  if (options.numeric || options.numericKeyboard) {
    input.inputMode = 'numeric';
    input.pattern = '[0-9]*';
  }
  if (options.numeric) {
    input.addEventListener('input', () => {
      const start = input.selectionStart ?? input.value.length;
      const before = input.value;
      input.value = before.replace(/\D/g, '').slice(0, options.maxLength ?? 6);
      const removedBeforeCursor = before.slice(0, start).replace(/\D/g, '').length;
      input.setSelectionRange(
        Math.min(removedBeforeCursor, input.value.length),
        Math.min(removedBeforeCursor, input.value.length),
      );
    });
  }

  Object.assign(input.style, {
    width: `${width}px`,
    height: `${InterfaceStyle.minTouchSize * uiUnit(scene)}px`,
    boxSizing: 'border-box',
    padding: '0 20px',
    // Eingelassen statt erhaben: dunkler als jeder Knopf, Innenschatten,
    // neutrale Kontur. Mit Knopf-Flaeche und Weltfarben-Rahmen sah das
    // Namensfeld im Profil wie ein Knopf aus (Design-Review 28.10.2026).
    background: toCss(Palette.fieldSurface),
    boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.6)',
    border: `2px solid ${toCss(Palette.controlBorder)}`,
    borderRadius: `${canvasUiPixels(InterfaceStyle.buttonRadius, scene.game.canvas.getBoundingClientRect().width || GAME_WIDTH, GAME_WIDTH)}px`,
    color: Palette.ink,
    fontFamily: FONT_FAMILY,
    fontSize: `${uiFont(scene, 'body')}px`,
    textAlign: 'center',
    outlineOffset: '2px',
    // Verhindert, dass iOS beim Fokussieren in das Feld hineinzoomt.
    // (Der Zoom traefe die gesamte Seite, nicht nur das Feld.)
    fontWeight: 'bold',
    letterSpacing: options.uppercase ? '6px' : 'normal',
  });

  // Die Weltfarbe zeigt erst der Fokus: Sie heisst "hier wird gerade getippt".
  input.addEventListener('focus', () => (input.style.borderColor = toCss(accent)));
  input.addEventListener('blur', () => (input.style.borderColor = toCss(Palette.controlBorder)));

  if (options.uppercase) {
    input.addEventListener('input', () => {
      const start = input.selectionStart;
      input.value = input.value.toUpperCase();
      input.setSelectionRange(start, start);
    });
  }

  if (options.onSubmit) {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        options.onSubmit?.(input.value);
      }
    });
  }

  const element = scene.add.dom(x, y, input);

  return {
    element,
    getValue: () => input.value,
    setValue: (value: string) => {
      input.value = value;
    },
    focus: () => input.focus(),
    destroy: () => element.destroy(),
  };
}
