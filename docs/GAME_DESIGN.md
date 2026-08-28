# Game Design Document — isiHunt

**Version:** 0.1
**Stand:** 2026-08-28 · Produktstand siehe `package.json`/`version.json`
**Status:** lebendes Dokument — jede Balancing- oder Regelaenderung wird hier
zuerst beschrieben, dann implementiert.

---

## 1. Pitch

> **isiHunt** ist ein farbenfroher 2D-Arcade-Collector fuer den Handy-Browser.
> Du steuerst ein Licht-Raumschiff durch Raumzonen und sammelst Planeten, bevor
> sie verblassen. Ein Run dauert 90 Sekunden — aber Level, Talente und Erfolge
> ziehen sich ueber Wochen.

## 2. Designziele

Diese vier Saetze entscheiden jeden Zweifelsfall. Was ihnen widerspricht,
kommt nicht ins Spiel.

1. **In 5 Sekunden verstanden.** Keine Tutorial-Texte. Wer die Farben sieht,
   weiss, was wertvoll ist.
2. **In 90 Sekunden gespielt.** Ein Run passt in die Bahnfahrt, die
   Kaffeepause, die Werbepause.
3. **Ueber Wochen belohnt.** Wer haeufiger spielt, kommt sichtbar weiter —
   ohne dass Gelegenheitsspieler abgehaengt werden.
4. **Fuer den Daumen gebaut.** Alles Wichtige liegt in Reichweite einer Hand.
   Nichts Wichtiges liegt unter der Hand.

## 3. Zielgruppe und Referenzen

**Zielgruppe:** Casual-Spieler mit MMO-Vorerfahrung. Die visuelle Sprache
setzt voraus, dass "Orange = extrem selten" bereits verinnerlicht ist.

**Referenz:** World of Warcraft — nicht als Genre, sondern als _Grammatik_:
Item-Qualitaetsfarben, Erfahrungsbalken, Coin-basierte Talente, Zonen mit
Levelanforderung, Erfolge. Das sind erprobte Fortschrittsmuster, die hier auf
eine kurze Arcade-Schleife komprimiert werden.

## 4. Core Loop

```
Menue  →  Run (90 s)  →  Ergebnis  →  Menue
             ↑                          │
             └──────  "Nochmal"  ───────┘
```

Daneben steht der **Duell-Modus** (Abschnitt 4.1) als zweite Schleife fuer zwei
Personen an einem Geraet.

**Im Run, alle paar Sekunden:**

```
Relikt erscheint  →  Spieler bewegt sich hin  →  eingesammelt
        │                                             │
        │                                    Punkte × Multiplikator
        │                              Serie +1 (farbig), Fenster neu
        ↓
   verblasst (verpasst — Serie bleibt, aber Zeit war verloren)
```

Die eigentliche Entscheidung des Spielers ist **Prioritaet**: Auf dem Feld
liegen mehrere Relikte gleichzeitig. Das lila ist 25-mal so viel wert wie das
graue — aber es ist weiter weg und verschwindet frueher. Genau diese Abwaegung
ist das Spiel.

### 4.1 Duell-Modus

Zwei Personen, ein Geraet, abwechselnd.

```
Menue → Einfuehrung → Spieler 1 (90 s) → Uebergabe → Spieler 2 (90 s) → Ergebnis
                                                                           │
                            └──────────────  "Revanche"  ─────────────────┘
```

**Warum 90 Sekunden.** Im Solo-Modus glaettet sich Pech ueber viele Runs
hinweg. Im Duell zaehlt genau _ein_ Durchgang pro Person — mehr Zeit bedeutet
mehr Spawns und damit spuerbar weniger Streuung. Das Ergebnis bildet Koennen
ab statt Glueck.

**Drei Fairness-Regeln.** Sie sind der Kern des Modus, nicht Beiwerk:

| Regel                      | Warum                                                                                                                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gleiche Relikt-Abfolge** | Beide Spieler bekommen denselben Seed — dieselben Seltenheiten, an denselben Stellen, zur selben Sekunde. Sonst waere das Duell ein Wuerfelspiel darum, wer das legendaere Relikt geschenkt bekommt. |
| **Keine Talente**          | Beide spielen mit den Grundwerten der Figur. Sonst haette der Geraetebesitzer einen Vorteil, den der Gast nicht ausgleichen kann.                                                                    |
| **Keine Progression**      | Ein Duell vergibt weder XP noch Bestwerte noch Erfolge. Die Haelfte der Durchgaenge spielt jemand, dem der Spielstand nicht gehoert.                                                                 |
| **Keine Kosmetik**         | Im Duell traegt niemand seine gekaufte Form, Farbe oder Aura. Sonst waere auf einen Blick zu sehen, wer gerade dran ist — der Vergleich soll am Spiel haengen, nicht am Guthaben.                    |

**Die Kosmetik-Regel gilt nur dem Duell, nicht dem Tageslauf.** Sie steht hier,
weil zwei Personen an _einem_ Geraet spielen. Der Tageslauf ist Einzelspiel:
Verglichen wird ueber den gemeinsamen Seed, und eine Aura macht kein Relikt
schneller. Wer eine Form gekauft hat, traegt sie dort. Talente und
Rundenlaenge folgen weiterhin den Duell-Regeln.

Die gleiche Abfolge ist technisch anspruchsvoller, als sie klingt: Der
Zufallsgenerator muss **unabhaengig vom Spielverlauf** verbraucht werden, sonst
laufen die beiden Durchgaenge auseinander. Die zwei Fallstricke sind in
`src/systems/SpawnSystem.ts` dokumentiert.

**Waehrend des zweiten Durchgangs** steht die Vorlage des Gegners im HUD
(`Ziel 1.234`). Faellt sie, wird das einmalig gefeiert (_UEBERHOLT!_) — der
Moment ist die Pointe des Modus und darf nicht im Ergebnisbildschirm
untergehen.

**Was das Duell bewusst nicht ist:** kein geteilter Bildschirm. Auf einem
Hochformat-Handy waeren zwei Spielfelder je 360 × 640 Pixel gross — zu klein
fuer einen Sammelradius von 46 Pixeln, und beide Daumen wuerden sich in die
Quere kommen.

## 5. Seltenheitsstufen

Die zentrale Achse. Alles andere haengt daran.

| Stufe         | Farbe            | Punkte | XP  | Spawn | Lebensdauer | Tempo    | Radius |
| ------------- | ---------------- | ------ | --- | ----- | ----------- | -------- | ------ |
| Schlicht      | Grau `#9d9d9d`   | 3      | 2   | 34 %  | 5,2 s       | 30 px/s  | 30     |
| Gewoehnlich   | Weiss `#ffffff`  | 5      | 3   | 28 %  | 4,6 s       | 45 px/s  | 30     |
| Ungewoehnlich | Gruen `#1eff00`  | 10     | 8   | 20 %  | 3,8 s       | 70 px/s  | 32     |
| Selten        | Blau `#0070dd`   | 25     | 20  | 11 %  | 3,0 s       | 105 px/s | 34     |
| Episch        | Lila `#a335ee`   | 75     | 55  | 5,5 % | 2,4 s       | 140 px/s | 38     |
| Legendaer     | Orange `#ff8000` | 250    | 130 | 1,5 % | 2,0 s       | 190 px/s | 44     |

**Designregel:** Seltener ⇒ wertvoller ⇒ schneller ⇒ kuerzer sichtbar ⇒
groesser (damit man es ueberhaupt rechtzeitig sieht).

**Erwartungswert pro Spawn:** ≈ 15,0 Punkte, ≈ 10,3 XP.
Quelle: `src/config/rarities.ts` — diese Tabelle ist eine Abschrift, der Code
ist die Wahrheit. Werte am 2026-08-17 aus dem Code nachgezogen, s.
`docs/AUDIT_2026-08-17.md` Abschnitt 4.1 und `docs/BALANCE_2026-08-17.md`.

**Neugefasst am 2026-08-28:** Die Punktestaffel wurde auf 3/5/10/25/75/250
gestellt. Jede farbige Stufe ist klar mehr wert als die vorherige; Rare+ tragen
zusammen rund 71 % des Erwartungsscores. Das macht Orange zum echten Jackpot,
ohne die grauen und weissen Fänge wertlos zu machen.

## 6. Serien-System

Die Serie hat **zwei getrennte Stufen** — das ist der taktische Kern des
Spiels:

|              | Wirkung                                                                |
| ------------ | ---------------------------------------------------------------------- |
| **Halten**   | Jeder Fang setzt das Zeitfenster neu (Basis **0,9 s**)                 |
| **Steigern** | Nur ein **farbiger** Fang (ungewöhnlich und seltener) erhöht die Serie |

- Weiße Relikte (schlicht, gewöhnlich) **halten** die Serie, steigern sie aber
  nicht.
- Fängst du im Fenster gar nichts, fällt die Serie auf **0**.
- **Ein verpasstes Relikt bricht die Serie NICHT.**

**Warum diese Trennung.** Farbige Relikte machen nur 38 % aus und erscheinen im
Schnitt alle 1,6 s (Rundenanfang) bis 0,9 s (Rundenende) — oft zu selten für
das Fenster. Genau dann entsteht die Entscheidung: Nimm ich das weiße Relikt
in Reichweite und rette die Serie, oder jage ich das farbige und riskiere den
Abriss?

Vorher steigerte **jeder** Fang die Serie, und das Fenster war mit 1,8 s
doppelt so lang. Pro Fenster erschienen 2,9 bis 5,3 neue Relikte — die Serie
riss praktisch nie. Im automatisierten Playtest lief sie regelmäßig über 180
Fänge ohne einen einzigen Abriss; es gab nie etwas zu entscheiden. Nach der
Umstellung: beste Serie ~19, rund **11 Abrisse pro Runde**.

Dass ein Verpassen die Serie nicht bricht, bleibt eine bewusste Abweichung vom
Arcade-Standard. Begruendung: Auf dem Handy sind Fehlgriffe oft Geraet- statt
Spielerfehler (Fettfinger, Ruckler, Anruf). Serienverlust durch Verpassen
wuerde sich unfair anfuehlen. Belohnt wird **Flow**, nicht Fehlerfreiheit.

### Die Schleife

Ab der **ersten** Serie zieht die Figur eine Schleife hinter sich her. Länge
und Farbe zeigen die Stufe:

| Serie | Schleife     | Farbe    |
| ----- | ------------ | -------- |
| 0     | keine        | —        |
| 1–4   | kurz         | Hellblau |
| 5–9   | etwas länger | Cyan     |
| 10–19 | mittel       | Türkis   |
| 20–34 | lang         | Grün     |
| 35–49 | maximal      | Gold     |
| ab 50 | maximal      | Orange   |

**Warum eine gezeichnete Linie und kein Partikeleffekt.** Der erste Versuch
nutzte allein den vorhandenen Partikel-Emitter mit `blendMode: 'ADD'`.
Technisch entstanden über hundert Partikel — sichtbar war trotzdem nichts: Auf
dem hellen Weltraumhintergrund wusch der additive Modus jede Farbe zu einem
diffusen Nebel aus, der sich nicht von den Relikt-Auren unterscheiden ließ.
Eine Schleife braucht eine Kante, und die liefert nur eine gezeichnete Linie.
Der Partikelnebel bleibt als Untermalung erhalten.

**Die Länge ist ab Stufe 4 gedeckelt.** Eine unbegrenzt wachsende Spur würde
auf einem Handy im Hochformat genau die Relikte verdecken, die man fangen
will — und die Steuerung ist ausdrücklich so gebaut, dass die Hand das Ziel
nicht verdeckt. Ab dort trägt nur noch die Farbe die Information; „lang" von
„sehr lang" unterscheidet im Spiel ohnehin niemand, „gold statt türkis"
sofort.

| Serie | Multiplikator |
| ----- | ------------- |
| 0–1   | ×1            |
| 2–3   | ×1,2          |
| 4–6   | ×1,5          |
| 7–10  | ×1,9          |
| 11–15 | ×2,4          |
| ab 16 | ×3,2          |

Der Multiplikator wirkt **nur auf Punkte, nicht auf XP** — die hängen an der
Zahl der Fänge, damit Fortschritt und Bestenliste nicht dieselbe Schwankung
teilen.

**Warum die Schwellen so niedrig liegen.** Sie standen bis 2026-08-19 auf
5/10/20/35/50 — ausgelegt für das alte System, in dem _jeder_ Fang die Serie
steigerte. Seit nur farbige Relikte steigern (38 % aller Spawns) und das
Zeitfenster halbiert ist, bräuchte Serie 10 rund 27 Fänge am Stück; gemessen
reißt die Serie aber alle 17. Vier der fünf Stufen waren damit unerreichbar,
und der Serienbonus brachte über einen ganzen Run nur noch 3,6 % mehr Punkte.

Mit den neuen Werten kommen im simulierten Lauf **alle sechs Stufen vor**. Die
höchste Serie vervielfacht den Wert des nächsten Fangs auf das 3,2-Fache; ein
legendäres Relikt bringt dort allein 800 Basispunkte vor Welt- und Talentboni.

Quelle: `src/config/GameConfig.ts` (`COMBO_GRACE_MS`,
`SERIES_RAISING_MIN_RARITY_INDEX`, `COMBO_TIERS`, `SERIES_TRAIL_TIERS`).
Werte am 2026-08-17 aus dem Code nachgezogen (s. `docs/AUDIT_2026-08-17.md`
Abschnitt 4.2), Serien-Umstellung am 2026-08-19.

**Zum Nachjustieren.** Ist die Serie fuer juengere Spieler zu hart, zuerst
`COMBO_GRACE_MS` erhoehen (z. B. auf 1100) — der Wert wirkt direkter als jede
andere Stellschraube. Das Talent „Fokus" verlaengert das Fenster zusaetzlich.

## 7. Progression

### 7.1 Charakterlevel

**Die Kurve ist in Runs formuliert, nicht in XP.** Ein Levelaufstieg soll eine
nachvollziehbare Zahl an Runden kosten; die XP ergeben sich daraus über den
gemessenen Durchschnittsertrag (`XP_PER_RUN_REFERENCE`, aktuell 2 146 XP je
Run bei rund 183 Fängen).

| Level | XP fuer naechstes | kumuliert | Runs |
| ----- | ----------------- | --------- | ---- |
| 1     | 1 073             | 0         | 0,5  |
| 2     | 1 478             | 1 073     | 0,7  |
| 3     | 1 884             | 2 551     | 0,9  |
| 5     | 2 694             | 6 724     | 1,3  |
| 10    | 4 721             | 24 249    | 2,2  |
| 15    | 4 818             | 48 047    | 2,2  |
| 20    | 4 914             | 72 329    | 2,3  |
| 30    | 5 107             | 122 338   | 2,4  |
| 50    | 5 493             | 228 143   | 2,6  |
| 99    | 6 438             | —         | 3,0  |

**Warum der Anfang schneller ist.** Die ersten zehn Level laufen von 0,5 auf
2,2 Runs hoch: Wer neu anfängt, soll im ersten Run mehrfach aufsteigen und den
Fortschritt sofort spüren. Ab Level 10 pendelt sich die Kurve ein und steigt
bis Level 99 nur noch flach auf 3 Runs.

Bis Level 100 sind es rund **245 Runs ≈ 6 Stunden** reine Spielzeit.

**Vorher** stand hier `floor(750 · √n + 8 · n^1,25)`. Gemessen ergab das 0,4
Runs auf Level 1 und 4,6 auf Level 99 — der Anfang war zu schnell (mehrere
Aufstiege in einem einzigen Run), das Ende zu zäh.

Ab Level 100 wird kein weiterer XP-Fortschritt gesammelt. "kumuliert" ist die
insgesamt bis zum Erreichen dieses Levels noetige XP-Summe (ab Level 1 = 0).
Quelle: `src/config/GameConfig.ts` (`xpForLevel`, `XP_PER_RUN_REFERENCE`).
Kurve am 2026-08-19 neu gefasst; die Werte davor stehen in
`docs/AUDIT_2026-08-17.md` Abschnitt 4.3.

**Bestehende Spielstände** werden bei der Migration auf `SAVE_VERSION 7` neu
eingeordnet: Die gesamte je gesammelte XP wird auf die neue Kurve umgelegt.
Das kann das Level senken (Level 20 alt → 14 neu), weil die neue Kurve in den
frühen Stufen mehr XP verlangt und wer schon oben war, diese Differenz nie
bezahlt hat. Bewusst so entschieden, damit die Kurve rückwirkend für alle
dieselbe ist.

Der genaue Fang-Erwartungswert pro Run haengt von der Fangquote der
spielenden Person ab und ist nicht im Code hinterlegt — konkrete
Runs-bis-Level-Tabellen mit mehreren Fangquoten-Annahmen stehen in
`docs/BALANCE_2026-08-17.md` Abschnitt 2.

Jeder Levelaufstieg gibt die zentral konfigurierte Levelbelohnung von
`COINS_PER_LEVEL = 20` Coins. Talente werden nicht über Talentpunkte, sondern
atomar mit Coins gekauft; überschüssige alte `talentPoints` werden nur in der
Save-/RPC-Migration kompatibel behandelt. So bleibt jeder Levelaufstieg eine
Belohnung und Coins bleiben die gemeinsame Entscheidung zwischen Talent und
Kosmetik. Im Ergebnis bündelt ein eigener Level-Up-Moment Stufe, XP-Restwert,
Level-Coins, aktuelles Guthaben und unmittelbare Freischaltungen; das nächste
Ziel folgt direkt darunter.

### 7.2 Talente

Dauerhafte Upgrades. Die zehn Talente sind unabhängige Coin-basierte Ränge
ohne Voraussetzungen. Kauf, Reset und die Darstellung als ehrliche Liste im
Profil sind implementiert. Der Start erfolgt immer mit Rang 0; ein voller
Ausbau soll spürbar helfen, darf aber weder die Jagd noch die Score-Jagd
ersetzen.

| Talent      | Max. Rang | Pro Rang              |
| ----------- | --------- | --------------------- |
| Reichweite  | 5         | +8 Sammelradius       |
| Flinkheit   | 5         | +5 % Tempo            |
| Magnetismus | 4         | +65 Sogreichweite     |
| Ausdauer    | 4         | +4 s Rundendauer      |
| Fokus       | 4         | +150 ms Combo-Fenster |
| Spürsinn    | 3         | +3 % Aufstiegschance  |
| Erkenntnis  | 5         | +5 % XP               |
| Gunst       | 5         | +5 % Punkte           |
| Resonanz    | 3         | +0,05x Serienbonus    |
| Schutzfeld  | 3         | -8 % Hinderniswirkung |

**Balancing-Absicht:** Kein Talent ist Pflicht. _Reichweite_ und _Magnetismus_
machen das Spiel leichter, _Spürsinn_ macht farbige Relikte etwas
wahrscheinlicher, und _Gunst_/_Resonanz_ machen gute Serien ertragreicher.
Die Maximalwerte bleiben bewusst moderat: Die direkten Prozentboni für Tempo,
XP, Punkte und Hindernisse liegen zwischen 24 und 25 %; _Erkenntnis_ und
_Gunst_ erreichen je 25 %. Die übrigen Talente verändern nur klar begrenzte
Komfortwerte wie Radius, Sekunden oder Serienmultiplikator.
_Resonanz_ addiert ihren Bonus erst ab der ersten sichtbaren Serienbonus-Stufe,
damit der erste Fang nicht künstlich aufgebläht wird. Mit Resonanz auf Rang 3
steigt Orange bei Serie 16 von 800 auf 838 Basispunkte; Gunst wirkt erst danach
als weiterer Multiplikator.

_Schutzfeld_ reduziert sowohl die Dauer eines Bremsfelds als auch den
Zeitverlust eines Zeit-Hindernisses. _Spürsinn_ hebt ein Relikt höchstens um
eine Seltenheitsstufe an und erzeugt keine direkte Orange-Garantie.

Quelle: `src/config/balance-data.json`, aufgelöst in `src/config/talents.ts`.
Die zehn Talente umfassen 41 Ränge und kosten bei der aktuellen Coin-Kurve
18.950 Coins bis zum Vollausbau.

### 7.3 Welten

Seit Phase 3 sind die Raumzonen sichtbar umbenannt: Sternenweide, Eisring,
Glutnebel, Nullsektor und Sonnenkrone. Die Welt-IDs bleiben fuer bestehende
Spielstaende stabil.

| Welt          | Ab Level | Herausforderung                        | Schwierigkeit | Punkte-Bonus | XP-Bonus |
| ------------- | -------- | -------------------------------------- | ------------- | ------------ | -------- |
| Sternenweide  | 1        | keine - die Lernzone                   | 1,00          | +0 %         | +0 %     |
| Eisring       | 3        | Trägheit, bremsende Hindernisse        | 1,03          | +4 %         | +2 %     |
| Glutnebel     | 6        | kürzere Fenster, bremsende Hindernisse | 1,06          | +8 %         | +4 %     |
| Nullsektor    | 10       | Blinkeffekt, Zeitverlust-Hindernisse   | 1,09          | +12 %        | +6 %     |
| Sonnenkrone   | 15       | seltene Planeten, Zeitverlust          | 1,12          | +16 %        | +8 %     |
| Mondschmiede  | 22       | stärkere Trägheit, Zeitverlust         | 1,16          | +20 %        | +11 %    |
| Kristallbruch | 30       | kurze Fenster, viele Hindernisse       | 1,28          | +26 %        | +15 %    |
| Sturmgrenze   | 40       | Blinken, Trägheit, harte Hindernisse   | 1,42          | +33 %        | +19 %    |
| Lichtkern     | 55       | seltene Planeten, viele Hindernisse    | 1,56          | +39 %        | +22 %    |
| Horizonttor   | 75       | kürzeste Fenster, höchste Dichte       | 1,70          | +45 %        | +25 %    |

Die Spalte **Schwierigkeit** (`difficultyScale`) wirkt an zwei Stellen: Sie
skaliert die Hindernis-Wahrscheinlichkeit und kürzt das Sichtfenster jedes
Objekts. Bis 2026-08-19 standen die Welten 2 bis 5 alle auf 1,00 — fünf
aufeinander folgende Zonen ohne mechanische Steigerung, unterschieden nur
durch ihren Modifikator. Die Kurve steigt jetzt durchgehend; die Welten 6 bis
10 wurden dabei nur minimal angehoben (höchstens +0,04), damit das
eingespielte Endgame-Balancing nicht verschoben wird.

Punkte- und XP-Bonus laufen bewusst getrennt und wachsen unterschiedlich
schnell — Punkte staerker als XP, damit spaete Welten die Bestenliste
attraktiver machen, ohne die Levelprogression zu sehr zu beschleunigen.
Quelle: `src/config/worlds.ts` (`scoreMultiplier`, `xpMultiplier`). Werte am
2026-08-17 aus dem Code nachgezogen, s. `docs/AUDIT_2026-08-17.md` Abschnitt
4.5 — vorher stand hier ein einzelner kombinierter Prozentwert je Welt, der
nicht mehr der Code-Struktur entsprach.

Jede Zone hat zusaetzlich eine eigene feste Stern-/Nebelkomposition und zwei
transparente Hintergrundplaneten. Der Satz "die Welten unterscheiden sich
mechanisch nur optisch" stand hier bis 2026-08-19 und stammte aus v0.1 — er
galt schon zum Zeitpunkt der Modifikatoren (`inertia`, `short_lived`,
`blink`, `rare_bonus`) nicht mehr und erst recht nicht seit der abgestuften
Schwierigkeit. Die groessere Varianz aus M3 (eigene Weltregeln je Zone) steht
weiterhin aus.

### 7.4 Erfolge

62 Erfolge in mehreren Gruppen: erste Male, Combo-Schwellen, Tagesläufe,
Rarität-Sammelmengen je Stufe, Punktschwellen, Level, Gesamtsammelmenge,
Run-Sammelmenge, Run-Anzahl, Spielzeit, Talentränge und Weltenfreischaltung.
Sie werden nach jedem Run geprueft und wirken rueckwirkend — wer die
Bedingung schon erfuellt hat, bekommt sie beim naechsten Run.

Vollstaendige Liste: `src/config/achievements.ts`. Anzahl am 2026-08-17 aus
dem Code nachgezogen (vorher stand hier "15 Erfolge in vier Gruppen", ein
Stand aus einer frueheren Entwicklungsphase) — s. `docs/AUDIT_2026-08-17.md`
Abschnitt 4.6.

## 7.5 Einen Run verlassen

Ein Run laesst sich jederzeit anhalten und verlassen. **Ein abgebrochener Run
wird nicht gewertet** — kein XP, kein Bestwert, kein Erfolg.

Das ist kein Strafmechanismus, sondern verhindert eine Auslese: Wer einen
schlechten Lauf abbrechen und trotzdem gewertet bekommen koennte, haette einen
Grund, jeden mittelmaessigen Run wegzuwerfen und nur die guten zu Ende zu
spielen. Der Bestwert waere dann keine Leistung mehr, sondern Geduld.

**Im Duell haelt die Simulation nicht an.** Wer anhalten koennte, waehrend ein
legendaeres Relikt auf dem Feld liegt, duerfte in Ruhe zielen — das waere ein
Vorteil, den der erste Spieler nicht hatte. Der Bildschirm erscheint trotzdem,
denn Aussteigen muss moeglich bleiben; er beendet dann das ganze Duell.

## 7.6 Der Laden: Form, Farbe, Aura

Muenzen haben drei Senken im Laden. Alle drei sind rein kosmetisch — nichts
davon macht schneller, groesser oder punktestaerker. Wer nichts kauft, ist
nicht schwaecher, nur unauffaelliger.

| Kategorie | Was sie aendert         | Preisspanne\*  | Gratis dabei |
| --------- | ----------------------- | -------------- | ------------ |
| Form      | Silhouette (Textur)     | 300 – 3 000    | Pfeil        |
| Farbe     | Rumpf, Aura, Halo       | 200 – 900      | Weltfarbe    |
| Aura      | Bewegung, den Run ueber | 4 000 – 25 000 | Keine        |

\* Referenzwerte. Die tatsaechlichen Preise skalieren mit der Einnahmenrate
(`balancedCoinCost`), damit eine Aenderung an der Muenzquelle nicht jeden
Preis einzeln nachziehen muss.

**Warum die Auren so viel teurer sind.** Ein Run bringt rund 50 Muenzen. Die
teuerste Form entspricht damit etwa 60 Runden, die teuerste Aura rund 200. Das
ist Absicht: Formen und Farben sind das, was man sich in den ersten Wochen
leistet, Auren das Ziel danach. Eine Aura, die weniger kostet als eine Form,
haette die Reihenfolge des Fortschritts umgedreht — ein Balance-Test haelt
deshalb fest, dass **jede** Aura teurer ist als die teuerste Form.

**Warum sie sich kombinieren statt zu ersetzen.** Die drei Kategorien greifen
auf verschiedene Ebenen zu: Die Form bestimmt die Textur, die Farbe deren
Tint, die Aura moduliert beides ueber die Zeit. Eine Aura, die den Rumpf durch
den Farbkreis schickt, haette die gekaufte Farbe unsichtbar gemacht — der
Spieler haette zwei Kategorien bezahlt und saehe nur eine. Die
Farbverschiebung bleibt deshalb bei hoechstens 60 Grad und mischt immer von
der getragenen Farbe aus.

**Grenzen, die die Spielbarkeit schuetzen.** Keine Aura darf die Figur unter
30 % Deckkraft druecken oder auf mehr als das 1,5-fache aufblaehen. Wer sein
Schiff im Gewuehl verliert, verliert die Runde; und eine Figur, die den
eigenen Sammelradius ueberdeckt, macht das Feedback des Halos unlesbar. Beide
Grenzen sind in `Balance.test.ts` ueber eine Sekunde Laufzeit je Aura
geprueft.

### Die Prismaflut

Eine Aura steht ausserhalb der Reihe: 25 000 Muenzen **und** Stufe 50. Das
sind rund 500 Runden, mehr als das Doppelte der bis dahin teuersten Aura — und
Muenzen allein reichen nicht.

Warum die zweite Huerde. Ein reiner Preis belohnt Geduld; wer lange genug
spielt, bekommt alles. Bei einem Stueck, das "jeder haben will", ist genau das
zu wenig: Es soll aussagen, dass jemand weit gekommen **und** lange dabei ist.
Genau eine Aura hat diese Huerde — zwei waeren ein System, eine ist eine
Aussage.

Sie ist die einzige Aura, die die gekaufte Farbe ueberschreibt (voller
Farbkreis statt hoechstens 60 Grad). Auch das ist Absicht: Bei diesem Preis
ist die Aura selbst die Aussage, nicht die Farbe darunter.

Gesperrt bleibt sie im Laden **sichtbar** und laeuft dort in voller Bewegung,
mit "STUFE 50" statt eines Preises auf dem Knopf. Ein Fernziel, das man nie zu
Gesicht bekommt, ist keins.

**Im Duell traegt niemand etwas Gekauftes.** Beide Spieler fliegen dieselbe
Grundform in der Weltfarbe, ohne Aura (`GameScene`, `nonProgressionMode`).
Jede der drei Kategorien wuerde die zwei auf einen Blick unterscheidbar
machen; der Vergleich soll am Spiel haengen, nicht am Guthaben (s. 4.1).

## 8. Steuerung

**Handy (primaer):** Finger irgendwo aufsetzen und ziehen. Die Figur laeuft
zum Finger, klebt aber nicht daran.

Warum nicht am Finger kleben: Die Hand wuerde die Figur und den Sammelradius
verdecken — genau die Information, die man braucht. Der Abstand haelt das
Spielfeld sichtbar.

Nahe am Ziel bremst die Figur ab (siehe `POINTER_DEADZONE`), damit sie nicht
um den Finger herum zittert.

**PC (Test):** WASD oder Pfeiltasten. Tastatur hat Vorrang, solange eine Taste
gehalten wird.

## 9. Spielfeld

720 px feste interne Breite, variable interne Portraithoehe (mindestens
1280 px), per FIT auf die verfuegbare sichere Geraeteflaeche skaliert. Auf
hohen, schmalen Handys wird die zusaetzliche Hoehe als echte Spielflaeche
genutzt; die Rundendauer bleibt unveraendert.

- Oben **170 px** frei fuer das HUD.
- Unten **120 px** frei — dort liegt die Hand.
- Seitlich je **60 px**.
- Querformat wird nicht unterstuetzt; Manifest und Laufzeit fordern
  Hochformat an. Browser ohne Orientierungs-API zeigen einen Hochkant-Hinweis.

Relikte spawnen nie naeher als **150 px** an der Figur: Ein legendaeres Relikt
darf nicht als Geschenk direkt unter dem Daumen erscheinen.

## 10. Was bewusst NICHT drin ist

| Nicht drin                    | Begruendung                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| Gegner / Schaden / Verlieren  | Es gibt keine Lebenspunkte und kein Game Over. Hindernisse bremsen oder ziehen nur wenige Sekunden ab. |
| Tutorial                      | Wenn es eins braucht, ist das Design gescheitert (Designziel 1).                                       |
| Werbung / Kaeufe              | Vorerst kein Monetarisierungsdruck. Beeinflusst sonst das Balancing.                                   |
| Online-Bestenliste            | Erst wenn die Kernschleife steht (M5).                                                                 |
| Querformat                    | Das Spiel ist fuer eine Hand gebaut.                                                                   |
| Geteilter Bildschirm im Duell | Zwei Spielfelder auf einem Hochformat-Handy sind zu klein (siehe 4.1).                                 |
| Echtzeit-Duell ueber Netzwerk | Braucht einen Server. Der Weg dorthin steht in ADR-0010.                                               |

## 11. Offene Designfragen

- [ ] Endlos-Modus ohne Timer als zweiter Spielmodus?
- [ ] Soll das Duell benannte Spieler erlauben statt "Spieler 1 / Spieler 2"?
- [ ] Duell ueber zwei Geraete per geteiltem Link (ADR-0010)?
- [ ] Echtes Netzwerkduell erst nach ausreichendem Bedarf und stabiler
      serverseitiger Bewertung?
