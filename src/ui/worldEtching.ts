import Phaser from 'phaser';

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

  // Ein kleines, statisches Erkennungszeichen je Welt. Es bleibt am Rand und
  // kostet waehrend des Runs keine zusaetzliche Zeichnung pro Frame.
  const markX = edgeX + direction * 35;
  const markY = baseY - 58;
  graphics.lineStyle(1.6, accent, 0.26);
  switch (variant) {
    case 0: // Sternenweide: drei ruhige Sternkreuze.
      for (let index = 0; index < 3; index++) {
        const x = markX + direction * index * 17;
        const y = markY + (index % 2) * 12;
        graphics.strokeLineShape(new Phaser.Geom.Line(x - 3, y, x + 3, y));
        graphics.strokeLineShape(new Phaser.Geom.Line(x, y - 3, x, y + 3));
      }
      break;
    case 1: // Eisring: gebrochene Lichtkante.
      graphics.strokePoints([
        { x: markX, y: markY + 22 },
        { x: markX + direction * 12, y: markY },
        { x: markX + direction * 23, y: markY + 15 },
        { x: markX + direction * 32, y: markY - 8 },
      ]);
      break;
    case 2: // Glutnebel: aufsteigende Funken.
      for (let index = 0; index < 4; index++) {
        graphics.fillStyle(accent, 0.32);
        graphics.fillCircle(markX + direction * index * 10, markY + 25 - index * 9, 2);
      }
      break;
    case 3: // Nullsektor: versetzter Riss.
      graphics.strokePoints([
        { x: markX, y: markY - 8 },
        { x: markX + direction * 15, y: markY + 6 },
        { x: markX + direction * 8, y: markY + 15 },
        { x: markX + direction * 28, y: markY + 28 },
      ]);
      break;
    case 4: // Sonnenkrone: Strahlenfaecher.
      for (let index = -1; index <= 1; index++) {
        graphics.strokeLineShape(
          new Phaser.Geom.Line(
            markX,
            markY + 18,
            markX + direction * (28 + index * 4),
            markY + index * 15,
          ),
        );
      }
      break;
    case 5: // Mondschmiede: ineinanderliegende Krater.
      graphics.strokeCircle(markX + direction * 12, markY + 10, 18);
      graphics.strokeCircle(markX + direction * 17, markY + 5, 7);
      break;
    case 6: // Kristallbruch: gegabelte Bruchlinie.
      graphics.strokePoints([
        { x: markX, y: markY + 24 },
        { x: markX + direction * 13, y: markY + 7 },
        { x: markX + direction * 26, y: markY - 10 },
      ]);
      graphics.strokeLineShape(
        new Phaser.Geom.Line(markX + direction * 13, markY + 7, markX + direction * 29, markY + 18),
      );
      break;
    case 7: // Sturmgrenze: kurzer Zickzack-Blitz.
      graphics.strokePoints([
        { x: markX, y: markY - 8 },
        { x: markX + direction * 17, y: markY + 4 },
        { x: markX + direction * 8, y: markY + 10 },
        { x: markX + direction * 30, y: markY + 23 },
      ]);
      break;
    case 8: // Lichtkern: konzentrische Wellen.
      for (let radius = 10; radius <= 25; radius += 8) {
        graphics.strokeCircle(markX + direction * 15, markY + 10, radius);
      }
      break;
    case 9: // Horizonttor: zwei offene Boegen.
      graphics.strokeRoundedRect(left ? markX : markX - 30, markY - 8, 30, 42, 12);
      graphics.strokeLineShape(
        new Phaser.Geom.Line(markX + direction * 15, markY, markX + direction * 15, markY + 26),
      );
      break;
  }

  return graphics;
}
