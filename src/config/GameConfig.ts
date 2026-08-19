/**
 * Zentrale Balancing- und Layout-Konstanten.
 *
 * REGEL: Keine "magic numbers" in Scenes/Systems - jeder Wert, an dem man beim
 * Balancing dreht, steht hier oder in einer der anderen config/-Dateien.
 */

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

// --- Darstellungsschwellen --------------------------------------------------

/**
 * Ab wie vielen Basispunkten ein Relikt einen Strahlenkranz bekommt (ab
 * "selten"). Schwelle statt Liste, damit neue Seltenheitsstufen automatisch
 * richtig einsortiert werden.
 */
export const RARITY_RAYS_MIN_POINTS = 18;

/**
 * Ab wie vielen Basispunkten ein Fang den Bildschirm erschuettert und heller
 * aufblitzt (ab "episch"). Bewusst hoeher als der Strahlenkranz: Sehen darf
 * man Seltenes oft, spueren selten.
 */
export const RARITY_IMPACT_MIN_POINTS = 45;

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

/** +-Streuung auf das Spawn-Intervall, damit der Takt nicht metronomisch wirkt. */
export const SPAWN_INTERVAL_JITTER_MIN = 0.8;
export const SPAWN_INTERVAL_JITTER_MAX = 1.2;
/** Obergrenze der Hindernis-Wahrscheinlichkeit, auch bei hoher Schwierigkeit. */
export const WORLD_OBSTACLE_MAX_CHANCE = 0.24;
/** Wie stark hohe Schwierigkeit die Lebensdauer eines Objekts mindestens kuerzt. */
export const WORLD_LIFETIME_SCALE_FLOOR = 0.55;
/** Wie stark jeder Schwierigkeitsschritt ueber 1 die Lebensdauer kuerzt. */
export const WORLD_LIFETIME_SCALE_PER_DIFFICULTY = 0.35;

/** Seltene Faenge je Run, die einen zusaetzlichen Coin wert sind. */
export const RARE_CATCHES_PER_BONUS_COIN = 5;
/** Epische Faenge je Run, die den zusaetzlichen Coin-Bonus ausloesen. */
export const EPIC_CATCHES_PER_BONUS_STEP = 2;
/** Coins je ausgeloestem Epic-Bonusschritt. */
export const EPIC_BONUS_COINS_PER_STEP = 2;
/** Coins je legendaerem Fang. */
export const LEGENDARY_BONUS_COINS = 3;

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
export const SERIES_RAISING_MIN_RARITY_INDEX = 2;

/** Ab wie vielen zeitnah gefangenen Relikten welcher Punktemultiplikator gilt. */
export const COMBO_TIERS: readonly { readonly minCombo: number; readonly multiplier: number }[] = [
  { minCombo: 0, multiplier: 1 },
  { minCombo: 5, multiplier: 1.1 },
  { minCombo: 10, multiplier: 1.25 },
  { minCombo: 20, multiplier: 1.45 },
  { minCombo: 35, multiplier: 1.65 },
  { minCombo: 50, multiplier: 1.85 },
];

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
}[] = [
  { minSeries: 5, lifespanMs: 620, color: 0x4aa3ff },
  { minSeries: 10, lifespanMs: 820, color: 0x35d6c3 },
  { minSeries: 20, lifespanMs: 1020, color: 0x5ce27a },
  { minSeries: 35, lifespanMs: 1200, color: 0xffc738 },
  { minSeries: 50, lifespanMs: 1200, color: 0xfff2c4 },
];

/** Lebensdauer der Spur ohne laufende Serie - der ruhige Grundzustand. */
export const SERIES_TRAIL_BASE_LIFESPAN_MS = 420;

// --- Progression ------------------------------------------------------------

/** Hoechste erreichbare Charakterstufe. */
export const MAX_LEVEL = 100;

/** XP fuer den Aufstieg von `level` auf `level + 1`; auf Maximalstufe 0. */
export const xpForLevel = (level: number): number =>
  level >= MAX_LEVEL ? 0 : Math.floor(750 * Math.sqrt(level) + 8 * Math.pow(level, 1.25));

/** Veralteter Speicherwert; neue Talentkäufe laufen vollständig über Coins. */
export const TALENT_POINTS_PER_LEVEL = 1;
/** Veraltete Umrechnung fuer Spielstände aus der Talentpunkt-Phase. */
export const COINS_PER_EXTRA_TALENT_POINT = 10;
/** Grundbelohnung fuer jede abgeschlossene Solo-Runde. */
export const COINS_PER_RUN = 20;
/** Alle 25 Relikte gibt es einen kleinen Fangbonus. */
export const COINS_PER_COLLECTION_STEP = 3;
export const COLLECTION_STEP_SIZE = 25;
export const MAX_COLLECTION_BONUS_COINS = 18;
/** Einmalige Belohnung je neu freigeschaltetem Achievement. */
export const COINS_PER_ACHIEVEMENT = 20;
/** Coins pro Levelaufstieg als dauerhafte Spielbelohnung. */
export const COINS_PER_LEVEL = 20;
/**
 * Kosten eines Talent-Resets.
 *
 * Bewusst deutlich unter dem ersten Rangkauf (250): ein frueher Fehlkauf soll
 * korrigierbar bleiben, ohne dass der Reset selbst wie eine zweite Strafe
 * wirkt. Bei vollem Ausbau (15.650 Coins Gesamtkosten) bleibt der Reset
 * ohnehin fast kostenlos - die Untergrenze zaehlt fuer Einsteiger.
 * S. docs/BALANCE_2026-08-17.md Abschnitt 3.
 */
export const TALENT_RESET_COST = 100;
/** Einmalige Begruessung pro Kalendertag fuer einen echten Profil-Login. */
export const DAILY_LOGIN_BONUS_COINS = 25;
/** Fester Bonus für den ersten abgeschlossenen Tageslauf des Tages. */
export const DAILY_COMPLETION_BONUS_COINS = 90;
export const DAILY_COMPLETION_BONUS_XP = 750;
/** Drei Leistungsstufen machen den Tageslauf wertvoll, aber endlich. */
export const DAILY_SCORE_BONUS_STEP = 1_500;
export const DAILY_SCORE_BONUS_COINS = 20;
export const DAILY_SCORE_BONUS_XP = 250;
export const DAILY_SCORE_BONUS_MAX_TIERS = 3;

// --- Persistenz -------------------------------------------------------------

export const SAVE_KEY = 'isihunt.save.v1';
export const SAVE_VERSION = 6;

// --- Entwicklung ------------------------------------------------------------

/** Debug-Tastatur nur im Dev-Build (`npm run dev`), nie im Production-Build. */
export const DEBUG_ENABLED = import.meta.env.DEV;

/**
 * Versionsnummer, bei jedem Commit hochgezaehlt (scripts/bump-version.mjs).
 *
 * Sie steht im Menue, damit beim Test auf dem Handy ohne Zweifel feststeht,
 * welcher Stand gerade laeuft - Browser-Caches auf iOS sind hartnaeckig, und
 * ein Fehlerbericht zu einem alten Stand kostet mehr Zeit als diese Zeile.
 */
export const APP_VERSION = __APP_VERSION__;
