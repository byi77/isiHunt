/**
 * Leitet genau ein naechstes Ziel aus dem gemeinsamen Spielstand ab.
 *
 * Ergebnis-, Menue- und Profilansichten duerfen keine eigene Ziel-Logik
 * entwickeln. Dieses Modul kennt nur die verfuegbaren Fortschrittsquellen und
 * liefert eine kurze, handlungsorientierte Aussage fuer die Oberflaeche.
 */

import { MAX_LEVEL } from '@/config/GameConfig';
import { SHIP_SHAPES } from '@/config/shop';
import { TALENTS, type TalentId } from '@/config/talents';
import { WORLDS } from '@/config/worlds';
import type { SaveData } from '@/types';

export type NextGoalKind = 'talent' | 'world' | 'shop' | 'daily' | 'run';

export interface NextGoal {
  readonly kind: NextGoalKind;
  /** Kurze Aussage, die direkt unter dem Ergebnis stehen kann. */
  readonly title: string;
  /** Erklaert, was der Spieler als Naechstes tun kann. */
  readonly detail: string;
  /** Optionaler Fortschritt fuer spaetere Balken oder Tests. */
  readonly current?: number;
  readonly target?: number;
}

interface TalentTarget {
  readonly id: TalentId;
  readonly name: string;
  readonly nextRank: number;
  readonly missingPoints: number;
}

function nextTalentTarget(save: SaveData): TalentTarget | null {
  const targets = TALENTS.filter((talent) => (save.talents[talent.id] ?? 0) < talent.maxRank)
    .map((talent) => {
      const currentRank = save.talents[talent.id] ?? 0;
      return {
        id: talent.id,
        name: talent.name,
        nextRank: currentRank + 1,
        missingPoints: Math.max(0, 1 - save.talentPoints),
      } satisfies TalentTarget;
    })
    .sort((left, right) => left.nextRank - right.nextRank);

  return targets[0] ?? null;
}

function nextWorldTarget(
  save: SaveData,
): { name: string; level: number; missingLevels: number } | null {
  const world = WORLDS.find((entry) => entry.unlockLevel > save.level);
  if (!world) return null;
  return {
    name: world.name,
    level: world.unlockLevel,
    missingLevels: Math.max(0, world.unlockLevel - save.level),
  };
}

function nextShopTarget(
  save: SaveData,
): { name: string; cost: number; missingCoins: number } | null {
  const shape = SHIP_SHAPES.filter((entry) => !save.ownedShipShapes.includes(entry.id)).sort(
    (left, right) => left.cost - right.cost,
  )[0];
  if (!shape) return null;
  return {
    name: shape.name,
    cost: shape.cost,
    missingCoins: Math.max(0, shape.cost - save.coins),
  };
}

/**
 * Liefert genau eine Prioritaet:
 *
 * 1. Ein Talent, das sofort gekauft werden kann.
 * 2. Ein nahe liegendes naechstes Gebiet.
 * 3. Der naechste Talent-Rang bzw. die naechste kaufbare Form.
 * 4. Ein stabiler Tages-/Run-Fallback, wenn die sichtbaren Systeme fertig sind.
 *
 * Es gibt keine versteckten Talentvoraussetzungen. Die Reihenfolge dient nur
 * der Darstellung und aendert weder Kaufregeln noch Freischaltungen.
 */
export function getNextGoal(save: SaveData): NextGoal {
  const talent = nextTalentTarget(save);
  if (talent && talent.missingPoints === 0) {
    return {
      kind: 'talent',
      title: `Talent bereit: ${talent.name}`,
      detail: `Rang ${talent.nextRank} jetzt fuer 1 Talentpunkt kaufen.`,
      current: save.talentPoints,
      target: 1,
    };
  }

  const world = nextWorldTarget(save);
  if (world && world.missingLevels <= 2) {
    return {
      kind: 'world',
      title: `Noch ${world.missingLevels} Level bis ${world.name}`,
      detail: `Spiele weiter, um Level ${world.level} zu erreichen und die Welt zu oeffnen.`,
      current: save.level,
      target: world.level,
    };
  }

  if (talent) {
    return {
      kind: 'talent',
      title: `Noch 1 Talentpunkt bis ${talent.name}`,
      detail: `Level weiter, dann kannst du Rang ${talent.nextRank} kaufen.`,
      current: save.talentPoints,
      target: 1,
    };
  }

  const shop = nextShopTarget(save);
  if (shop) {
    if (shop.missingCoins === 0) {
      return {
        kind: 'shop',
        title: `Neue Form bereit: ${shop.name}`,
        detail: `Oeffne den Shop und probiere deine neue Schiffsform aus.`,
        current: save.coins,
        target: shop.cost,
      };
    }
    return {
      kind: 'shop',
      title: `Noch ${shop.missingCoins.toLocaleString('de-DE')} Coins bis ${shop.name}`,
      detail: 'Jeder Run bringt dich der naechsten Form naeher.',
      current: save.coins,
      target: shop.cost,
    };
  }

  if (world) {
    return {
      kind: 'world',
      title: `Noch ${world.missingLevels} Level bis ${world.name}`,
      detail: `Spiele weiter, um Level ${world.level} zu erreichen.`,
      current: save.level,
      target: world.level,
    };
  }

  if (save.level >= MAX_LEVEL) {
    return {
      kind: 'daily',
      title: 'Naechstes Ziel: der Tageslauf',
      detail: 'Hol dir heute die zusaetzliche Belohnung und verbessere deinen Tagesrekord.',
    };
  }

  return {
    kind: 'run',
    title: 'Naechstes Ziel: noch ein Run',
    detail: 'Jeder Run bringt XP, Coins und neue Chancen auf seltene Relikte.',
  };
}
