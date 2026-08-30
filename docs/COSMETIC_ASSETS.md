# Kosmetik-Assets und Ego-Modul

**Stand:** 2026-08-30

Die sichtbare Schiffsidentitaet ist ueber stabile Shop-IDs angebunden. Der
Katalog enthaelt 110 Schiffsformen: 100 prozedurale 2D-Silhouetten, den
externen CC0-Piloten `cc0-scout` und neun zusaetzliche 3D-Piloten. Farben,
Besitz, Preise, Save-Sync und Progression bleiben davon getrennt.

## Integrierte Quellen

| Asset-ID                            | Kategorie              | Datei(en)                                                    | Quelle/Autor                                                                                       | Lizenz | SHA-256 / Status                                                               |
| ----------------------------------- | ---------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| `cc0-scout`                         | 2D-Schiffsform         | `public/assets/ego/cc0-simpleanimatedship.png`               | [Animated CC0 Space Ships](https://opengameart.org/content/animated-cc0-space-ships) / OpenGameArt | CC0    | `07AAE515013C343CD84FD00A526360BB5600D16634694FEB3B924A463338C5F2`, integriert |
| `cc0-kenney-flame`                  | Aura-Overlay, 6 Frames | `public/assets/ego/aura/cc0-flame_01.png` ... `_06.png`      | [Particle Pack](https://opengameart.org/content/particle-pack-80-sprites) / Kenney                 | CC0    | integriert; Hashes unten                                                       |
| `cc0-3d-ship-1` ... `cc0-3d-ship-9` | 3D-Shopvorschau        | `public/assets/ego3d/cc0-spaceships/shipN.obj` + `shipN.mtl` | [3D Spaceships pack](https://opengameart.org/content/3d-spaceships-pack) / OpenGameArt             | CC0    | integriert, lazy geladen                                                       |

Die Dateien wurden am 2026-08-22 heruntergeladen. Attribution ist bei CC0
nicht erforderlich; OpenGameArt und Kenney werden trotzdem als Quellen
dokumentiert. Das 3D-Paket enthaelt neun unge- bzw. einfarbige Low-Poly-
Modelle ohne externe Texturen. Die Runtime setzt das Material und die
Shop-Farbe zur Laufzeit, wodurch die Modelle klein bleiben.

### Aura-Frame-Hashes

```text
cc0-flame_01.png  DC6B5DECD0E7E99900B0493FA1496F80E34D272F5603081634D0E99235EA9D2B
cc0-flame_02.png  BA416E354FB714A45DC665640B8DF00D3F5458F45474EEB0DB223A78FCE0FDA9
cc0-flame_03.png  195F614A39A40B3E03961887E2D817F19BF4EC47F7091A42977C9923B55D8CCF
cc0-flame_04.png  ABC25D707440796489D42E53315B89AA3DA54B1B72338E0A0B708CCDE78FC0A7
cc0-flame_05.png  3C3DCDA87C882027E268CC7DBAE9AA121EB6AF6EF24A51B140A794A7212D183A
cc0-flame_06.png  174A44AB516A969B1B4BF4DFA75D9BB370DE5B567BF8FB64966BF89862D6A45F
```

### 3D-Model-Hashes

```text
ship1.obj  C45011C22DC0C7C8697A04114BF0CCF5E4727A0F5847A6849FD9DC5DB9362C60
ship2.obj  9B040367E299A5E4AB62076062447C65328FD6A1253B1A244DC898199DC8A2F3
ship3.obj  2373C5C89F99C457679AA5E6B8E4FB658923E22F50768AD2D765274920307CFD
ship4.obj  37A6600135632635D21C08DBE109DAFA04FD8F0AC0FD5A47D2674F2821C5C178
ship5.obj  6590441EFBB7852DE687AD2D54F98C9EB85441BF3CBB8FA2A56F71AEC0443620
ship6.obj  CB6F9E7E701C67FDEC6D796CD514EB7620A475BCBD9CF4657D322F81F4E89B49
ship7.obj  CF72E0EA1CEAF4D899D5AAF75908C2A1920DA11A22269FB565243D183C0E5320
ship8.obj  B9485303C02898284CD502FA73C9D53A9B5D534A411A2D65BF64AF0E1422E80E
ship9.obj  405803A7C04B4ED608467591F29623A4DFF83FB277211CCB4E5A984D4F7C9E41
```

Weitere Recherchekandidaten bleiben bewusst getrennt: [Foozle Void - Main
Ship](https://foozlecc.itch.io/void-main-ship) und [Gishadev 2D Space Game
Pack](https://gisha.itch.io/2d-space-game-pack) koennen spaeter als eigene
Provider hinzukommen, wenn die konkret benoetigten Dateien und die Bundle-
groesse geprueft sind.

## Shop-Katalog

`src/config/shop.ts` ist die einzige Quelle fuer die kaufbaren Eintraege.
Jede Form besitzt eine stabile `id`, Beschreibung, Balance-Kosten und einen
unveraenderlichen `skinIndex`. Bei den neun 3D-Eintraegen verweist
`threeDAssetId` nur auf den Provider-Schluessel; URL und Dateiformat bleiben
in `src/ui/egoAssets.ts` gekapselt. Der `cc0-scout` und die 3D-Piloten nutzen
dieselben Kauf-, Besitz-, Ausruestungs-, Sync- und Reset-Regeln wie die
prozeduralen Formen.

Die Reihenfolge und die vorhandenen IDs werden nicht neu nummeriert. Die neun
3D-Modelle stehen im Shop zuerst; ihre unveraenderten Fallback-Indizes 101 bis
109 liegen weiterhin in `shipShapes.ts`. Dadurch bleiben Shop, Run, Profil und Ergebnisansicht
auch ohne WebGL, bei Offline-Start oder bei einem fehlenden Modell benutzbar.

## Austauscharchitektur

```text
Shop-ID / Save-Daten
        |
EgoAssetRegistry
   |              |                 |
2D-Fallback   CC0-Sprite/Aura   CC0-3D-Provider
   |              |                 |
Player/Profil  Player/Shop      ThreeDShipPreview
                                      |
                                  2D-Fallback
```

`src/ui/egoAssets.ts` kennt nur Provider-Vertraege und stabile Asset-IDs.
`textures.ts` loest Formen auf; `Player` und `ShopScene` loesen Aura-Frames
auf. `threeDAssetForId()` liefert nur Metadaten; `ThreeDShipPreview` laedt
Three.js und das OBJ erst bei einer 3D-Anprobe. Kein Consumer kennt Download-
URLs. Neue Packs werden registriert, ohne SaveSystem oder Progressionsregeln
zu aendern. Reduced Motion verwendet einen statischen Aura-Frame; fehlende
Texturen, WebGL oder Modelle fallen auf die prozedurale Darstellung zurueck.

## 3D-Integration

Als Quelle ist der [OpenGameArt 3D Spaceships
Pack](https://opengameart.org/content/3d-spaceships-pack) mit CC0-Angabe
integriert. Der kleine Pack enthaelt neun OBJ-Modelle und passende MTL-Dateien.
Die 3D-Dateien werden kontrolliert und lazy fuer die Shopvorschau oder den
laufenden Solo-Run geladen.
`ThreeDShipPreview` nutzt eine kleine Three.js-Szene, setzt das Material mit
der gewaehlten Farbe und dreht das Modell langsam.
Der bestehende Phaser-2D-Pfad bleibt der sichere Fallback fuer Player, Profil
und Ergebnis. Im Solo-Run wird das 3D-Modell als transparente DOM-Canvas-
Schicht auf der Spielerposition gefuehrt; Hitbox, Bewegung, Aura und
Trefferlogik bleiben Phaser-seitig. Fehlt WebGL, scheitert der OBJ-Download
oder ist das Geraet zu alt, bleibt die jeweils passende 2D-Fallback-Silhouette
sichtbar. Ein anderes Modellpaket kann spaeter allein im 3D-Provider und im
Shopmanifest ersetzt werden.

## Abnahme

- alle 110 Formen erscheinen im Shop-Reiter und sind scrollbar;
- `cc0-scout` funktioniert in Shopvorschau, Run und Profil-Fallback;
- die neun 3D-Modelle erscheinen in der Shopvorschau, wenn WebGL verfuegbar
  ist, und fallen sonst auf ihre 2D-Silhouette zurueck;
- Prismaflut zeigt im Shop und im Run die sechs CC0-Flame-Frames;
- keine Kosmetik aendert Reichweite, Speed, Score, XP oder Coins;
- Reduced Motion, fehlendes Asset und Offline-Start bleiben sicher;
- Bundle- und Geraetepruefung erfolgt mit `npm run verify` und dem finalen
  manuellen iPhone-/iPad-Playtest.
