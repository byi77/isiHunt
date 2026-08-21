/**
 * Die Bewegungen der legendaeren Auren.
 *
 * ## Warum eine reine Rechnung und keine Tweens
 *
 * Eine Aura muss an drei Stellen laufen: an der Spielfigur, in der
 * Ladenvorschau und auf der Ladenkarte. Als Phaser-Tween haette jede dieser
 * Stellen ihre eigene Kette aus `scene.tweens.add()` aufbauen, anhalten und
 * aufraeumen muessen - drei Fassungen derselben Bewegung, die auseinander
 * laufen, sobald eine geaendert wird.
 *
 * Stattdessen ist eine Aura hier eine **Funktion der Zeit**: Sie bekommt die
 * Laufzeit in Millisekunden und liefert, wie die Figur in genau diesem
 * Augenblick auszusehen hat. Wer sie abspielen will, ruft sie je Frame auf und
 * schreibt das Ergebnis auf sein Bild. Das macht sie ausserdem in Node
 * testbar - ein Tween liesse sich nur im Browser pruefen.
 *
 * ## Warum kein Phaser-Import
 *
 * Dieselbe Falle wie in `shipShapes.ts`: Ein Wert-Import von Phaser zieht
 * dessen Canvas-Erkennung mit und laesst die Datei ausserhalb eines Browsers
 * gar nicht erst laden. Die Balance-Tests importieren `SHIP_ANIMATIONS` und
 * laufen in Node.
 *
 * ## Warum die Farbe verschoben und nicht ersetzt wird
 *
 * Eine Aura, die den Rumpf durch den Farbkreis schickt, macht die gekaufte
 * Farbe unsichtbar - der Spieler haette zwei Kategorien bezahlt und saehe nur
 * eine. `tint` mischt deshalb immer von der **getragenen** Farbe aus: heller,
 * dunkler oder ein Stueck weiter im Farbkreis, aber nie unabhaengig von ihr.
 * Gold bleibt als Gold erkennbar, auch wenn es pulsiert.
 *
 * **Eine Ausnahme:** Die Prismaflut (`VOLLER_FARBKREIS_INDEX`) laeuft bewusst
 * durch alle 360 Grad und ueberschreibt die getragene Farbe. Die Begruendung
 * steht bei ihrer Definition; der Balance-Test kennt genau diese eine Aura
 * als Ausnahme und schlaegt an, sobald eine zweite dazukommt.
 */

/**
 * Wie die getragene Farbe fuer diesen Augenblick veraendert wird.
 *
 * `lightness` verschiebt zu Weiss (positiv) oder zu Schwarz (negativ),
 * `hue` dreht im Farbkreis. Beide bei 0 lassen die Farbe unberuehrt.
 */
export interface TintShift {
  /** -1 (schwarz) bis +1 (weiss). */
  readonly lightness: number;
  /** Drehung im Farbkreis, in Grad. */
  readonly hue: number;
  /**
   * Mindestsaettigung, die die Aura selbst mitbringt. 0 = nur die getragene.
   *
   * **Warum das noetig ist.** Bei Weltfarbe bleibt der Rumpf weiss
   * (`shipHullTint`), und Weiss hat die Saettigung 0. Ein Farbtondreh auf
   * einer ungesaettigten Farbe aendert nichts - die Prismaflut waere auf dem
   * Standardschiff komplett unsichtbar geblieben. Aufgefallen ist das nicht
   * beim Lesen, sondern an einem Test, der die Farben eines weissen Rumpfs
   * durchzaehlt: Er fand genau eine.
   *
   * Nur die Prismaflut nutzt das Feld. Die uebrigen Auren lassen es bei 0
   * und bleiben damit genau so weit von der getragenen Farbe entfernt wie
   * bisher.
   */
  readonly saturation?: number;
}

/**
 * Wie die Figur in einem Augenblick auszusehen hat.
 *
 * Alle Werte sind **relativ** zur ruhenden Darstellung: `scaleX: 1` heisst
 * unveraendert, nicht "Groesse 1". Wer sie anwendet, multipliziert mit seiner
 * eigenen Grundskalierung - die Ladenkarte zeigt die Figur kleiner als das
 * Spielfeld, soll aber dieselbe Bewegung zeigen.
 */
export interface AuraFrame {
  readonly scaleX: number;
  readonly scaleY: number;
  /** Zusaetzliche Drehung in Radiant, additiv zur Neigung aus der Bewegung. */
  readonly rotation: number;
  /** Verschiebung gegen die getragene Farbe, siehe `applyTintShift`. */
  readonly tint: TintShift;
  readonly alpha: number;
}

const RUHE: TintShift = { lightness: 0, hue: 0 };

/** Ein Augenblick ohne jede Veraenderung - der Zustand ohne Aura. */
export const AURA_FRAME_RUHE: AuraFrame = {
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  tint: RUHE,
  alpha: 1,
};

/** Eine Aura: Laufzeit in Millisekunden hinein, Aussehen heraus. */
export type AuraAnimation = (timeMs: number) => AuraFrame;

const TAU = Math.PI * 2;

/** Sinus mit Periode `periodMs`, Ergebnis zwischen -1 und +1. */
function welle(timeMs: number, periodMs: number, phase = 0): number {
  return Math.sin((timeMs / periodMs) * TAU + phase);
}

/** Saegezahn von 0 bis 1 ueber `periodMs` - fuer alles, was umlaeuft. */
function umlauf(timeMs: number, periodMs: number): number {
  return (timeMs % periodMs) / periodMs;
}

/**
 * 0 Fluegelschlag: Die Figur schlaegt seitlich, wie Schwingen.
 *
 * Nur die Breite schwingt - die Hoehe bleibt fast stehen. Das liest sich auf
 * jeder Form als Schlag, auch auf einem Wuerfel: Was sich seitlich staucht und
 * wieder oeffnet, wirkt wie etwas, das sich abstoesst. Der Schlag ist bewusst
 * asymmetrisch (auf schneller als ab), sonst wirkt er wie ein Gummiball statt
 * wie ein Fluegel.
 */
const fluegelschlag: AuraAnimation = (t) => {
  const roh = welle(t, 620);
  // Hoch schneller als runter: die positive Halbwelle wird gestaucht.
  const geformt = roh > 0 ? Math.pow(roh, 0.6) : -Math.pow(-roh, 1.4);
  return {
    scaleX: 1 - 0.28 * (geformt * 0.5 + 0.5),
    scaleY: 1 + 0.05 * geformt,
    rotation: 0,
    tint: { lightness: 0.12 * geformt, hue: 0 },
    alpha: 1,
  };
};

/**
 * 1 Kreisel: Eine 3D-artige Drehung um die Hochachse.
 *
 * Der Trick ist alt und traegt trotzdem: Wird die Breite eines flachen Bildes
 * mit dem Kosinus eines Winkels multipliziert, sieht es aus, als drehte es
 * sich im Raum. Bei negativem Kosinus zeigt es die Rueckseite - deshalb wird
 * dort zusaetzlich abgedunkelt, sonst faellt der fehlende Tiefeneindruck auf.
 */
const kreisel: AuraAnimation = (t) => {
  const winkel = umlauf(t, 2_400) * TAU;
  const breite = Math.cos(winkel);
  return {
    // Nie ganz auf 0: Eine Figur, die fuer einen Frame verschwindet, wirkt
    // wie ein Zeichenfehler, nicht wie eine Drehung.
    scaleX: Math.max(0.08, Math.abs(breite)),
    scaleY: 1,
    rotation: 0,
    // Die Rueckseite liegt im Schatten.
    tint: { lightness: breite < 0 ? -0.3 : 0.1 * breite, hue: 0 },
    alpha: 1,
  };
};

/**
 * 2 Prisma: Der Farbton wandert langsam durch den Kreis.
 *
 * Bewusst nur plus/minus 40 Grad statt der vollen Umdrehung: Bei 360 Grad ist
 * die getragene Farbe die Haelfte der Zeit unkenntlich. In diesem Fenster
 * bleibt Gold golden und schimmert nur nach Kupfer und Zitrone.
 */
const prisma: AuraAnimation = (t) => ({
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  tint: { lightness: 0.15 * welle(t, 1_900, Math.PI / 3), hue: 40 * welle(t, 2_600) },
  alpha: 1,
});

/**
 * 3 Herzschlag: Zwei schnelle Schlaege, dann eine Pause.
 *
 * Der Rhythmus macht es - ein gleichmaessiges Pulsieren hat die Figur schon
 * von Haus aus (siehe `Player`). Zwei Schlaege dicht hintereinander lesen sich
 * dagegen als etwas Lebendiges.
 */
const herzschlag: AuraAnimation = (t) => {
  const p = umlauf(t, 1_150);
  // Zwei Ausschlaege in den ersten 40 Prozent der Periode, danach Ruhe.
  const erster = p < 0.16 ? Math.sin((p / 0.16) * Math.PI) : 0;
  const zweiter = p >= 0.24 && p < 0.4 ? Math.sin(((p - 0.24) / 0.16) * Math.PI) * 0.6 : 0;
  const staerke = Math.max(erster, zweiter);
  return {
    scaleX: 1 + 0.2 * staerke,
    scaleY: 1 + 0.2 * staerke,
    rotation: 0,
    tint: { lightness: 0.35 * staerke, hue: 0 },
    alpha: 1,
  };
};

/**
 * 4 Phantom: Die Figur wird durchscheinend und wieder fest.
 *
 * Die Untergrenze liegt bei 0,35 und nicht tiefer: Wer sein Schiff im Gewuehl
 * verliert, verliert die Runde. Eine Aura darf auffallen, aber nicht die
 * Spielbarkeit kosten.
 */
const phantom: AuraAnimation = (t) => {
  const w = welle(t, 1_800) * 0.5 + 0.5;
  return {
    scaleX: 1 + 0.06 * w,
    scaleY: 1 + 0.06 * w,
    rotation: 0,
    tint: { lightness: 0.2 * w, hue: 0 },
    alpha: 0.35 + 0.65 * (1 - w),
  };
};

/**
 * 5 Taumel: Langsames Kippen um die Laengsachse, mit Nachlauf.
 *
 * Zwei ueberlagerte Wellen mit unterschiedlicher Periode. Eine einzelne
 * Sinuswelle wirkt mechanisch; zwei, die nicht aufeinander passen, wirken wie
 * etwas, das im Raum schwebt und dabei driftet.
 */
const taumel: AuraAnimation = (t) => {
  const kipp = welle(t, 3_100) * 0.22 + welle(t, 1_270) * 0.08;
  return {
    scaleX: 1 - 0.1 * Math.abs(kipp),
    scaleY: 1,
    rotation: kipp,
    tint: { lightness: 0.12 * kipp, hue: 0 },
    alpha: 1,
  };
};

/**
 * 6 Sternenbrand: Unruhiges Flackern, wie etwas, das brennt.
 *
 * Drei Wellen mit teilerfremden Perioden. Weil sie nie gemeinsam an ihren
 * Anfang zurueckkehren, wiederholt sich das Muster praktisch nicht - genau das
 * unterscheidet Flackern von Pulsieren.
 */
const sternenbrand: AuraAnimation = (t) => {
  const flacker = (welle(t, 137) + welle(t, 223, 1.1) + welle(t, 331, 2.3)) / 3;
  return {
    scaleX: 1 + 0.07 * flacker,
    scaleY: 1 + 0.11 * flacker,
    rotation: 0.05 * flacker,
    tint: { lightness: 0.3 + 0.25 * flacker, hue: 18 * flacker },
    alpha: 0.85 + 0.15 * (flacker * 0.5 + 0.5),
  };
};

/**
 * 7 Singularitaet: Die Figur wird eingesaugt und springt zurueck.
 *
 * Langes, gleichmaessiges Schrumpfen, dann ein harter Ruecksprung. Der Bruch
 * ist der Effekt - eine gleichmaessige Welle waere nur wieder Pulsieren.
 */
const singularitaet: AuraAnimation = (t) => {
  const p = umlauf(t, 2_200);
  // 80 Prozent der Zeit zusammenziehen, 20 Prozent zurueckschnellen.
  const zug = p < 0.8 ? p / 0.8 : 1 - (p - 0.8) / 0.2;
  // Kubisch: Das Zusammenziehen beginnt kaum merklich und wird zum Schluss
  // schnell - so entsteht der Eindruck von Sog statt von Schrumpfen.
  const g = zug * zug * zug;
  return {
    scaleX: 1 - 0.34 * g,
    scaleY: 1 - 0.34 * g,
    rotation: g * 1.4,
    tint: { lightness: -0.25 * g, hue: -30 * g },
    alpha: 1,
  };
};

/**
 * 8 Prismaflut: die ultimative Aura.
 *
 * ## Warum sie die 60-Grad-Regel bricht
 *
 * Jede andere Aura verschiebt den Farbton hoechstens 60 Grad, damit die
 * gekaufte Farbe erkennbar bleibt (siehe Kopfkommentar). Diese hier laeuft
 * durch den **ganzen** Farbkreis und ueberschreibt die getragene Farbe damit
 * vollstaendig.
 *
 * Das ist eine bewusste, einmalige Ausnahme, kein Versehen: Bei einer Aura,
 * die 25 000 Muenzen und Stufe 50 verlangt, ist sie selbst die Aussage. Wer
 * sie traegt, zeigt nicht seine Farbe, sondern dass er sie hat. Der
 * Balance-Test kennt sie deshalb namentlich als Ausnahme - laeuft eine
 * **zweite** Aura aus der Reihe, schlaegt er an.
 *
 * ## Warum drei Rechnungen statt einer
 *
 * Die acht anderen Auren machen jeweils eine Sache. Diese ueberlagert drei,
 * und genau das macht den Unterschied zwischen "noch eine Bewegung" und
 * "die, die jeder haben will":
 *
 * 1. **Der Farblauf** dreht gleichmaessig durch alle 360 Grad. Gleichmaessig
 *    und nicht als Welle - eine Welle liefe hin und zurueck und saehe aus wie
 *    ein Farbfehler, ein Durchlauf liest sich als Regenbogen.
 * 2. **Das Funkeln** sind zwei schnelle Wellen mit teilerfremden Perioden auf
 *    der Helligkeit. Weil sie nie gemeinsam an ihren Anfang zurueckkehren,
 *    blitzt es unregelmaessig auf, statt im Takt zu pulsieren.
 * 3. **Der Herzschlag** darunter gibt der Figur eine ruhige Grundbewegung,
 *    damit das Funkeln nicht als Flackern eines Standbildes wirkt.
 *
 * ## Warum sie trotzdem lesbar bleibt
 *
 * Die Saettigung wird beim Blitz **heruntergezogen**, nicht hoch: Ein Blitz
 * ist weisses Licht, kein satteres Bunt. Und die Deckkraft bleibt bei 1 - die
 * Figur darf schillern, aber im Gewuehl nie verschwinden. Der erste Entwurf
 * liess sie zwischen 0,5 und 1 pulsieren; auf hellen Welten war die Figur
 * dann in der Haelfte der Frames kaum auszumachen.
 */
const prismaflut: AuraAnimation = (t) => {
  // Ein voller Durchlauf in 3,2 Sekunden - langsam genug, dass sich jede
  // Farbe zeigt, schnell genug, dass man den Lauf sieht statt einer Farbe.
  const durchlauf = umlauf(t, 3_200) * 360;

  // Zwei teilerfremde Perioden: Das Muster wiederholt sich praktisch nie.
  const funkeln = (welle(t, 191) + welle(t, 313, 2.1)) / 2;
  // Nur die Spitzen zaehlen als Blitz - `pow` mit hohem Exponenten schneidet
  // das ruhige Mittelfeld weg und laesst die Ausschlaege stehen.
  const blitz = Math.pow(Math.max(0, funkeln), 3);

  // Ruhiger Herzschlag darunter, halb so stark wie die eigene Aura.
  const p = umlauf(t, 1_400);
  const schlag = p < 0.18 ? Math.sin((p / 0.18) * Math.PI) * 0.5 : 0;

  return {
    scaleX: 1 + 0.1 * schlag + 0.06 * blitz,
    scaleY: 1 + 0.1 * schlag + 0.06 * blitz,
    // Leichtes Wiegen, damit die Figur nicht starr im Farblauf steht.
    rotation: welle(t, 2_300) * 0.07,
    tint: {
      // Grundhelligkeit leicht angehoben, damit die Farben leuchten, und der
      // Blitz setzt kurze weisse Spitzen darauf.
      lightness: 0.18 + 0.55 * blitz,
      hue: durchlauf,
      // Die Aura bringt ihre Farbe selbst mit - sonst bliebe sie auf dem
      // weissen Standardrumpf unsichtbar. Beim Blitz faellt sie zurueck:
      // Ein Blitz ist weisses Licht, kein satteres Bunt.
      saturation: 0.85 * (1 - blitz),
    },
    alpha: 1,
  };
};

/**
 * Alle Auren, in der Reihenfolge ihres `animIndex`.
 *
 * Wie bei `SHIP_DRAWINGS` gilt: Die Reihenfolge darf sich **nie** aendern. Ein
 * Spielstand speichert die Id, die auf diesen Index zeigt - wird hier
 * eingeschoben, traegt eine gekaufte Aura ploetzlich eine andere Bewegung.
 */
export const SHIP_ANIMATIONS: readonly AuraAnimation[] = [
  fluegelschlag,
  kreisel,
  prisma,
  herzschlag,
  phantom,
  taumel,
  sternenbrand,
  singularitaet,
  prismaflut,
];

/**
 * Der `animIndex` der Aura, die bewusst durch den ganzen Farbkreis laeuft.
 *
 * Bewusst hier und nicht im Test: Die Ausnahme gehoert zur Definition der
 * Bewegung, nicht zu ihrer Pruefung. Der Balance-Test liest sie von hier und
 * schlaegt an, sobald eine **zweite** Aura die 60-Grad-Regel bricht.
 */
export const VOLLER_FARBKREIS_INDEX = 8;

/**
 * Ein **stehendes** Bild der Aura, fuer Spieler mit `prefers-reduced-motion`.
 *
 * `prefersReducedMotion` gilt nicht nur fuer Tweens. Gerade die Prismaflut -
 * voller Farblauf mit Blitzen - ist genau das, wovor diese Einstellung
 * schuetzen soll. Sie ganz abzuschalten waere aber falsch: Wer 25 000 Muenzen
 * ausgegeben hat, soll seine Aura auch dann sehen.
 *
 * Der Kompromiss ist ein **Standbild**, kein gedaempfter Lauf: Die Aura wird
 * einmal bei einem festen Zeitpunkt ausgewertet und bleibt dann stehen. Ein
 * bloss verlangsamter Farbwechsel waere immer noch ein Farbwechsel - und
 * damit immer noch das, was die Einstellung ausschliessen soll.
 *
 * Der Zeitpunkt ist bewusst nicht 0: Dort stehen mehrere Auren in ihrer
 * Ruhelage und saehen aus, als traege die Figur gar nichts.
 */
export function stehendesBild(animation: AuraAnimation): AuraFrame {
  const frame = animation(REDUZIERT_ZEITPUNKT_MS);
  return {
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    // Farbton und eine gedaempfte Helligkeit bleiben - die Figur traegt
    // sichtbar etwas Besonderes, es bewegt sich nur nichts mehr.
    tint: { lightness: Math.min(0.2, Math.max(-0.2, frame.tint.lightness)), hue: frame.tint.hue },
    alpha: 1,
  };
}

/**
 * Der Augenblick, den `stehendesBild()` einfriert.
 *
 * 800 ms liegen bei jeder der neun Auren ausserhalb ihrer Ruhelage, aber bei
 * keiner auf einem Extrem: Die Prismaflut steht dort bei rund 90 Grad im
 * Farbkreis, der Kreisel halb gedreht.
 */
const REDUZIERT_ZEITPUNKT_MS = 800;

/**
 * Wendet eine Farbverschiebung auf die getragene Farbe an.
 *
 * Rechnet ueber HSV statt ueber die Kanaele direkt: Eine Aufhellung im
 * RGB-Raum (jeden Kanal Richtung 255) wuesche saemtliche Farben zu Weiss aus,
 * ein Farbtondreh ist dort gar nicht ausdrueckbar. In HSV bleiben Farbton und
 * Saettigung erhalten, waehrend nur die Helligkeit wandert.
 */
export function applyTintShift(color: number, shift: TintShift): number {
  const saettigung = shift.saturation ?? 0;
  if (shift.lightness === 0 && shift.hue === 0 && saettigung === 0) return color;

  const [h, s, v] = rgbZuHsv(color);
  const neuerH = (((h + shift.hue) % 360) + 360) % 360;

  // Aufhellen zieht die Saettigung mit heraus - sonst wird eine helle Farbe
  // nur greller, nicht heller.
  const neuesV = klemme(
    shift.lightness >= 0 ? v + (1 - v) * shift.lightness : v * (1 + shift.lightness),
  );
  const aufgehellt = shift.lightness > 0 ? klemme(s * (1 - shift.lightness * 0.55)) : s;
  // Die Aura hebt die Saettigung an, senkt sie aber nie: Wer eine kraeftige
  // Farbe traegt, soll sie behalten.
  const neuesS = Math.max(aufgehellt, klemme(saettigung));

  return hsvZuRgb(neuerH, neuesS, neuesV);
}

function klemme(wert: number): number {
  return Math.min(1, Math.max(0, wert));
}

function rgbZuHsv(color: number): [number, number, number] {
  const r = ((color >> 16) & 0xff) / 255;
  const g = ((color >> 8) & 0xff) / 255;
  const b = (color & 0xff) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return [h, max === 0 ? 0 : d / max, max];
}

function hsvZuRgb(h: number, s: number, v: number): number {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const acht = (wert: number): number => Math.round(klemme(wert + m) * 255);
  return (acht(r) << 16) | (acht(g) << 8) | acht(b);
}
