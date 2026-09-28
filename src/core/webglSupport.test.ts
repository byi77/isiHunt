import { describe, expect, it } from 'vitest';
import { NO_WEBGL_MESSAGE, showNoWebGL, supportsWebGL } from './webglSupport';

function docWith(contexts: Record<string, unknown>): Document {
  return {
    createElement: () => ({ getContext: (kind: string) => contexts[kind] ?? null }),
  } as unknown as Document;
}

describe('supportsWebGL', () => {
  it('erkennt WebGL2 und faellt auf WebGL1 zurueck', () => {
    expect(supportsWebGL(docWith({ webgl2: {} }))).toBe(true);
    expect(supportsWebGL(docWith({ webgl: {} }))).toBe(true);
  });

  it('meldet false ohne Kontext und bei einer Ausnahme', () => {
    expect(supportsWebGL(docWith({}))).toBe(false);
    const throwing = {
      createElement: () => ({
        getContext: () => {
          throw new Error('blockiert');
        },
      }),
    } as unknown as Document;
    expect(supportsWebGL(throwing)).toBe(false);
  });
});

describe('showNoWebGL', () => {
  it('ersetzt den Ladehinweis durch die Erklaerung', () => {
    document.body.innerHTML = '<div id="boot">isiHunt wird geladen …</div>';
    showNoWebGL();
    const boot = document.getElementById('boot')!;
    expect(boot.textContent).toBe(NO_WEBGL_MESSAGE);
    expect(boot.getAttribute('role')).toBe('alert');
  });
});
