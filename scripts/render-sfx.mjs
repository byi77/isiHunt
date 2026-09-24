/**
 * Rendert alle Soundeffekte von isiHunt nach public/assets/audio/.
 *
 * Die Effekte sind vollstaendig in diesem Skript synthetisiert - keine
 * Fremdquelle, keine Lizenzfrage (docs/SOUND_ASSETS.md). Das Skript ist die
 * Quelle der Wahrheit: Wer einen Klang aendern will, aendert ihn hier und
 * rendert neu, statt eine WAV-Datei von Hand zu bearbeiten.
 *
 * Warum vorgerendert statt zur Laufzeit synthetisiert: Hall-Fahnen und viele
 * Schichten kosten im Browser Rechenzeit in der Frame-Schleife schwacher
 * Handys. Vorgerendert kosten sie beim Abspielen nichts (ADR-0029).
 *
 * Deterministisch: fester Zufallsstartwert, gleiche Ausgabe bei jedem Lauf.
 *
 *   node scripts/render-sfx.mjs
 *
 * Die Stimmclips (voice-*.wav) entstehen separat mit Piper, siehe
 * `--voice` unten und docs/SOUND_ASSETS.md.
 *
 *   node scripts/render-sfx.mjs --voice <ordner-mit-piper.exe-und-modell>
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Gerendert wird mit 44,1 kHz (sauberer FM- und Rauschanteil), ausgeliefert mit
// 22,05 kHz: halbiert die Dateigroesse, und oberhalb von ~10 kHz geben
// Handy-Lautsprecher ohnehin kaum etwas wieder.
const SR = 44100;
const OUT_RATE = 22050;
const PEAK = 0.89; // -1 dBFS - Lautstaerke je Effekt regelt src/config/audio.ts
const OUT = fileURLToPath(new URL('../public/assets/audio/', import.meta.url));

let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const buf = (sec) => new Float32Array(Math.ceil(sec * SR));
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

// ---------- Ausgabe ----------

class Biquad {
  constructor(type, f, q = 0.707, rate = SR) {
    this.type = type;
    this.q = q;
    this.rate = rate;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.set(f);
  }

  set(f) {
    const w = (2 * Math.PI * Math.min(f, this.rate * 0.45)) / this.rate;
    const c = Math.cos(w);
    const s = Math.sin(w);
    const a = s / (2 * this.q);
    let b0, b1, b2;
    if (this.type === 'lp') {
      b0 = (1 - c) / 2;
      b1 = 1 - c;
      b2 = b0;
    } else if (this.type === 'hp') {
      b0 = (1 + c) / 2;
      b1 = -(1 + c);
      b2 = b0;
    } else {
      b0 = a;
      b1 = 0;
      b2 = -a;
    }
    const a0 = 1 + a;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * c) / a0;
    this.a2 = (1 - a) / a0;
  }

  run(x) {
    const y =
      this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** Tiefpass (zwei Stufen) gegen Spiegelfrequenzen, dann jedes zweite Sample. */
function downsample(x) {
  const a = new Biquad('lp', 9500, 0.54);
  const b = new Biquad('lp', 9500, 1.31);
  const y = new Float32Array(Math.floor(x.length / 2));
  for (let i = 0; i < x.length; i++) {
    const v = b.run(a.run(x[i]));
    if (i % 2 === 0 && i / 2 < y.length) y[i / 2] = v;
  }
  return y;
}

/** Stille am Ende abschneiden und kurz ausblenden - kein Knacken. */
function tidy(x, rate) {
  let end = x.length - 1;
  while (end > 0 && Math.abs(x[end]) < 2e-4) end--;
  const y = x.slice(0, end + 1);
  const fade = Math.min(y.length, Math.floor(rate * 0.01));
  for (let i = 0; i < fade; i++) y[y.length - 1 - i] *= i / fade;
  return y;
}

function encodeWav(x, rate) {
  let max = 0;
  for (const v of x) max = Math.max(max, Math.abs(v));
  const gain = max ? PEAK / max : 1;
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + x.length * 2, 4);
  b.write('WAVE', 8);
  b.write('fmt ', 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) {
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i] * gain)) * 32767), 44 + i * 2);
  }
  return b;
}

const written = [];
function save(name, x) {
  const file = join(OUT, `${name}.wav`);
  writeFileSync(file, encodeWav(tidy(downsample(x), OUT_RATE), OUT_RATE));
  written.push(file);
}

// ---------- Synthese-Bausteine ----------

/** Bandbegrenzte Wellenformen (additiv), wie die WebAudio-Oszillatoren. */
function wave(type, phase, f) {
  if (type === 'sine') return Math.sin(phase);
  const n = Math.max(1, Math.floor(SR / 2 / f));
  let s = 0;
  if (type === 'square') {
    for (let k = 1; k <= n; k += 2) s += Math.sin(k * phase) / k;
    return (s * 4) / Math.PI;
  }
  if (type === 'sawtooth') {
    for (let k = 1; k <= n; k++) s += ((k % 2 ? 1 : -1) * Math.sin(k * phase)) / k;
    return (s * 2) / Math.PI;
  }
  for (let k = 1, sign = 1; k <= n; k += 2, sign = -sign)
    s += (sign * Math.sin(k * phase)) / (k * k);
  return (s * 8) / (Math.PI * Math.PI);
}

const adsr = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));

/** Glockenartiger FM-Ton: klar und glasig. */
function bell(out, at, f, opts = {}) {
  const { dur = 0.6, amp = 0.5, ratio = 3.5, index = 2.2, decay = 0.18, attack = 0.002 } = opts;
  const s = Math.floor(at * SR);
  const n = Math.floor(dur * SR);
  let pc = 0;
  let pm = 0;
  for (let i = 0; i < n && s + i < out.length; i++) {
    const t = i / SR;
    pm += (2 * Math.PI * f * ratio) / SR;
    pc += (2 * Math.PI * f) / SR;
    const mod = index * Math.exp(-t / (decay * 0.6)) * Math.sin(pm);
    out[s + i] += Math.sin(pc + mod) * adsr(t, attack, decay) * amp;
  }
}

/** Weicher "Blip" mit Tonhoehenfall - Basis der UI-Taps. */
function blip(out, at, f0, f1, dur, amp = 0.5) {
  const s = Math.floor(at * SR);
  const n = Math.floor(dur * SR);
  let ph = 0;
  for (let i = 0; i < n && s + i < out.length; i++) {
    const t = i / SR;
    const f = f1 + (f0 - f1) * Math.exp(-t * 60);
    ph += (2 * Math.PI * f) / SR;
    out[s + i] += Math.sin(ph) * adsr(t, 0.002, dur / 4) * amp;
  }
}

/** Gefiltertes Rauschen mit Filterfahrt - Whoosh, Puff, Transienten. */
function noise(out, at, dur, opts = {}) {
  const { type = 'bp', f0 = 800, f1 = 800, q = 1, amp = 0.3, attack = 0.005, decay = 0.1 } = opts;
  const s = Math.floor(at * SR);
  const n = Math.floor(dur * SR);
  const flt = new Biquad(type, f0, q);
  for (let i = 0; i < n && s + i < out.length; i++) {
    const t = i / SR;
    if (i % 32 === 0) flt.set(f0 * (f1 / f0) ** (t / dur));
    out[s + i] += flt.run(rnd()) * adsr(t, attack, decay) * amp;
  }
}

/** Verstimmte Saegezaehne durch einen sich oeffnenden Tiefpass - Pad/Brass. */
function pad(out, at, freqs, dur, opts = {}) {
  const {
    amp = 0.2,
    attack = 0.08,
    release = 0.4,
    cutoff0 = 600,
    cutoff1 = 2400,
    detune = 0.006,
  } = opts;
  const s = Math.floor(at * SR);
  const n = Math.floor((dur + release * 3) * SR);
  const voices = freqs.flatMap((f) =>
    [f * (1 - detune), f, f * (1 + detune)].map((ff) => ({ ff, ph: (rnd() + 1) * 3 })),
  );
  const flt = new Biquad('lp', cutoff0, 0.9);
  for (let i = 0; i < n && s + i < out.length; i++) {
    const t = i / SR;
    if (i % 32 === 0) flt.set(cutoff0 + (cutoff1 - cutoff0) * Math.min(1, t / (attack * 3)));
    let v = 0;
    for (const o of voices) {
      o.ph += (2 * Math.PI * o.ff) / SR;
      v += wave('sawtooth', o.ph, o.ff);
    }
    const e = t < attack ? t / attack : t < dur ? 1 : Math.exp(-(t - dur) / release);
    out[s + i] += flt.run(v / voices.length) * e * amp;
  }
}

/** Sub-Schlag mit Tonhoehenfall - gibt Gewicht. */
function sub(out, at, f, dur = 0.35, amp = 0.6, drop = 2) {
  const s = Math.floor(at * SR);
  const n = Math.floor(dur * SR);
  let ph = 0;
  for (let i = 0; i < n && s + i < out.length; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * f * (1 + drop * Math.exp(-t * 35))) / SR;
    out[s + i] += Math.sin(ph) * Math.exp(-t * (4 / dur)) * amp;
  }
}

/** Glitzer: zufaellige hohe Glockenkoerner. */
function sparkle(out, at, dur, count, lo, hi, amp) {
  for (let k = 0; k < count; k++) {
    const t = at + (k / count) * dur + Math.abs(rnd()) * 0.02;
    bell(out, t, lo + Math.abs(rnd()) * (hi - lo), {
      dur: 0.15,
      amp: amp * (1 - (k / count) * 0.5),
      ratio: 2,
      index: 0.5,
      decay: 0.04,
    });
  }
}

/** Riser: Saegezahn gleitet hoch, Rauschen oeffnet sich. */
function riser(out, at, dur, f0, f1, amp) {
  const s = Math.floor(at * SR);
  const n = Math.floor(dur * SR);
  const flt = new Biquad('lp', 400, 2);
  let ph = 0;
  for (let i = 0; i < n && s + i < out.length; i++) {
    const p = i / n;
    const f = f0 * (f1 / f0) ** p;
    if (i % 32 === 0) flt.set(400 + p * 5000);
    ph += (2 * Math.PI * f) / SR;
    out[s + i] += flt.run(wave('sawtooth', ph, f) * 0.6 + rnd() * 0.4) * p * p * amp;
  }
}

/** Kleiner Raum: Schroeder-Hall aus vier Kamm- und zwei Allpassfiltern. */
function reverb(x, mix = 0.25, size = 1, fb = 0.8) {
  const y = new Float32Array(x.length + Math.floor(SR * 1.2 * size));
  const combs = [1557, 1617, 1491, 1422].map((d) => {
    const len = Math.floor(d * size);
    return { d: len, b: new Float32Array(len), i: 0, lp: 0 };
  });
  const aps = [225, 556].map((d) => ({ d, b: new Float32Array(d), i: 0 }));
  for (let n = 0; n < y.length; n++) {
    const inp = x[n] ?? 0;
    let w = 0;
    for (const c of combs) {
      const o = c.b[c.i];
      c.lp = o * 0.7 + c.lp * 0.3;
      c.b[c.i] = inp + c.lp * fb;
      c.i = (c.i + 1) % c.d;
      w += o;
    }
    w /= 4;
    for (const a of aps) {
      const o = a.b[a.i];
      const v = w + o * 0.5;
      a.b[a.i] = v;
      a.i = (a.i + 1) % a.d;
      w = o - v * 0.5;
    }
    y[n] = inp + w * mix;
  }
  return y;
}

/** Weiche Saettigung: macht dichte Mischungen kompakter. */
const glue = (x, drive = 1.5) => x.map((v) => Math.tanh(v * drive) / Math.tanh(drive));

// C-Dur-Pentatonik: jede Kombination klingt zusammen, nichts schief.
const PENTA = [0, 2, 4, 7, 9];
const penta = (base, step) => mtof(base + PENTA[step % 5] + 12 * Math.floor(step / 5));

// ---------- Effekte ----------

function render() {
  // Menue
  {
    const o = buf(0.12);
    noise(o, 0, 0.02, { type: 'hp', f0: 4000, f1: 4000, amp: 0.15, attack: 0.0005, decay: 0.004 });
    blip(o, 0, 2100, 1400, 0.07, 0.45);
    blip(o, 0, 700, 700, 0.05, 0.15);
    save('sfx-ui-tap', o);
  }
  {
    const o = buf(0.15);
    noise(o, 0, 0.02, { type: 'hp', f0: 3000, f1: 3000, amp: 0.12, attack: 0.0005, decay: 0.004 });
    blip(o, 0, 900, 520, 0.1, 0.45);
    save('sfx-ui-back', o);
  }
  for (const on of [true, false]) {
    const o = buf(0.25);
    const [a, b] = on ? [mtof(79), mtof(86)] : [mtof(86), mtof(79)];
    blip(o, 0, a * 1.2, a, 0.08, 0.4);
    blip(o, 0.07, b * 1.2, b, 0.12, 0.4);
    save(on ? 'sfx-toggle-on' : 'sfx-toggle-off', o);
  }
  {
    // Weltwechsel in zwei Schichten: das Rauschen bleibt fest, die Glocke wird
    // zur Laufzeit je Welt hochgestimmt (WORLD_SELECT_SEMITONES).
    const o = buf(0.4);
    noise(o, 0, 0.25, {
      type: 'bp',
      f0: 400,
      f1: 3000,
      q: 1.2,
      amp: 0.25,
      attack: 0.08,
      decay: 0.08,
    });
    save('sfx-world-whoosh', reverb(o, 0.2, 0.6));
    const b = buf(0.5);
    bell(b, 0, mtof(60), { dur: 0.4, amp: 0.35, ratio: 2, index: 1.2, decay: 0.12 });
    bell(b, 0, mtof(72), { dur: 0.3, amp: 0.12, ratio: 3, index: 0.8, decay: 0.08 });
    save('sfx-world-bell', reverb(b, 0.2, 0.6));
  }

  // Einsammeln: Pling -> Kristall -> Glocke -> Chor -> Legendaer-Drop
  const transient = (o, amp) =>
    noise(o, 0, 0.015, { type: 'hp', f0: 6000, f1: 6000, amp, attack: 0.0005, decay: 0.003 });
  {
    const o = buf(0.2);
    transient(o, 0.05);
    bell(o, 0, 880, { dur: 0.15, amp: 0.3, ratio: 1, index: 0.4, decay: 0.04 });
    save('sfx-collect-poor', o);
  }
  {
    const o = buf(0.3);
    transient(o, 0.1);
    bell(o, 0, 1318, { dur: 0.25, amp: 0.4, ratio: 3.01, index: 1.1, decay: 0.06 });
    save('sfx-collect-common', o);
  }
  {
    const o = buf(0.45);
    transient(o, 0.12);
    bell(o, 0, 1318, { dur: 0.3, amp: 0.35, ratio: 3.01, index: 1.2, decay: 0.07 });
    bell(o, 0.05, 1760, { dur: 0.35, amp: 0.35, ratio: 3.01, index: 1.2, decay: 0.09 });
    save('sfx-collect-uncommon', reverb(o, 0.15, 0.5));
  }
  {
    const o = buf(0.7);
    transient(o, 0.12);
    [84, 88, 91].forEach((m, i) =>
      bell(o, i * 0.05, mtof(m), { dur: 0.5, amp: 0.3, ratio: 3.5, index: 1.8, decay: 0.14 }),
    );
    sub(o, 0, 110, 0.15, 0.25, 1);
    save('sfx-collect-rare', reverb(o, 0.25, 0.7));
  }
  {
    const o = buf(1.2);
    transient(o, 0.15);
    [84, 88, 91, 96].forEach((m, i) =>
      bell(o, i * 0.05, mtof(m), { dur: 0.6, amp: 0.28, ratio: 3.5, index: 2, decay: 0.16 }),
    );
    pad(o, 0, [60, 64, 67, 72].map(mtof), 0.35, {
      amp: 0.22,
      attack: 0.1,
      release: 0.25,
      cutoff0: 500,
      cutoff1: 3000,
    });
    sub(o, 0, 80, 0.3, 0.35, 1.5);
    sparkle(o, 0.15, 0.3, 6, 3000, 6000, 0.05);
    save('sfx-collect-epic', glue(reverb(o, 0.3, 0.9)));
  }
  {
    const o = buf(2);
    noise(o, 0, 0.3, {
      type: 'bp',
      f0: 300,
      f1: 5000,
      q: 0.8,
      amp: 0.2,
      attack: 0.02,
      decay: 0.12,
    });
    sub(o, 0, 55, 0.6, 0.6, 3);
    [84, 88, 91, 96, 100, 103].forEach((m, i) =>
      bell(o, 0.03 + i * 0.045, mtof(m), {
        dur: 0.8,
        amp: 0.26,
        ratio: 3.5,
        index: 2.2,
        decay: 0.2,
      }),
    );
    pad(o, 0.02, [48, 60, 64, 67, 71].map(mtof), 0.6, {
      amp: 0.25,
      attack: 0.12,
      release: 0.4,
      cutoff0: 400,
      cutoff1: 3500,
    });
    sparkle(o, 0.25, 0.8, 16, 2500, 7000, 0.06);
    save('sfx-collect-legendary', glue(reverb(o, 0.35, 1.1, 0.83), 1.8));
  }

  // Combo-Stufen: je Stufe hoeher, ab Stufe 4 mit Glitzer
  for (let i = 0; i < 5; i++) {
    const o = buf(0.9);
    riser(o, 0, 0.18, 200 + i * 60, 800 + i * 200, 0.12 + i * 0.02);
    const f = penta(72, i * 2);
    bell(o, 0.18, f, { dur: 0.4, amp: 0.4, ratio: 2, index: 1.5, decay: 0.12 });
    bell(o, 0.18, f * 1.5, { dur: 0.35, amp: 0.2, ratio: 2, index: 1, decay: 0.1 });
    sub(o, 0.18, 90, 0.2, 0.25 + i * 0.05, 1.5);
    if (i >= 3) sparkle(o, 0.22, 0.25, 4 + i * 2, 3000, 7000, 0.05);
    save(`sfx-combo-${i + 1}`, glue(reverb(o, 0.2, 0.6)));
  }

  // Hindernisse
  {
    // Bremse: "Tape-Stop" - der Ton faellt, dumpfer Rauschstoss
    const o = buf(0.45);
    noise(o, 0, 0.3, {
      type: 'lp',
      f0: 2500,
      f1: 200,
      q: 1,
      amp: 0.35,
      attack: 0.002,
      decay: 0.08,
    });
    let ph = 0;
    for (let i = 0; i < SR * 0.35; i++) {
      const t = i / SR;
      const f = 320 * Math.exp(-t * 6);
      ph += (2 * Math.PI * f) / SR;
      o[i] += wave('triangle', ph, f) * Math.exp(-t * 7) * 0.45;
    }
    save('sfx-obstacle-brake', o);
  }
  {
    // Strafe: digitaler Glitch mit Bitcrush und Tonwackeln
    const o = buf(0.4);
    let ph = 0;
    for (let i = 0; i < SR * 0.3; i++) {
      const t = i / SR;
      const f = 150 + 60 * Math.sin(t * 90) - t * 200;
      ph += (2 * Math.PI * f) / SR;
      const v = Math.round((wave('square', ph, f) * 0.5 + rnd() * 0.25) * 6) / 6;
      o[i] += Math.tanh(v * 3) * Math.exp(-t * 9) * 0.5;
    }
    sub(o, 0, 60, 0.25, 0.5, 1);
    for (let i = 0; i < o.length; i++) if (i % 6) o[i] = o[i - (i % 6)];
    save('sfx-obstacle-penalty', o);
  }

  // Run-Ende
  {
    const o = buf(3);
    sub(o, 0, 65, 0.5, 0.5, 2);
    const brass = {
      amp: 0.3,
      attack: 0.01,
      release: 0.05,
      cutoff0: 800,
      cutoff1: 4000,
      detune: 0.004,
    };
    pad(o, 0, [60, 64, 67].map(mtof), 0.14, brass);
    pad(o, 0.16, [62, 65, 69].map(mtof), 0.12, brass);
    pad(o, 0.3, [60, 64, 67, 72].map(mtof), 0.7, {
      amp: 0.35,
      attack: 0.02,
      release: 0.5,
      cutoff0: 900,
      cutoff1: 5000,
      detune: 0.005,
    });
    [84, 88, 91, 96].forEach((m, i) =>
      bell(o, 0.3 + i * 0.07, mtof(m), { dur: 0.9, amp: 0.2, ratio: 3.5, index: 1.6, decay: 0.25 }),
    );
    sparkle(o, 0.45, 0.9, 14, 3000, 7500, 0.05);
    save('sfx-run-end-levelup', glue(reverb(o, 0.3, 1, 0.82), 1.6));
  }
  {
    // warmer Abschluss (Fmaj9) - ruhig, nicht "verloren"
    const o = buf(3);
    pad(o, 0, [53, 57, 60, 64, 67].map(mtof), 0.5, {
      amp: 0.3,
      attack: 0.15,
      release: 0.6,
      cutoff0: 500,
      cutoff1: 1800,
    });
    bell(o, 0.05, mtof(76), { dur: 1, amp: 0.15, ratio: 2, index: 0.8, decay: 0.3 });
    bell(o, 0.2, mtof(72), { dur: 1, amp: 0.12, ratio: 2, index: 0.8, decay: 0.3 });
    save('sfx-run-end', reverb(o, 0.3, 1, 0.8));
  }

  // Bisher stumme Ereignisse
  {
    const o = buf(0.5);
    noise(o, 0, 0.4, { type: 'bp', f0: 3000, f1: 400, q: 2, amp: 0.3, attack: 0.02, decay: 0.12 });
    bell(o, 0, mtof(88), { dur: 0.35, amp: 0.08, ratio: 1.5, index: 0.5, decay: 0.1 });
    save('sfx-missed', reverb(o, 0.3, 0.6));
  }
  for (const down of [true, false]) {
    // Einfrieren / Auftauen: Filterfahrt ueber einem kurzen Akkord
    const src = buf(0.8);
    pad(src, 0, [60, 67, 72].map(mtof), 0.4, {
      amp: 0.4,
      attack: 0.01,
      release: 0.15,
      cutoff0: 6000,
      cutoff1: 6000,
    });
    const o = buf(0.8);
    const flt = new Biquad('lp', 3000, 1.5);
    for (let i = 0; i < o.length; i++) {
      const p = i / o.length;
      if (i % 32 === 0) flt.set(down ? 4000 * (1 - p) ** 3 + 150 : 150 + 4000 * p ** 2);
      o[i] = flt.run(src[i]);
    }
    save(down ? 'sfx-pause' : 'sfx-resume', o);
  }
  {
    // Gegner getrennt: zwei weiche Toene, kleine Terz abwaerts
    const t = buf(0.6);
    const tone = (at, m, dur) => {
      const s = Math.floor(at * SR);
      let ph = 0;
      for (let i = 0; i < dur * SR; i++) {
        ph += (2 * Math.PI * mtof(m)) / SR;
        t[s + i] += wave('square', ph, mtof(m)) * adsr(i / SR, 0.01, dur / 3) * 0.3;
      }
    };
    tone(0, 76, 0.14);
    tone(0.16, 73, 0.25);
    const o = buf(0.6);
    const flt = new Biquad('lp', 1500);
    for (let i = 0; i < o.length; i++) o[i] = flt.run(t[i]);
    save('sfx-opponent-left', reverb(o, 0.2, 0.5));
  }
  {
    // Erfolg freigeschaltet: Glissando in eine helle Glocke
    const o = buf(2);
    for (let k = 0; k < 10; k++) {
      bell(o, k * 0.035, penta(84, k), { dur: 0.4, amp: 0.15, ratio: 3.5, index: 1.2, decay: 0.1 });
    }
    bell(o, 0.4, mtof(96), { dur: 1.2, amp: 0.3, ratio: 3.5, index: 2, decay: 0.35 });
    sparkle(o, 0.4, 0.8, 12, 4000, 8000, 0.05);
    save('sfx-achievement', reverb(o, 0.3, 1));
  }
}

// ---------- Stimme (optional, braucht Piper lokal) ----------

const VOICE_LINES = [
  ['voice-3', 'Drei!'],
  ['voice-2', 'Zwei!'],
  ['voice-1', 'Eins!'],
  ['voice-go', "Los geht's!"],
];

// Thorsten-Voice, CC0 (docs/SOUND_ASSETS.md). Sprecher "neutral" des
// emotionalen Modells, ohne Nachbearbeitung - so im Hoertest ausgewaehlt.
const VOICE_MODEL = 'de_DE-thorsten_emotional-medium.onnx';
const VOICE_SPEAKER = '4';

function readWav(file) {
  const b = readFileSync(file);
  let o = 12;
  let rate = 22050;
  let data = new Float32Array(0);
  while (o < b.length) {
    const id = b.toString('ascii', o, o + 4);
    const size = b.readUInt32LE(o + 4);
    if (id === 'fmt ') rate = b.readUInt32LE(o + 12);
    if (id === 'data') {
      data = new Float32Array(size / 2);
      for (let i = 0; i < data.length; i++) data[i] = b.readInt16LE(o + 8 + i * 2) / 32768;
    }
    o += 8 + size;
  }
  return { rate, data };
}

function renderVoice(piperDir) {
  const tmp = join(OUT, '.voice-tmp.wav');
  for (const [name, text] of VOICE_LINES) {
    execFileSync(
      join(piperDir, 'piper', 'piper.exe'),
      [
        '-m',
        join(piperDir, VOICE_MODEL),
        '--speaker',
        VOICE_SPEAKER,
        '--length_scale',
        '0.85',
        '-f',
        tmp,
      ],
      { input: text, stdio: ['pipe', 'ignore', 'ignore'] },
    );
    const { rate, data } = readWav(tmp);
    if (rate !== OUT_RATE) throw new Error(`Piper liefert ${rate} Hz statt ${OUT_RATE} Hz`);
    // Vorne knapp an den Einsatz schneiden: der Countdown-Takt ist 700 ms, jede
    // Millisekunde Stille davor verschiebt die Zahl gegen die Anzeige.
    let start = 0;
    while (start < data.length && Math.abs(data[start]) < 0.02) start++;
    const clip = tidy(data.slice(Math.max(0, start - 100)), OUT_RATE);
    writeFileSync(join(OUT, `${name}.wav`), encodeWav(clip, OUT_RATE));
    written.push(join(OUT, `${name}.wav`));
  }
  rmSync(tmp, { force: true });
}

mkdirSync(OUT, { recursive: true });
const voiceIndex = process.argv.indexOf('--voice');
if (voiceIndex >= 0) renderVoice(process.argv[voiceIndex + 1]);
else render();

for (const file of written) {
  const size = readFileSync(file).length;
  console.log(`${(size / 1024).toFixed(1).padStart(6)} KB  ${file.split(/[\\/]/).pop()}`);
}
