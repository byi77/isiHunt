/**
 * Zentrale Balancing- und Layout-Konstanten.
 *
 * REGEL: Keine "magic numbers" in Scenes/Systems - jeder Wert, an dem man beim
 * Balancing dreht, steht hier oder in einer der anderen config/-Dateien.
 */

import * as Balance from './balance';

/** Feste Breite fuer die interne Hochformat-Aufloesung. */
export const GAME_WIDTH = 720;

/**
 * Mindesthoehe und Referenzhoehe des Layouts.
 *
 * Auf einem schmalen, hohen Handy wuerde `FIT` bei 720 x 1280 oben und unten
 * grosse Streifen lassen. Die Breite bleibt die Referenz, die interne Hoehe
 * waechst dagegen bis zur tatsaechlich verfuegbaren Portrait-Flaeche. Das
 * Layout benutzt `GAME_HEIGHT` bereits fuer alle unteren Elemente und das
 * Spielfeld - deshalb wird die zusaetzliche Hoehe automatisch sinnvoll genutzt.
 */
const DESIGN_GAME_HEIGHT = 1280;

function readPixel(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getAvailableGameSize(): { width: number; height: number } | null {
  // Beim Build oder in einem Test gibt es kein DOM. Die Referenzhoehe bleibt
  // dann der sichere Fallback.
  if (typeof document === 'undefined') return null;

  const parent = document.getElementById('game');
  if (!parent) return null;

  const style = window.getComputedStyle(parent);
  const horizontalPadding = readPixel(style.paddingLeft) + readPixel(style.paddingRight);
  const verticalPadding = readPixel(style.paddingTop) + readPixel(style.paddingBottom);
  const availableWidth = parent.clientWidth - horizontalPadding;
  const availableHeight = parent.clientHeight - verticalPadding;

  if (availableWidth <= 0 || availableHeight <= 0) return null;

  return { width: availableWidth, height: availableHeight };
}

/**
 * Berechnet die interne Hoehe aus der jetzt sichtbaren Portrait-Flaeche.
 *
 * iOS startet eine Home-Bildschirm-App gelegentlich mit einem vorlaeufigen,
 * zu kleinen Viewport und vergroessert ihn kurz danach. Deshalb darf diese
 * Berechnung nicht bei der Modul-Auswertung passieren, sondern erst direkt
 * vor `new Phaser.Game()` (siehe `main.ts`).
 */
export function configureGameHeight(): number {
  const available = getAvailableGameSize();
  if (!available) {
    GAME_HEIGHT = DESIGN_GAME_HEIGHT;
    return GAME_HEIGHT;
  }

  // Auf niedrigeren oder weniger schmalen Geraeten bleibt die bisherige
  // Aufloesung erhalten. Nur die bisher ungenutzte Hoehe wird freigegeben.
  GAME_HEIGHT = Math.max(
    DESIGN_GAME_HEIGHT,
    Math.round((available.height / available.width) * GAME_WIDTH),
  );
  return GAME_HEIGHT;
}

/** Interne Portraithoehe fuer das aktuelle Geraet. Phaser skaliert per FIT. */
export let GAME_HEIGHT = DESIGN_GAME_HEIGHT;

/** Sicherheitsrand, in dem keine Objekte spawnen (HUD oben, Daumen unten). */
export const PLAYFIELD_PADDING_TOP = 170;
export const PLAYFIELD_PADDING_BOTTOM = 120;
export const PLAYFIELD_PADDING_X = 60;

/** Laenge eines Solo-Runs in Millisekunden. Das Duell rechnet eigen (config/challenge.ts). */
export const RUN_DURATION_MS = 90_000;

/** Countdown vor dem Start (3 - 2 - 1 - LOS). */
export const COUNTDOWN_STEPS = 3;
export const COUNTDOWN_STEP_MS = 700;

// --- Spielfigur -------------------------------------------------------------

/** Maximale Bewegungsgeschwindigkeit in Pixel/Sekunde. */
export const PLAYER_BASE_SPEED = 620;
/** Wie schnell die Figur ihre Zielgeschwindigkeit erreicht (hoeher = direkter). */
export const PLAYER_ACCEL_RESPONSE = 14;
/** Radius, innerhalb dessen ein Objekt eingesammelt wird. */
export const PLAYER_BASE_COLLECT_RADIUS = 46;
/** Ab dieser Distanz zum Finger gilt "Ziel erreicht" - verhindert Zittern. */
export const POINTER_DEADZONE = 6;
/** Distanz zum Finger, ab der volle Geschwindigkeit erreicht wird. */
export const POINTER_THROTTLE_DISTANCE = 90;
/** Mindesttempo nahe am Finger, damit die Figur nicht komplett stehen bleibt. */
export const POINTER_THROTTLE_MIN = 0.15;
/** Ab dieser Geschwindigkeit (px/s) zieht die Figur eine Lichtspur. */
export const PLAYER_TRAIL_MIN_SPEED = 60;

/** Grundgeschwindigkeit des Magnet-Sogs in Pixel/Sekunde. */
export const MAGNET_PULL_SPEED = 420;

// --- Talent-Feedback -------------------------------------------------------

/** Breite des sichtbaren Reichweitenrings fuer das Reichweite-Talent. */
export const TALENT_REACH_RING_WIDTH = 5;
/** Grundtransparenz des Reichweitenrings - bewusst deutlich sichtbar. */
export const TALENT_REACH_RING_ALPHA = 0.72;
/** Breite des Magnetfeldrings. */
export const TALENT_MAGNET_FIELD_WIDTH = 4;
/** Transparenz des Magnetfeldrings. */
export const TALENT_MAGNET_FIELD_ALPHA = 0.58;
/** Maximale Zahl gleichzeitig gezeichneter Soglinien. */
export const TALENT_MAGNET_MAX_LINES = 12;
/** Breite einer einzelnen Soglinie. */
export const TALENT_MAGNET_LINE_WIDTH = 4;
/** Transparenz einer Soglinie bei maximaler Naehe. */
export const TALENT_MAGNET_LINE_ALPHA = 0.9;
/** Kleinster Abstand zum Schiff, damit Linien nicht unter dem Rumpf starten. */
export const TALENT_MAGNET_LINE_START_OFFSET = 28;
/** Breite der sichtbaren Sogstreifen direkt am Relikt. */
export const TALENT_MAGNET_ORB_STREAK_WIDTH = 4;
/** Maximale Laenge der sichtbaren Sogstreifen direkt am Relikt. */
export const TALENT_MAGNET_ORB_STREAK_LENGTH = 48;
/** Transparenz der Magnetboegen und Relikt-Nachlaufstreifen. */
export const TALENT_MAGNET_ORB_ALPHA = 0.86;
/** Breite des sichtbaren Combo-/Fokus-Rings. */
export const TALENT_FOCUS_RING_WIDTH = 5;
/** Transparenz des sichtbaren Combo-/Fokus-Rings. */
export const TALENT_FOCUS_RING_ALPHA = 0.9;
/** Grundlaenge der Bewegungstreifen hinter dem Schiff. */
export const TALENT_SPEED_STREAK_BASE_LENGTH = 34;
/** Zusatzlaenge der Bewegungstreifen bei voller Geschwindigkeit. */
export const TALENT_SPEED_STREAK_SPEED_LENGTH = 58;
/** Zusatzlaenge fuer das maximal ausgebaute Flinkheit-Talent. */
export const TALENT_SPEED_STREAK_TALENT_LENGTH = 26;
/** Breite der Bewegungstreifen. */
export const TALENT_SPEED_STREAK_WIDTH = 5;
/** Transparenz der Bewegungstreifen ohne Flinkheit-Talent. */
export const TALENT_SPEED_STREAK_BASE_ALPHA = 0.26;
/** Zusatztransparenz der Bewegungstreifen durch Flinkheit. */
export const TALENT_SPEED_STREAK_TALENT_ALPHA = 0.54;

// --- Navigation ------------------------------------------------------------

/** Daempfung des Scroll-Nachlaufs pro 60-Hz-Frame. */
export const SCROLL_INERTIA_DECAY_PER_FRAME = 0.92;
/** Unter diesem Tempo endet der Nachlauf. */
export const SCROLL_INERTIA_MIN_SPEED = 8;
/** Schutz gegen unkontrollierbare Spruenge bei schnellen Wischern. */
export const SCROLL_INERTIA_MAX_SPEED = 1800;
/** Glaettung der aus Pointerbewegungen abgeleiteten Geschwindigkeit. */
export const SCROLL_POINTER_VELOCITY_SMOOTHING = 0.55;

// --- Darstellungsschwellen --------------------------------------------------

/**
 * Ab wie vielen Basispunkten ein Relikt einen Strahlenkranz bekommt (ab
 * "selten"). Schwelle statt Liste, damit neue Seltenheitsstufen automatisch
 * richtig einsortiert werden.
 */
export const RARITY_RAYS_MIN_POINTS = Balance.BALANCE.rarities.rare.points;

/**
 * Ab wie vielen Basispunkten ein Fang den Bildschirm erschuettert und heller
 * aufblitzt (ab "episch"). Bewusst hoeher als der Strahlenkranz: Sehen darf
 * man Seltenes oft, spueren selten.
 */
export const RARITY_IMPACT_MIN_POINTS = Balance.BALANCE.rarities.epic.points;

// --- Spawning ---------------------------------------------------------------

/** Grundintervall zwischen zwei Spawns in ms. */
export const SPAWN_INTERVAL_MS = 620;
/** Am Ende des Runs ist das Intervall um diesen Faktor kuerzer (Endspurt). */
export const SPAWN_RAMP_FACTOR = 0.55;
/** Obergrenze gleichzeitig aktiver Objekte. */
export const MAX_ACTIVE_COLLECTIBLES = 14;
/** Mindestabstand eines neuen Spawns zur Figur - kein Gratis-Einsammeln. */
export const SPAWN_MIN_DISTANCE_TO_PLAYER = 150;
/**
 * Wie viele Positionen je Spawn gezogen werden. Es werden immer alle gezogen,
 * auch wenn die erste schon passt - der Grund steht in SpawnSystem.ts.
 */
export const SPAWN_POSITION_CANDIDATES = 12;

// --- Phase-5-Balancing ------------------------------------------------------

/** Hindernisse starten als seltene Warnung und bleiben bis zum Endspurt lesbar. */
export const WORLD_OBSTACLE_BASE_CHANCE = 0.03;
export const WORLD_OBSTACLE_END_CHANCE = 0.08;
/** Bremsfelder sollen einen Fehler spürbar, aber nicht runentscheidend machen. */
export const WORLD_BRAKE_DURATION_MS = 700;
export const WORLD_BRAKE_FACTOR = 0.72;
/** Späte Welten bestrafen einen Treffer mit einem kurzen Zeitverlust. */
export const WORLD_PENALTY_MS = 800;
/** Abgeschwächte Weltunterschiede gegenüber dem ersten Phase-5-Prototyp. */
export const WORLD_INERTIA_FACTOR = 0.8;
export const WORLD_DRIFT_MULTIPLIER = 1.15;
export const WORLD_SHORT_LIFETIME_SCALE = 0.85;
export const WORLD_RARE_LIFETIME_SCALE = 0.75;
export const WORLD_RARE_PROMOTION_CHANCE = 0.18;

export const RARE_CATCHES_PER_BONUS_COIN = Balance.RARE_CATCHES_PER_BONUS_COIN;
export const EPIC_CATCHES_PER_BONUS_STEP = Balance.EPIC_CATCHES_PER_BONUS_STEP;
export const EPIC_BONUS_COINS_PER_STEP = Balance.EPIC_BONUS_COINS_PER_STEP;
export const LEGENDARY_BONUS_COINS = Balance.LEGENDARY_BONUS_COINS;

/** +-Streuung auf das Spawn-Intervall, damit der Takt nicht metronomisch wirkt. */
export const SPAWN_INTERVAL_JITTER_MIN = 0.8;
export const SPAWN_INTERVAL_JITTER_MAX = 1.2;
/** Obergrenze der Hindernis-Wahrscheinlichkeit, auch bei hoher Schwierigkeit. */
export const WORLD_OBSTACLE_MAX_CHANCE = 0.24;
/** Wie stark hohe Schwierigkeit die Lebensdauer eines Objekts mindestens kuerzt. */
export const WORLD_LIFETIME_SCALE_FLOOR = 0.55;
/** Wie stark jeder Schwierigkeitsschritt ueber 1 die Lebensdauer kuerzt. */
export const WORLD_LIFETIME_SCALE_PER_DIFFICULTY = 0.35;

// --- Combo ------------------------------------------------------------------

/**
 * Zeitfenster nach einem Fang, in dem der naechste Fang die Serie haelt.
 * Laeuft es ab, faellt die Serie auf 0. Verpasste Objekte brechen sie NICHT -
 * belohnt wird Flow, nicht Perfektion.
 *
 * **Warum 900 und nicht mehr.** Vorher standen hier 1800 ms. Relikte
 * erscheinen aber alle 620 ms (am Rundenende alle 341 ms) - pro Zeitfenster
 * kamen also 2,9 bis 5,3 neue. Die Serie riss nur, wenn man fast zwei
 * Sekunden lang gar nichts fing; im automatisierten Playtest lief sie
 * regelmaessig ueber 180 Faenge ohne einen einzigen Abriss. Damit gab es nie
 * einen Moment, in dem eine Entscheidung noetig war.
 *
 * Mit 900 ms kommt im Schnitt gerade ein Relikt pro Fenster. Zusammen mit
 * `SERIES_RAISING_MIN_RARITY` entsteht daraus die eigentliche Taktik: Farbige
 * Relikte erscheinen nur alle 1,6 s (Rundenanfang) bis 0,9 s (Rundenende) -
 * oft zu selten fuer das Fenster. Dann rettet ein weisses die Serie, ohne sie
 * zu steigern.
 *
 * **Beim Nachjustieren hier ansetzen.** Ist der Wert fuer juengere Spieler zu
 * hart, zuerst diesen erhoehen (z. B. auf 1100) - er wirkt direkter als jede
 * andere Stellschraube. Das Talent "Ausdauer" verlaengert ihn zusaetzlich.
 */
export const COMBO_GRACE_MS = 900;

export const SERIES_RAISING_MIN_RARITY_INDEX = Balance.SERIES_RAISING_MIN_RARITY_INDEX;
export const COMBO_TIERS = Balance.COMBO_TIERS;

/**
 * Ab welcher Seltenheit ein Fang die Serie **steigert**.
 *
 * Darunter (schlicht, gewoehnlich - die weissen und grauen Relikte) haelt der
 * Fang die Serie nur am Leben, ohne sie zu erhoehen. Das ist der taktische
 * Kern: Wer keinen farbigen Fang in Reichweite hat, nimmt bewusst ein
 * weisses, um die Kette nicht zu verlieren - und bezahlt dafuer mit einer
 * Stufe, die nicht steigt.
 *
 * Der Wert ist ein Index in `RARITY_IDS` (0 = schlicht ... 5 = legendaer).
 */

/**
 * Ab welcher Serie welcher Punktemultiplikator gilt.
 *
 * **Warum die Schwellen so niedrig liegen.** Sie waren bis 2026-08-19 auf
 * 5/10/20/35/50 gesetzt - ausgelegt fuer das alte System, in dem *jeder* Fang
 * die Serie steigerte. Seit nur noch farbige Relikte steigern (38 Prozent
 * aller Spawns) und das Zeitfenster halbiert ist, braeuchte Serie 10 rund 27
 * Faenge am Stueck; gemessen reisst die Serie aber alle 17. Vier der fuenf
 * Stufen waren damit unerreichbar, und der Serienbonus brachte ueber einen
 * ganzen Run nur noch 3,6 Prozent mehr Punkte - eine Belohnung, die niemand
 * bemerkt.
 *
 * Mit diesen Werten sind die unteren Stufen im normalen Spiel erreichbar, die
 * oberen bleiben ein Ziel. Ueber einen Run ergibt das rund 23 Prozent
 * (simuliert ueber 400 Runden a 183 Faenge).
 *
 * Der Multiplikator wirkt **nur auf Punkte**, nicht auf XP - die haengen an
 * der Zahl der Faenge, damit Fortschritt und Bestenliste nicht dieselbe
 * Schwankung teilen.
 */
/**
 * Die Schleife, die der Spieler ab einer laufenden Serie hinter sich herzieht.
 *
 * **Warum die Laenge gedeckelt ist.** Eine Spur, die unbegrenzt mitwaechst,
 * verdeckt auf einem Handy im Hochformat genau das, was man fangen will - und
 * die Steuerung ist ausdruecklich so gebaut, dass die Hand das Ziel nicht
 * verdeckt (`InputController`). Ab Stufe 4 waechst deshalb nur noch die Farbe
 * weiter, nicht die Laenge. Das ist auch lesbarer: "lang" von "sehr lang" zu
 * unterscheiden gelingt im Spiel niemandem, "gold statt tuerkis" sofort.
 *
 * `lifespanMs` steuert die Laenge - die Spur ist ein Partikel-Emitter, ihre
 * sichtbare Laenge ergibt sich daraus, wie lange ein Partikel lebt.
 */
export const SERIES_TRAIL_TIERS: readonly {
  readonly minSeries: number;
  readonly lifespanMs: number;
  readonly color: number;
  /** Abstand zwischen zwei Partikeln in ms - kleiner heisst dichtere Spur. */
  readonly frequencyMs: number;
  readonly scale: number;
  readonly alpha: number;
  /** Stuetzpunkte der gezeichneten Linie - mehr Punkte, laengere Schleife. */
  readonly points: number;
}[] = [
  {
    minSeries: 1,
    lifespanMs: 520,
    color: 0x6fc2ff,
    frequencyMs: 22,
    scale: 0.9,
    alpha: 0.9,
    points: 12,
  },
  {
    minSeries: 5,
    lifespanMs: 700,
    color: 0x3ce0ff,
    frequencyMs: 18,
    scale: 1,
    alpha: 0.95,
    points: 16,
  },
  {
    minSeries: 10,
    lifespanMs: 900,
    color: 0x35d6c3,
    frequencyMs: 15,
    scale: 1.1,
    alpha: 1,
    points: 20,
  },
  {
    minSeries: 20,
    lifespanMs: 1100,
    color: 0x7cff5c,
    frequencyMs: 13,
    scale: 1.2,
    alpha: 1,
    points: 24,
  },
  {
    minSeries: 35,
    lifespanMs: 1300,
    color: 0xffc738,
    frequencyMs: 11,
    scale: 1.3,
    alpha: 1,
    points: 28,
  },
  {
    minSeries: 50,
    lifespanMs: 1300,
    color: 0xff8a2b,
    frequencyMs: 10,
    scale: 1.4,
    alpha: 1,
    points: 28,
  },
];

/**
 * Staerke der Schleifenlinie am Schiff, in Pixeln. Nach hinten laeuft sie
 * linear auf 0 aus.
 */
export const SERIES_TRAIL_LINE_WIDTH = 18;

/**
 * Breite der weichen Aussenkontur relativ zur lesbaren Kernlinie.
 *
 * Die Aussenkontur darf leuchten, aber nicht die Kante verschlucken. Sie
 * bleibt deshalb eine eigene, deutlich transparentere Graphics-Spur.
 */
export const SERIES_TRAIL_GLOW_WIDTH_MULTIPLIER = 2.4;

/** Maximale Transparenz der weichen Aussenkontur relativ zur Kernlinie. */
export const SERIES_TRAIL_GLOW_ALPHA = 0.3;

/** Mindesttransparenz der Kernlinie am hintersten Ende der Schleife. */
export const SERIES_TRAIL_CORE_MIN_ALPHA = 0.5;

/**
 * Abstand zwischen zwei Stuetzpunkten der Schleife.
 *
 * Fest in Millisekunden statt je Frame: Sonst haengt die Schleifenlaenge an
 * der Bildrate - bei 120 Hz waere sie halb so lang wie bei 60 Hz, obwohl das
 * Schiff denselben Weg zurueckgelegt hat (Regel 5).
 */
export const SERIES_TRAIL_SAMPLE_MS = 26;

/** Abtastpunkte je Quadratic-Bezier-Teilkurve fuer eine weiche Spur. */
export const SERIES_TRAIL_SMOOTHING_DIVISIONS = 8;

/**
 * Wie viele Abtastungen im Stillstand vergehen, bis die Schleife hinten einen
 * Punkt verliert.
 *
 * Ohne diese Traegheit verschwand die Schleife bei jedem kurzen Stopp: Stufe 1
 * hat nur 10 Punkte, bei einem Abbau je Abtastung war sie nach 260 ms leer.
 * Solche Stopps passieren beim Spielen staendig - die Schleife flackerte.
 */
export const SERIES_TRAIL_IDLE_TICKS_PER_DROP = 4;

/**
 * Der ruhige Grundzustand ohne Serie.
 *
 * Muss deutlich schwaecher sein als die erste Stufe, damit der Sprung bei
 * Serie 1 ueberhaupt auffaellt.
 */
export const SERIES_TRAIL_BASE_LIFESPAN_MS = 500;
export const SERIES_TRAIL_BASE_FREQUENCY_MS = 26;
export const SERIES_TRAIL_BASE_SCALE = 0.58;
export const SERIES_TRAIL_BASE_ALPHA = 0.65;

// --- Progression ------------------------------------------------------------

/** Hoechste erreichbare Charakterstufe. */
export const MAX_LEVEL = Balance.MAX_LEVEL;

/**
 * Wie viel XP ein durchschnittlicher Run einbringt.
 *
 * Gemessen ueber vier simulierte Runden in der Startwelt (2026-08-19):
 * rund 183 Faenge je Run, im Mittel 2146 XP. Die Serien-Umstellung senkte
 * zwar den Score, nicht aber die XP - die haengen an der Zahl der Faenge,
 * nicht am Multiplikator.
 *
 * Der Wert ist die Bezugsgroesse der XP-Kurve: `xpForLevel` wird als
 * "so viele Runs" formuliert und daraus umgerechnet. Aendert sich das
 * Fangaufkommen spuerbar, gehoert dieser Wert nachgemessen - dann stimmt die
 * ganze Kurve wieder.
 */
export const XP_PER_RUN_REFERENCE = Balance.XP_PER_RUN_REFERENCE;

/**
 * Wie viele Runs ein Levelaufstieg kosten soll.
 *
 * **Warum nicht durchgehend gleich.** Die ersten Level bleiben bewusst
 * schnell: Wer neu anfaengt, soll im ersten Run mehrfach aufsteigen und den
 * Fortschritt sofort spueren. Ab Level 10 pendelt sich die Kurve bei gut zwei
 * Runs ein und steigt bis zur Maximalstufe nur noch flach auf drei.
 *
 * Vorher stand hier `750*sqrt(L) + 8*L^1.25`. Gemessen ergab das 0,4 Runs auf
 * Level 1 und 4,6 auf Level 99 - der Anfang war zu schnell (mehrere Aufstiege
 * pro Run), das Ende zu zaeh.
 */
/** Ab dieser Stufe ist die Anlaufphase vorbei. */

/** XP fuer den Aufstieg von `level` auf `level + 1`; auf Maximalstufe 0. */
export const xpForLevel = Balance.xpForLevel;

/** Veralteter Speicherwert; neue Talentkäufe laufen vollständig über Coins. */
export const TALENT_POINTS_PER_LEVEL = Balance.TALENT_POINTS_PER_LEVEL;
/** Veraltete Umrechnung fuer Spielstände aus der Talentpunkt-Phase. */
export const COINS_PER_EXTRA_TALENT_POINT = Balance.COINS_PER_EXTRA_TALENT_POINT;
/** Grundbelohnung fuer jede abgeschlossene Solo-Runde. */
export const COINS_PER_RUN = Balance.COINS_PER_RUN;
/** Alle 25 Relikte gibt es einen kleinen Fangbonus. */
export const COINS_PER_COLLECTION_STEP = Balance.COINS_PER_COLLECTION_STEP;
export const COLLECTION_STEP_SIZE = Balance.COLLECTION_STEP_SIZE;
export const MAX_COLLECTION_BONUS_COINS = Balance.MAX_COLLECTION_BONUS_COINS;
/** Einmalige Belohnung je neu freigeschaltetem Achievement. */
export const COINS_PER_ACHIEVEMENT = Balance.COINS_PER_ACHIEVEMENT;
/** Coins pro Levelaufstieg als dauerhafte Spielbelohnung. */
export const COINS_PER_LEVEL = Balance.COINS_PER_LEVEL;
/**
 * Kosten eines Talent-Resets.
 *
 * Bewusst deutlich unter dem ersten Rangkauf (250): ein frueher Fehlkauf soll
 * korrigierbar bleiben, ohne dass der Reset selbst wie eine zweite Strafe
 * wirkt. Bei vollem Ausbau (18.950 Coins Gesamtkosten) bleibt der Reset
 * ohnehin fast kostenlos - die Untergrenze zaehlt fuer Einsteiger.
 * S. docs/BALANCE_2026-08-17.md Abschnitt 3.
 */
export const TALENT_RESET_COST = Balance.TALENT_RESET_COST;
/** Einmalige Begruessung pro Kalendertag fuer einen echten Profil-Login. */
export const DAILY_LOGIN_BONUS_COINS = Balance.DAILY_LOGIN_BONUS_COINS;
/** Fester Bonus für den ersten abgeschlossenen Tageslauf des Tages. */
export const DAILY_COMPLETION_BONUS_COINS = Balance.DAILY_COMPLETION_BONUS_COINS;
export const DAILY_COMPLETION_BONUS_XP = Balance.DAILY_COMPLETION_BONUS_XP;
/** Drei Leistungsstufen machen den Tageslauf wertvoll, aber endlich. */
export const DAILY_SCORE_BONUS_STEP = Balance.DAILY_SCORE_BONUS_STEP;
export const DAILY_SCORE_BONUS_COINS = Balance.DAILY_SCORE_BONUS_COINS;
export const DAILY_SCORE_BONUS_XP = Balance.DAILY_SCORE_BONUS_XP;
export const DAILY_SCORE_BONUS_MAX_TIERS = Balance.DAILY_SCORE_BONUS_MAX_TIERS;

// --- Persistenz -------------------------------------------------------------

export const SAVE_KEY = 'isihunt.save.v1';
export const SAVE_VERSION = 8;

// --- Entwicklung ------------------------------------------------------------

/** Debug-Tastatur nur im Dev-Build (`npm run dev`), nie im Production-Build. */
export const DEBUG_ENABLED = import.meta.env.DEV;
/** Browser-Performance-Gate mit production-nahem Renderer, aber DEV-Hooks. */
export const PERFORMANCE_MODE = import.meta.env.MODE === 'performance';

/**
 * Versionsnummer, bei jedem Commit hochgezaehlt (scripts/bump-version.mjs).
 *
 * Sie steht im Menue, damit beim Test auf dem Handy ohne Zweifel feststeht,
 * welcher Stand gerade laeuft - Browser-Caches auf iOS sind hartnaeckig, und
 * ein Fehlerbericht zu einem alten Stand kostet mehr Zeit als diese Zeile.
 */
export const APP_VERSION = __APP_VERSION__;
