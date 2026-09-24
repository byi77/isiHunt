import type Phaser from 'phaser';

/**
 * Ruhige, gezeichnete Weltkonturen fuer die Spielfeldkulisse.
 *
 * Die Linien liegen ausschliesslich in den aeusseren Randzonen. Sie geben
 * jeder Welt eine eigene Formensprache, ohne Relikte oder Eingaben zu
 * verdecken. Die Zeichnung entsteht einmal beim Szenenstart.
 */
export function createWorldEtching(
  scene: Phaser.Scene,
  width: number,
  height: number,
  variant: number,
  accent: number,
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics();
  graphics.setName('world-illustration-etching');
  graphics.lineStyle(1.5, accent, 0.16);

  const left = variant % 2 === 0;
  const edgeX = left ? 10 : width - 10;
  const direction = left ? 1 : -1;
  const baseY = height * 0.72;

  if (variant === 1 || variant === 6) {
    // Eissplitter: offene, kantige Kristallkonturen.
    for (let index = 0; index < 4; index++) {
      const x = edgeX + direction * index * 11;
      const y = baseY + index * 13;
      const points = [
        { x, y: y + 34 },
        { x: x + direction * 7, y: y + 12 },
        { x: x + direction * 5, y },
        { x: x + direction * 14, y: y + 15 },
        { x: x + direction * 21, y: y + 20 },
      ];
      graphics.beginPath();
      graphics.moveTo(points[0]!.x, points[0]!.y);
      for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
      graphics.strokePath();
    }
  } else if (variant === 2 || variant === 4 || variant === 8) {
    // Gas- und Sonnenwelten: geschichtete, fliessende Stromlinien.
    for (let band = 0; band < 5; band++) {
      graphics.beginPath();
      for (let step = 0; step <= 18; step++) {
        const t = step / 18;
        const x = edgeX + direction * t * width * 0.2;
        const y = baseY + band * 12 + Math.sin(t * Math.PI * 2 + band * 0.7) * 7;
        if (step === 0) graphics.moveTo(x, y);
        else graphics.lineTo(x, y);
      }
      graphics.strokePath();
    }
  } else if (variant === 3 || variant === 9) {
    // Raumriss und Tor: unterbrochene, versetzte Rahmenlinien.
    for (let frame = 0; frame < 4; frame++) {
      const x = left ? edgeX + frame * 13 : edgeX - frame * 13 - 30;
      const y = baseY + frame * 10;
      graphics.strokeRect(x, y, 30, 62);
      graphics.beginPath();
      graphics.moveTo(left ? x + 18 : x + 12, y + 62);
      graphics.lineTo(left ? x + 30 : x, y + 48);
      graphics.strokePath();
    }
  } else {
    // Ruhige und sturmgepraegte Welten: topografische, gebrochene Bahnen.
    for (let band = 0; band < 5; band++) {
      const y = baseY + band * 13;
      graphics.beginPath();
      graphics.moveTo(edgeX, y + 15);
      graphics.lineTo(edgeX + direction * 18, y + 4);
      graphics.lineTo(edgeX + direction * 34, y + 11);
      graphics.lineTo(edgeX + direction * 48, y - 1);
      graphics.strokePath();
    }
  }

  return graphics;
}
