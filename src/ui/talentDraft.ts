/**
 * Kompakte Talentvergabe mit Plus-/Minus-Steuerung.
 *
 * Die Rangrechnung liegt bewusst in `TalentAllocationSystem`; diese Datei
 * verbindet sie nur mit Phaser. Dadurch kann der normale Talentbaum spaeter
 * dieselbe Bedienlogik verwenden, ohne Duellpunkte oder den Spielstand zu
 * kennen.
 */

import type Phaser from 'phaser';

import { DUEL_TALENT_POINT_BUDGET } from '@/config/challenge';
import { GAME_WIDTH } from '@/config/GameConfig';
import { TALENTS } from '@/config/talents';
import type { TalentId, TalentRanks } from '@/config/talents';
import {
  changeTalentRank,
  normalizeTalentRanks,
  talentPointsSpent,
} from '@/systems/TalentAllocationSystem';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import { createButton, createPanel } from '@/ui/widgets';
import type { ButtonHandle } from '@/ui/widgets';

export interface TalentDraftViewOptions {
  initialRanks: TalentRanks;
  accent: number;
  topY: number;
  onChange: (ranks: TalentRanks) => void;
}

export interface TalentDraftView {
  readonly objects: Phaser.GameObjects.GameObject[];
  refresh(ranks: TalentRanks): void;
  setEnabled(enabled: boolean): void;
}

/** Baut zehn Talentkarten in zwei Spalten auf. */
export function createTalentDraftView(
  scene: Phaser.Scene,
  options: TalentDraftViewOptions,
): TalentDraftView {
  let currentRanks = normalizeTalentRanks(options.initialRanks, DUEL_TALENT_POINT_BUDGET);
  const objects: Phaser.GameObjects.GameObject[] = [];
  const rankTexts = new Map<TalentId, Phaser.GameObjects.Text>();
  const minusButtons = new Map<TalentId, ButtonHandle>();
  const plusButtons = new Map<TalentId, ButtonHandle>();
  const summaryText = scene.add
    .text(
      GAME_WIDTH / 2,
      options.topY - 58,
      '',
      textStyle(FontSize.small, Palette.gold, { fontStyle: 'bold' }),
    )
    .setOrigin(0.5);
  objects.push(summaryText);

  const updateRank = (talentId: TalentId, delta: -1 | 1): void => {
    const next = changeTalentRank(currentRanks, talentId, delta, DUEL_TALENT_POINT_BUDGET);
    if (!next) return;
    currentRanks = next;
    options.onChange({ ...currentRanks });
    view.refresh(currentRanks);
  };

  for (const [index, talent] of TALENTS.entries()) {
    const column = Math.floor(index / 5);
    const row = index % 5;
    const centerX = column === 0 ? 180 : 540;
    const y = options.topY + row * 64;
    objects.push(
      createPanel(scene, centerX, y, 340, 58, options.accent, {
        alpha: 0.5,
        radius: 12,
      }),
    );
    objects.push(
      scene.add
        .text(
          centerX - 145,
          y - 10,
          talent.name,
          textStyle(FontSize.tiny, toCss(options.accent), {
            fontStyle: 'bold',
          }),
        )
        .setOrigin(0, 0.5),
    );
    objects.push(
      scene.add
        .text(centerX - 145, y + 15, talent.perRank, textStyle(13, Palette.gold))
        .setOrigin(0, 0.5),
    );

    const rankText = scene.add
      .text(centerX + 20, y, 'R0', textStyle(FontSize.tiny, Palette.ink, { fontStyle: 'bold' }))
      .setOrigin(0.5);
    rankTexts.set(talent.id, rankText);
    objects.push(rankText);

    const minus = createButton(scene, centerX + 72, y, '-', () => updateRank(talent.id, -1), {
      width: 48,
      height: 48,
      accent: 0x9aa3bd,
      fontSize: FontSize.body,
    });
    const plus = createButton(scene, centerX + 132, y, '+', () => updateRank(talent.id, 1), {
      width: 48,
      height: 48,
      accent: options.accent,
      fontSize: FontSize.body,
    });
    minusButtons.set(talent.id, minus);
    plusButtons.set(talent.id, plus);
    objects.push(minus.container, plus.container);
  }

  const view: TalentDraftView = {
    objects,
    refresh(ranks): void {
      currentRanks = normalizeTalentRanks(ranks, DUEL_TALENT_POINT_BUDGET);
      const spent = talentPointsSpent(currentRanks);
      summaryText.setText(
        `DUELL-TALENTE  ·  ${spent}/${DUEL_TALENT_POINT_BUDGET} PUNKTE  ·  ${DUEL_TALENT_POINT_BUDGET - spent} VERBLEIBEND`,
      );

      for (const talent of TALENTS) {
        const rank = currentRanks[talent.id] ?? 0;
        rankTexts.get(talent.id)?.setText(`R${rank}/${talent.maxRank}`);
        minusButtons.get(talent.id)?.setEnabled(rank > 0);
        plusButtons
          .get(talent.id)
          ?.setEnabled(rank < talent.maxRank && spent < DUEL_TALENT_POINT_BUDGET);
      }
    },
    setEnabled(enabled): void {
      for (const talent of TALENTS) {
        const rank = currentRanks[talent.id] ?? 0;
        minusButtons.get(talent.id)?.setEnabled(enabled && rank > 0);
        plusButtons
          .get(talent.id)
          ?.setEnabled(
            enabled &&
              rank < talent.maxRank &&
              talentPointsSpent(currentRanks) < DUEL_TALENT_POINT_BUDGET,
          );
      }
    },
  };

  view.refresh(currentRanks);
  return view;
}
