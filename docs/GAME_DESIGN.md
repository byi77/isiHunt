# Game Design Document — isiHunt

**Version:** 0.1
**Stand:** 2026-08-30 · Produktstand siehe `package.json`/`version.json`
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
Item-Qualitaetsfarben, Erfahrungsbalken, talentpunktbasierte Talente, Zonen mit
Levelanforderung, Erfolge. Das sind erprobte Fortschrittsmuster, die hier auf
eine kurze Arcade-Schleife komprimiert werden.

## 4. Core Loop

```
Menue  →  Run (90 s)  →  Ergebnis  →  Menue
             ↑                          │
             └──────  "Nochmal"  ───────┘
```

Daneben stehen die **Duell-Modi** (Abschnitt 4.1): ein Bot-Duell auf einem
Geraet sowie ein Online-Duell fuer zwei bis vier Personen auf getrennten
Geraeten.

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

### 4.1 Duell-Modi

Die Auswahl unter `DUELL` bietet zwei Wege:

1. **VS BOT:** ein lokaler 90-Sekunden-Lauf gegen einen mittelstarken Bot.
2. **ONLINE-DUELL:** eine gemeinsame Lobby fuer zwei bis vier Personen auf
   getrennten Geraeten.

#### Gemeinsame Regeln

| Regel                         | Warum                                                                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gleiche Relikt-Abfolge**    | Alle menschlichen Teilnehmer erhalten denselben serverseitig festgelegten Seed. So entscheidet die Jagd und nicht ein zufaellig geschenktes legendaeres Relikt.         |
| **Temporaere Talente**        | Vor jedem Lauf verteilt jeder bis zu 10 Punkte in einem 20-Sekunden-Draft. Dauerhafte Talente bleiben aussen vor. Beim Rematch werden die letzten Builds vorgeschlagen. |
| **Keine normale Progression** | Ein normales Spielerduell veraendert weder XP noch Bestwerte noch Erfolge. Das Bot-Duell ist die Ausnahme bei einem Siegbonus.                                          |
| **Keine Kosmetik im Duell**   | Gekaufte Form, Farbe und Aura beeinflussen den Vergleich nicht.                                                                                                         |

#### VS BOT

Der Bot verwendet standardmaessig die Schwierigkeit `normal`: seine Leistung
liegt nahe an einer guten menschlichen Runde, bleibt aber durch eine aktive
Serie schlagbar. Vor dem Start bestaetigt der Spieler seinen temporaeren
Talent-Build. Ein Sieg vergibt den zentral konfigurierten Bonus von XP und
Coins; Niederlagen vergeben keinen Sonderbonus. Die konkreten Werte liegen in
`src/config/balance-data.json` und werden nicht in der Scene dupliziert.

#### ONLINE-DUELL

Der Ablauf ist ein Host-/Teilnehmer-Modell und kein gemeinsamer Bildschirm:

```
Hauptmenue → DUELL → ONLINE-DUELL → Bereitschaftslobby
                                    ↓ Einladung an Spieler
                            Host-Raum: 2–4 Spieler
                                    ↓ Host startet
                            Talentphase: alle bestaetigen
                                    ↓ Host startet die Runde
                            synchroner 90-Sekunden-Lauf → Ergebnis
```

In der Bereitschaftslobby erscheinen angemeldete Spieler mit Status
`DUELLBEREIT`. Der Einladende erstellt beim ersten Invite den Raum und ist
Host. Der eingeladene Spieler nimmt die direkte Einladung an und wird als
Teilnehmer hinzugefuegt. Der Host kann danach einen dritten und vierten Spieler
einladen. Sobald mindestens zwei Personen verbunden sind, kann nur der Host
die Talentphase starten.

Jeder Teilnehmer verteilt 10 Punkte. Die Runde beginnt erst, wenn alle
Teilnehmer den Build bestaetigt haben; der Host setzt danach die gemeinsame
serverzeitbasierte Startzeit. Waehrend der Runde werden die Gegnernamen und
Punktestaende ueber den gemeinsamen Realtime-Kanal angezeigt. Die Ergebnisse
werden serverseitig im Raum gespeichert und von allen Clients abgefragt.

Der Raumcode bleibt als technischer bzw. automatisierter Fallback erhalten,
ist aber im normalen Duell-Menue nicht sichtbar. Die sichtbare Einladung laeuft
ueber die Bereitschaftslobby. Der aktuelle Backend-Vertrag steht in
`supabase/phase_2_36_duel_lobby_invitations.sql` bis
`supabase/phase_2_42_duel_initial_talent_draft.sql`.

**Warum kein geteilter Bildschirm:** Zwei Spielfelder waeren auf einem
Hochformat-Handy zu klein. Das Online-Duell nutzt deshalb getrennte Geraete;
das lokale Bot-Duell bleibt der direkte Einzelgeraet-Weg.

## 5. Seltenheitsstufen

Die zentrale Achse. Alles andere haengt daran.

| Stufe         | Farbe            | Punkte | XP  | Spawn | Lebensdauer | Tempo    | Radius |
| ------------- | ---------------- | ------ | --- | ----- | ----------- | -------- | ------ |
| Schlicht      | Grau `#9d9d9d`   | 5      | 2   | 34 %  | 5,2 s       | 30 px/s  | 30     |
| Gewoehnlich   | Weiss `#ffffff`  | 10     | 3   | 28 %  | 4,6 s       | 45 px/s  | 30     |
| Ungewoehnlich | Gruen `#1eff00`  | 25     | 8   | 20 %  | 3,8 s       | 70 px/s  | 32     |
| Selten        | Blau `#0070dd`   | 60     | 20  | 11 %  | 3,0 s       | 105 px/s | 34     |
| Episch        | Lila `#a335ee`   | 150    | 55  | 5,5 % | 2,4 s       | 140 px/s | 38     |
| Legendaer     | Orange `#ff8000` | 400    | 130 | 1,5 % | 2,0 s       | 190 px/s | 44     |

**Designregel:** Seltener ⇒ wertvoller ⇒ schneller ⇒ kuerzer sichtbar ⇒
groesser (damit man es ueberhaupt rechtzeitig sieht).

**Erwartungswert pro Spawn:** ≈ 30,4 Punkte, ≈ 10,3 XP.
Quelle: `src/config/rarities.ts` — diese Tabelle ist eine Abschrift, der Code
ist die Wahrheit. Werte am 2026-08-17 aus dem Code nachgezogen, s.
`docs/AUDIT_2026-08-17.md` Abschnitt 4.1 und `docs/BALANCE_2026-08-17.md`.

**Neugefasst am 2026-08-28:** Die Punktestaffel wurde auf 5/10/25/60/150/400
gestellt. Jede farbige Stufe ist klar mehr wert als die vorherige; Rare+ tragen
zusammen rund 69 % des Erwartungsscores. Das macht Orange zum echten Jackpot,
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

| Serie | Multiplikator                              |
| ----- | ------------------------------------------ |
| 0–1   | ×1                                         |
| 2–3   | ×1,5                                       |
| 4–6   | ×2,2                                       |
| 7–10  | ×3,2                                       |
| 11–15 | ×4,5                                       |
| ab 16 | ×6, danach +0,25 je weiterem farbigen Fang |

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
höchste Serie startet beim 6-Fachen und wächst danach um 0,25 je weiterem
farbigen Fang. Ein legendäres Relikt bringt bei Serie 16 allein 2.400
Basispunkte; bei Serie 20 sind es bereits 2.800 vor Welt- und Talentboni.

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
`COINS_PER_LEVEL = 20` Coins. Zusätzlich gibt es alle zwei Level einen
kostenlosen Talentpunkt; der erste wird bei Level 3 vergeben. Talentränge
werden ausschließlich mit diesen Punkten gekauft, Coins bleiben für Shop und
Run-Belohnungen. Ein Reset ist kostenlos und erstattet alle investierten
Punkte. Im Ergebnis bündelt ein eigener Level-Up-Moment Stufe, XP-Restwert,
Level-Coins, neue Talentpunkte und unmittelbare Freischaltungen; das nächste
Ziel folgt direkt darunter.

### 7.2 Talente

Dauerhafte Upgrades. Die zehn Talente sind unabhängige, mit Talentpunkten
gekaufte Ränge ohne Voraussetzungen. Kauf, kostenloser Reset und die
Darstellung als ehrliche Liste im Profil sind implementiert. Der Start erfolgt
immer mit Rang 0; ein voller Ausbau soll spürbar helfen, darf aber weder die
Jagd noch die Score-Jagd ersetzen.

| Talent      | Max. Rang | Pro Rang              |
| ----------- | --------- | --------------------- |
| Reichweite  | 5         | +5 Sammelradius       |
| Flinkheit   | 5         | +5 % Tempo            |
| Magnetismus | 4         | +45 Sogreichweite     |
| Ausdauer    | 4         | +3 s Rundendauer      |
| Fokus       | 4         | +100 ms Combo-Fenster |
| Spürsinn    | 3         | +3 % Aufstiegschance  |
| Erkenntnis  | 5         | +5 % XP               |
| Gunst       | 5         | +5 % Punkte           |
| Resonanz    | 3         | +0,05x Serienbonus    |
| Schutzfeld  | 3         | -8 % Hinderniswirkung |

**Mathematisches Machtbudget:** Die Reichweite wird ueber die zweidimensionale
Fangflaeche bewertet. Bei einem gewichteten Reliktradius von 31,49 px steigt
die Fangflaeche von Rang 0 auf Rang 5 damit um rund 79 %; der letzte Rang ist
als Capstone 1,25-mal staerker als ein normaler Rang. Magnetismus endet bei
180 px Sogreichweite und 63,75 % hoeherer Soggeschwindigkeit; Ausdauer
verlaengert einen 90-Sekunden-Run um maximal 12,75 Sekunden (14,2 %), Fokus
das 900-ms-Fenster um maximal 425 ms (47,2 %). Diese Komforttalente bleiben im
Spiel klar spuerbar, koennen aber die Fang- und Serienleistung nicht mehr
nahezu verdoppeln. Direkte Fortschrittsboni fuer Tempo, XP und Punkte enden
durch den Capstone bei maximal 26,25 %.

**Balancing-Absicht:** Kein Talent ist Pflicht. _Reichweite_ und _Magnetismus_
machen das Spiel leichter, _Spürsinn_ macht farbige Relikte etwas
wahrscheinlicher, und _Gunst_/_Resonanz_ machen gute Serien ertragreicher.
Die Maximalwerte bleiben bewusst moderat: Die direkten Prozentboni für Tempo,
XP, Punkte und Hindernisse liegen jetzt zwischen 24 und 26,25 %; _Erkenntnis_
und _Gunst_ erreichen je 26,25 %. Die übrigen Talente verändern nur klar begrenzte
Komfortwerte wie Radius, Sekunden oder Serienmultiplikator.
_Resonanz_ addiert ihren Bonus erst ab der ersten sichtbaren Serienbonus-Stufe,
damit der erste Fang nicht künstlich aufgebläht wird. Mit Resonanz auf Rang 3
steigt Orange bei Serie 16 von 2.400 auf rund 2.461 Basispunkte; Gunst wirkt erst danach
als weiterer Multiplikator.

_Schutzfeld_ reduziert sowohl die Dauer eines Bremsfelds als auch den
Zeitverlust eines Zeit-Hindernisses. _Spürsinn_ hebt ein Relikt höchstens um
eine Seltenheitsstufe an und erzeugt keine direkte Orange-Garantie.

Quelle: `src/config/balance-data.json`, aufgelöst in `src/config/talents.ts`.
Die zehn Talente umfassen 41 Ränge. Bei einem Talentpunkt alle zwei Level
werden bis Level 100 insgesamt 49 Punkte verdient; die acht Punkte über dem
Vollausbau bleiben als kleiner Endgame-Puffer ohne weitere Coin-Kosten.

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

| Nicht drin                           | Begruendung                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Gegner / Schaden / Verlieren         | Es gibt keine Lebenspunkte und kein Game Over. Hindernisse bremsen oder ziehen nur wenige Sekunden ab. |
| Tutorial                             | Wenn es eins braucht, ist das Design gescheitert (Designziel 1).                                       |
| Werbung / Kaeufe                     | Vorerst kein Monetarisierungsdruck. Beeinflusst sonst das Balancing.                                   |
| Oeffentliches Ranked                 | Erst nach serverseitiger Laufpruefung sowie Datenschutz- und Moderationskonzept.                       |
| Querformat                           | Das Spiel ist fuer eine Hand gebaut.                                                                   |
| Geteilter Bildschirm im Online-Duell | Zwei Spielfelder auf einem Hochformat-Handy sind zu klein; Online-Spieler nutzen getrennte Geraete.    |

## 11. Offene Designfragen

- [ ] Endlos-Modus ohne Timer als zweiter Spielmodus?
- [ ] Serverseitige Laufpruefung als Voraussetzung fuer Ranked-Duelle?
- [ ] Datenschutz, Moderation und Reichweite der Spieler-Lobby ausserhalb des
      privaten/familiären Kreises?
