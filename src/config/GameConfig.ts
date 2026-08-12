/**
 * Zentrale Balancing- und Layout-Konstanten.
 *
 * REGEL: Keine "magic numbers" in Scenes/Systems - jeder Wert, an dem man beim
 * Balancing dreht, steht hier oder in einer der anderen config/-Dateien.
 */

/** Interne Aufloesung. Phaser skaliert per FIT auf jedes Geraet (siehe main.ts). */
export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

/** Sicherheitsrand, in dem keine Objekte spawnen (HUD oben, Daumen unten). */
export const PLAYFIELD_PADDING_TOP = 170;
export const PLAYFIELD_PADDING_BOTTOM = 120;
export const PLAYFIELD_PADDING_X = 60;

/** Laenge eines Solo-Runs in Millisekunden. Das Duell rechnet eigen (config/challenge.ts). */
export const RUN_DURATION_MS = 60_000;

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
export const RARITY_RAYS_MIN_POINTS = 15;

/**
 * Ab wie vielen Basispunkten ein Fang den Bildschirm erschuettert und heller
 * aufblitzt (ab "episch"). Bewusst hoeher als der Strahlenkranz: Sehen darf
 * man Seltenes oft, spueren selten.
 */
export const RARITY_IMPACT_MIN_POINTS = 50;

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

// --- Combo ------------------------------------------------------------------

/**
 * Zeitfenster nach einem Fang, in dem der naechste Fang die Combo haelt.
 * Laeuft es ab, faellt die Combo auf 0. Verpasste Objekte brechen die Combo
 * NICHT - belohnt wird Flow, nicht Perfektion.
 */
export const COMBO_GRACE_MS = 2200;

/** Ab wie vielen Combo-Stufen welcher Multiplikator gilt (aufsteigend). */
export const COMBO_TIERS: readonly { readonly minCombo: number; readonly multiplier: number }[] = [
  { minCombo: 0, multiplier: 1 },
  { minCombo: 5, multiplier: 2 },
  { minCombo: 10, multiplier: 3 },
  { minCombo: 20, multiplier: 4 },
  { minCombo: 35, multiplier: 5 },
];

// --- Progression ------------------------------------------------------------

/** XP fuer den Aufstieg von `level` auf `level + 1`. */
export const xpForLevel = (level: number): number => Math.floor(80 * Math.pow(level, 1.45));

/** Talentpunkte pro Levelaufstieg. */
export const TALENT_POINTS_PER_LEVEL = 1;

// --- Persistenz -------------------------------------------------------------

export const SAVE_KEY = 'isihunt.save.v1';
export const SAVE_VERSION = 1;

// --- Entwicklung ------------------------------------------------------------

/** Debug-Tastatur nur im Dev-Build (`npm run dev`), nie im Production-Build. */
export const DEBUG_ENABLED = import.meta.env.DEV;
