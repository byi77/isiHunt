# Game Design Document — isiHunt

**Version:** 0.1
**Stand:** 2026-08-12
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
Item-Qualitaetsfarben, Erfahrungsbalken, Talentpunkte, Zonen mit
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
        │                                    Combo +1, Fenster neu
        ↓
   verblasst (verpasst — Combo bleibt, aber Zeit war verloren)
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
| Schlicht      | Grau `#9d9d9d`   | 2      | 2   | 34 %  | 5,2 s       | 30 px/s  | 30     |
| Gewoehnlich   | Weiss `#ffffff`  | 3      | 3   | 28 %  | 4,6 s       | 45 px/s  | 30     |
| Ungewoehnlich | Gruen `#1eff00`  | 7      | 8   | 20 %  | 3,8 s       | 70 px/s  | 32     |
| Selten        | Blau `#0070dd`   | 18     | 20  | 11 %  | 3,0 s       | 105 px/s | 34     |
| Episch        | Lila `#a335ee`   | 45     | 55  | 5,5 % | 2,4 s       | 140 px/s | 38     |
| Legendaer     | Orange `#ff8000` | 100    | 130 | 1,5 % | 2,0 s       | 190 px/s | 44     |

**Designregel:** Seltener ⇒ wertvoller ⇒ schneller ⇒ kuerzer sichtbar ⇒
groesser (damit man es ueberhaupt rechtzeitig sieht).

**Erwartungswert pro Spawn:** ≈ 8,9 Punkte, ≈ 10,3 XP.
Quelle: `src/config/rarities.ts` — diese Tabelle ist eine Abschrift, der Code
ist die Wahrheit. Werte am 2026-08-17 aus dem Code nachgezogen, s.
`docs/AUDIT_2026-08-17.md` Abschnitt 4.1 und `docs/BALANCE_2026-08-17.md`.

## 6. Combo-System

- Jeder Fang: Combo **+1**, Zeitfenster startet neu (Basis **1,8 s**).
- Faengst du im Fenster nichts, faellt die Combo auf **0**.
- **Ein verpasstes Relikt bricht die Combo NICHT.**

Das ist eine bewusste Abweichung vom Arcade-Standard. Begruendung: Auf dem
Handy sind Fehlgriffe oft Geraet- statt Spielerfehler (Fettfinger, Ruckler,
Anruf). Combo-Verlust durch Verpassen wuerde sich unfair anfuehlen. Belohnt
wird **Flow**, nicht Fehlerfreiheit.

| Combo | Multiplikator |
| ----- | ------------- |
| 0–4   | ×1            |
| 5–9   | ×1,1          |
| 10–19 | ×1,25         |
| 20–34 | ×1,45         |
| 35–49 | ×1,65         |
| ab 50 | ×1,85         |

Quelle: `src/config/GameConfig.ts` (`COMBO_GRACE_MS`, `COMBO_TIERS`). Werte
am 2026-08-17 aus dem Code nachgezogen, s. `docs/AUDIT_2026-08-17.md`
Abschnitt 4.2.

## 7. Progression

### 7.1 Charakterlevel

XP fuer den Aufstieg von Level _n_: `floor(750 · √n + 8 · n^1,25)`.
Ab Level 100 wird kein weiterer XP-Fortschritt gesammelt.

| Level | XP fuer naechstes | kumuliert |
| ----- | ----------------- | --------- |
| 1     | 758               | 0         |
| 2     | 1 079             | 758       |
| 3     | 1 330             | 1 837     |
| 5     | 1 736             | 4 712     |
| 10    | 2 513             | 15 037    |
| 15    | 3 140             | 28 896    |

"kumuliert" ist die insgesamt bis zum Erreichen dieses Levels noetige XP-Summe
(ab Level 1 = 0). Quelle: `src/config/GameConfig.ts` (`xpForLevel`). Werte am
2026-08-17 aus dem Code nachgezogen, s. `docs/AUDIT_2026-08-17.md` Abschnitt
4.3 und `docs/BALANCE_2026-08-17.md` fuer den vollstaendigen Rechenweg bis
Level 100.

Der genaue Fang-Erwartungswert pro Run haengt von der Fangquote der
spielenden Person ab und ist nicht im Code hinterlegt — konkrete
Runs-bis-Level-Tabellen mit mehreren Fangquoten-Annahmen stehen in
`docs/BALANCE_2026-08-17.md` Abschnitt 2.

Jeder Levelaufstieg gibt **1 Talentpunkt**, solange noch mindestens ein Talent
nicht voll ausgebaut ist. Danach wird der Punkt automatisch in **10 Coins**
umgewandelt. So bleibt jeder weitere Levelaufstieg eine Belohnung.

### 7.2 Talente

Dauerhafte Upgrades. Datenmodell und Wirkung sind implementiert, die
Vergabe-Oberflaeche folgt in M2.

| Talent      | Max. Rang | Pro Rang              |
| ----------- | --------- | --------------------- |
| Reichweite  | 5         | +6 Sammelradius       |
| Flinkheit   | 5         | +5 % Tempo            |
| Magnetismus | 4         | +35 Sogreichweite     |
| Ausdauer    | 4         | +3 s Rundendauer      |
| Fokus       | 4         | +150 ms Combo-Fenster |
| Erkenntnis  | 5         | +5 % XP               |
| Gunst       | 5         | +5 % Punkte           |

**Balancing-Absicht:** Kein Talent ist Pflicht. _Reichweite_ und _Magnetismus_
machen das Spiel leichter, _Gunst_ und _Erkenntnis_ machen es ertragreicher —
zwei gleichwertige Bauweisen, keine dominante. _Erkenntnis_ und _Gunst_ sind
bei identischen Kosten und gleichem Maximalrang bewusst gleich stark
(je max. +25 %) — bis 2026-08-17 war _Gunst_ mit +4 %/Rang schwaecher, ohne
erkennbaren Design-Grund; angeglichen nach `docs/BALANCE_2026-08-17.md`
Abschnitt 4.

Quelle: `src/config/talents.ts` (`resolveStats`). Werte am 2026-08-17 aus dem
Code nachgezogen, s. `docs/AUDIT_2026-08-17.md` Abschnitt 4.4 — Reichweite,
Flinkheit und Magnetismus stimmten bereits ueberein, die vier anderen
Talente waren im Code zunaechst niedriger als hier dokumentiert; _Gunst_
wurde danach im Code selbst angehoben (s.o.).

### 7.3 Welten

Seit Phase 3 sind die Raumzonen sichtbar umbenannt: Sternenweide, Eisring,
Glutnebel, Nullsektor und Sonnenkrone. Die Welt-IDs bleiben fuer bestehende
Spielstaende stabil.

| Welt          | Ab Level | Herausforderung                        | Punkte-Bonus | XP-Bonus |
| ------------- | -------- | -------------------------------------- | ------------ | -------- |
| Sternenweide  | 1        | keine - die Lernzone                   | +0 %         | +0 %     |
| Eisring       | 3        | Trägheit, bremsende Hindernisse        | +4 %         | +2 %     |
| Glutnebel     | 6        | kürzere Fenster, bremsende Hindernisse | +8 %         | +4 %     |
| Nullsektor    | 10       | Blinkeffekt, Zeitverlust-Hindernisse   | +12 %        | +6 %     |
| Sonnenkrone   | 15       | seltene Planeten, Zeitverlust          | +16 %        | +8 %     |
| Mondschmiede  | 22       | stärkere Trägheit, Zeitverlust         | +20 %        | +11 %    |
| Kristallbruch | 30       | kurze Fenster, viele Hindernisse       | +26 %        | +15 %    |
| Sturmgrenze   | 40       | Blinken, Trägheit, harte Hindernisse   | +33 %        | +19 %    |
| Lichtkern     | 55       | seltene Planeten, viele Hindernisse    | +39 %        | +22 %    |
| Horizonttor   | 75       | kürzeste Fenster, höchste Dichte       | +45 %        | +25 %    |

Punkte- und XP-Bonus laufen bewusst getrennt und wachsen unterschiedlich
schnell — Punkte staerker als XP, damit spaete Welten die Bestenliste
attraktiver machen, ohne die Levelprogression zu sehr zu beschleunigen.
Quelle: `src/config/worlds.ts` (`scoreMultiplier`, `xpMultiplier`). Werte am
2026-08-17 aus dem Code nachgezogen, s. `docs/AUDIT_2026-08-17.md` Abschnitt
4.5 — vorher stand hier ein einzelner kombinierter Prozentwert je Welt, der
nicht mehr der Code-Struktur entsprach.

In v0.1 unterscheiden sich die Welten mechanisch nur optisch. Jede Zone hat
dafuer eine eigene feste Stern-/Nebelkomposition und zwei transparente
Hintergrundplaneten. Das ist Absicht: erst muss sich die Grundmechanik gut
anfuehlen, dann kommt Varianz dazu (M3).

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
