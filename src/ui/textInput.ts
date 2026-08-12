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

import { FONT_FAMILY, FontSize, Palette, toCss } from '@/ui/theme';

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
  width?: number;
  accent?: number;
  /** Grossbuchstaben erzwingen und Autokorrektur abschalten - fuer Codes. */
  uppercase?: boolean;
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
  input.type = 'text';
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

  Object.assign(input.style, {
    width: `${width}px`,
    height: '72px',
    boxSizing: 'border-box',
    padding: '0 20px',
    background: 'rgba(16, 23, 51, 0.92)',
    border: `2px solid ${toCss(accent)}`,
    borderRadius: '14px',
    color: Palette.ink,
    fontFamily: FONT_FAMILY,
    fontSize: `${FontSize.body}px`,
    textAlign: 'center',
    outline: 'none',
    // Verhindert, dass iOS beim Fokussieren in das Feld hineinzoomt.
    // (Der Zoom traefe die gesamte Seite, nicht nur das Feld.)
    fontWeight: 'bold',
    letterSpacing: options.uppercase ? '6px' : 'normal',
  });

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
