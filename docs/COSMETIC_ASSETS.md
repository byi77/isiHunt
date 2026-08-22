# Kosmetik-Assets und Ego-Modul

**Stand:** 2026-08-22

Die sichtbare Schiffsidentitaet ist komplett ueber stabile Shop-IDs
angebunden. Der Shop enthaelt jetzt 101 2D-Formen: die bestehenden 100
prozeduralen Silhouetten plus den recherchierten CC0-Surveyor als externen
Sprite-Pilot. Farben, Besitz, Preise, Save-Sync und Progression bleiben davon
getrennt.

## Integrierte Quellen

| Asset-ID | Kategorie | Datei(en) | Quelle/Autor | Lizenz | SHA-256 / Status |
| -------- | --------- | --------- | ------------ | ------- | ---------------- |
| `cc0-scout` | 2D-Schiffsform | `public/assets/ego/cc0-simpleanimatedship.png` | [Animated CC0 Space Ships](https://opengameart.org/content/animated-cc0-space-ships) / OpenGameArt | CC0 | `07AAE515013C343CD84FD00A526360BB5600D16634694FEB3B924A463338C5F2`, integriert |
| `cc0-kenney-flame` | Aura-Overlay, 6 Frames | `public/assets/ego/aura/cc0-flame_01.png` ... `_06.png` | [Particle Pack](https://opengameart.org/content/particle-pack-80-sprites) / Kenney | CC0 | integriert; Hashes unten |

Die Dateien wurden am 2026-08-22 heruntergeladen. Attribution ist bei CC0
nicht erforderlich; Kenney wird trotzdem als Quelle dokumentiert.

### Aura-Frame-Hashes

```text
cc0-flame_01.png  DC6B5DECD0E7E99900B0493FA1496F80E34D272F5603081634D0E99235EA9D2B
cc0-flame_02.png  BA416E354FB714A45DC665640B8DF00D3F5458F45474EEB0DB223A78FCE0FDA9
cc0-flame_03.png  195F614A39A40B3E03961887E2D817F19BF4EC47F7091A42977C9923B55D8CCF
cc0-flame_04.png  ABC25D707440796489D42E53315B89AA3DA54B1B72338E0A0B708CCDE78FC0A7
cc0-flame_05.png  3C3DCDA87C882027E268CC7DBAE9AA121EB6AF6EF24A51B140A794A7212D183A
cc0-flame_06.png  174A44AB516A969B1B4BF4DFA75D9BB370DE5B567BF8FB64966BF89862D6A45F
```

Weitere Recherchekandidaten bleiben bewusst getrennt: [Foozle Void - Main
Ship](https://foozlecc.itch.io/void-main-ship) und [Gishadev 2D Space Game
Pack](https://gisha.itch.io/2d-space-game-pack) koennen spaeter als eigene
Provider hinzukommen, wenn die konkret benoetigten Dateien und die Bundle-
groesse geprueft sind.

## Shop-Katalog

`src/config/shop.ts` ist die einzige Quelle fuer die kaufbaren Eintraege.
Jede Form besitzt eine stabile `id`, Beschreibung, Balance-Kosten und einen
unveraenderlichen `skinIndex`. Ein externer `assetId` ist optional. Der
`cc0-scout` nutzt daher dieselben Kauf-, Besitz-, Ausruestungs-, Sync- und
Reset-Regeln wie die 100 prozeduralen Formen.

Die Reihenfolge und die vorhandenen IDs werden nicht neu nummeriert. Die
Fallback-Zeichnung liegt als Index 100 in `shipShapes.ts`; wenn der externe
Sprite nicht geladen werden kann, bleibt der Shop und der laufende Run mit der
Fallback-Silhouette benutzbar.

## Austauscharchitektur

```text
Shop-ID / Save-Daten
        |
EgoAssetRegistry
   |                 |
prozedurale TS-     CC0-Pilotprovider
Fallback            Sprite + Aura-Frames
        |
Player / Shopvorschau / Profil / Ergebnis
```

`src/ui/egoAssets.ts` kennt nur Provider-Vertraege und stabile Asset-IDs.
`textures.ts` loest Formen auf; `Player` und `ShopScene` loesen Aura-Frames
auf. Kein Consumer kennt Download-URLs. Neue Packs werden registriert, ohne
SaveSystem oder Progressionsregeln zu aendern. Reduced Motion verwendet einen
statischen Aura-Frame; fehlende Texturen fallen auf die prozedurale Darstellung
zurueck.

## 3D-Entscheidung

Es gibt passende freie 3D-Quellen, zum Beispiel [OpenGameArt 3D Spaceships
Pack](https://opengameart.org/content/3d-spaceships-pack) und [LowPoly
Spaceships Pack](https://opengameart.org/content/lowpoly-spaceships-pack),
beide mit CC0-Angabe. isiHunt ist aktuell aber ein Phaser-2D-Spiel: Der Player,
Shop und alle Screens erwarten 2D-Texturen; ein echter 3D-Shop wuerde eine
zusatzliche Runtime wie Three.js, neue Kamera-/Material-/Touchlogik und eine
separate Performanceabnahme auf iOS erfordern. Deshalb wurden die 3D-Dateien
nicht ungenutzt ins Bundle gelegt oder als 2D ausgegeben. Die Registry ist fuer
einen spaeteren `3d`-Provider vorbereitet; der produktive Katalog bleibt jetzt
vollstaendig und performant in 2D.

## Abnahme

- alle 101 Formen erscheinen im Shop-Reiter und sind scrollbar;
- `cc0-scout` funktioniert in Shopvorschau, Run und Profil-Fallback;
- Prismaflut zeigt im Shop und im Run die sechs CC0-Flame-Frames;
- keine Kosmetik aendert Reichweite, Speed, Score, XP oder Coins;
- Reduced Motion, fehlendes Asset und Offline-Start bleiben sicher;
- Bundle- und Geraetepruefung erfolgt mit `npm run verify` und dem finalen
  manuellen iPhone-/iPad-Playtest.
