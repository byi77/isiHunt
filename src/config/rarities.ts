/**
 * Seltenheitsstufen - das Herzstueck des Spiels.
 *
 * Die Farben sind bewusst die aus WoW bekannten Item-Qualitaetsfarben: Spieler
 * lesen "orange = jackpot" ohne ein einziges Wort Erklaerung. Alles andere
 * (Punkte, XP, Spawn-Haeufigkeit, Tempo, Lebensdauer) skaliert entlang dieser
 * Achse: seltener = wertvoller = schneller = kuerzer sichtbar.
 */

import { BALANCE } from './balance';

export type RarityId = 'poor' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface RarityDef {
  readonly id: RarityId;
  /** Anzeigename im HUD und in der Ergebnisliste. */
  readonly label: string;
  /** Tint-Farbe (WoW-Item-Qualitaet). */
  readonly color: number;
  /** Basispunkte vor Combo-Multiplikator. */
  readonly points: number;
  /** Erfahrungspunkte fuer das Charakterlevel. */
  readonly xp: number;
  /** Relatives Spawn-Gewicht (Summe aller Gewichte = 100). */
  readonly weight: number;
  /** Wie lange das Objekt sichtbar bleibt, bevor es verblasst. */
  readonly lifetimeMs: number;
  /** Driftgeschwindigkeit in Pixel/Sekunde. */
  readonly driftSpeed: number;
  /** Trefferradius in Pixeln. */
  readonly radius: number;
}

export const RARITIES: readonly RarityDef[] = [
  {
    id: 'poor',
    label: 'Schlicht',
    color: 0x9d9d9d,
    ...BALANCE.rarities.poor,
    lifetimeMs: 5200,
    driftSpeed: 30,
    radius: 30,
  },
  {
    id: 'common',
    label: 'Gewöhnlich',
    color: 0xffffff,
    ...BALANCE.rarities.common,
    lifetimeMs: 4600,
    driftSpeed: 45,
    radius: 30,
  },
  {
    id: 'uncommon',
    label: 'Ungewöhnlich',
    color: 0x1eff00,
    ...BALANCE.rarities.uncommon,
    lifetimeMs: 3800,
    driftSpeed: 70,
    radius: 32,
  },
  {
    id: 'rare',
    label: 'Selten',
    color: 0x0070dd,
    ...BALANCE.rarities.rare,
    lifetimeMs: 3000,
    driftSpeed: 105,
    radius: 34,
  },
  {
    id: 'epic',
    label: 'Episch',
    color: 0xa335ee,
    ...BALANCE.rarities.epic,
    lifetimeMs: 2400,
    driftSpeed: 140,
    radius: 38,
  },
  {
    id: 'legendary',
    label: 'Legendär',
    color: 0xff8000,
    ...BALANCE.rarities.legendary,
    lifetimeMs: 2000,
    driftSpeed: 190,
    radius: 44,
  },
];

/** Schneller Zugriff per Id. */
export const RARITY_BY_ID: Readonly<Record<RarityId, RarityDef>> = Object.fromEntries(
  RARITIES.map((r) => [r.id, r]),
) as Record<RarityId, RarityDef>;

/** Alle Ids in Anzeigereihenfolge (schlicht -> legendaer). */
export const RARITY_IDS: readonly RarityId[] = RARITIES.map((r) => r.id);

/** Leerer Zaehler pro Seltenheit - Basis fuer Run- und Gesamtstatistik. */
export function emptyRarityCounts(): Record<RarityId, number> {
  return Object.fromEntries(RARITY_IDS.map((id) => [id, 0])) as Record<RarityId, number>;
}

/**
 * Zieht eine Seltenheit anhand der Gewichte.
 * @param rng Phasers Zufallsgenerator (seedbar -> reproduzierbare Testruns).
 */
export function rollRarity(rng: Phaser.Math.RandomDataGenerator): RarityDef {
  const total = RARITIES.reduce((sum, r) => sum + r.weight, 0);
  let ticket = rng.frac() * total;

  for (const rarity of RARITIES) {
    ticket -= rarity.weight;
    if (ticket <= 0) return rarity;
  }

  // Nur bei Fliesskomma-Rundung am Rand erreichbar.
  return RARITIES[0]!;
}
