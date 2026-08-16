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

// --- Combo ------------------------------------------------------------------

/**
 * Zeitfenster nach einem Fang, in dem der naechste Fang die Combo haelt.
 * Laeuft es ab, faellt die Combo auf 0. Verpasste Objekte brechen die Combo
 * NICHT - belohnt wird Flow, nicht Perfektion.
 */
export const COMBO_GRACE_MS = 1800;

/** Ab wie vielen zeitnah gefangenen Relikten welcher Punktemultiplikator gilt. */
export const COMBO_TIERS: readonly { readonly minCombo: number; readonly multiplier: number }[] = [
  { minCombo: 0, multiplier: 1 },
  { minCombo: 5, multiplier: 1.1 },
  { minCombo: 10, multiplier: 1.25 },
  { minCombo: 20, multiplier: 1.45 },
  { minCombo: 35, multiplier: 1.65 },
  { minCombo: 50, multiplier: 1.85 },
];

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
/** Kosten eines Talent-Resets. */
export const TALENT_RESET_COST = 200;
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
