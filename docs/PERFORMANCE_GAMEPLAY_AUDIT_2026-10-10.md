# Gameplay-Performance-Audit

Stand: 10.10.2026, isiHunt **0.1.425**, Commit
`d2de0eda04f97d032f0bff5b23e27c74eab8875e`.

## Fragestellung und Grenzen

Der Benutzer spielt auf einem iPhone 16 als Home-Bildschirm-App mit Effektstufe
**„voll“**. Er bestätigt, dass auch die Bewegung zwischen den Fängen ruckelt.
Dieses Audit ergänzt das [erste Audit](PERFORMANCE_AUDIT_2026-10-10.md) um
vollständige Gameplay-Runs und CPU-Profile. Eine Messung vom echten iPhone liegt
weiterhin nicht vor; die Geräteursache bleibt unresolved.

Gemessen wurde Chromium / ANGLE D3D11 auf einer RTX 5080 mit dem Playwright-
Viewport-Modell des iPhone 16 im Standalone-Modus. Der Canvas maß 720 × 1336.
`preserveDrawingBuffer` war aus. Ton und Haptik waren aus; kein angemeldetes
Benutzerkonto und keine Online-Duelle wurden verwendet. Desktop-GPU und
Chromium ersetzen weder die Apple-GPU noch iOS-WebKit oder die Touch-Latenz.

Es wurden ausschließlich diagnostische Eingriffe im Messbrowser vorgenommen.
Produktive Runtime-Dateien sind unverändert.

## Vollständige Runs

Vier Solo-Runs in Silberhain durchliefen die echte Render-Schleife und die
normale Countdown-Phase bis zum regulären Ende nach 90 Sekunden Spielzeit:

1. „Voll“, ohne vergebene Talente.
2. „Voll“, alle Talente auf dokumentiertem Maximalrang außer Ausdauer.
3. „Sparsam“, dieselbe Talentbelegung.
4. „Voll“, dieselbe Talentbelegung und temporärer Cache des Fang-Maskenrechtecks.

Ausdauer wurde nicht vergeben, damit alle Runs dieselbe Spieldauer haben.
Die Belegung ist ein diagnostischer Testfall, keine Aussage über den Spielstand
des Benutzers. Die aufgelösten Stats stehen in den Rohdaten.

Ein automatisierter Controller setzte alle 100 ms das Ziel auf das nächste
aktive Relikt. Der Spawn-Zufallsgenerator erhielt dieselbe Saat. Wegen
unterschiedlicher Talentwirkung, Bewegung und Frame-Zeiten sind die Runs
dennoch kein identischer Replay.

Aufgezeichnet wurden `rawDelta`, drei Zeitabschnitte pro Run, Fang-/Spawn-
Ereignisse, Objektspitzen, Text-Neuzeichnungen, WebGL-Aufrufe und CPU-Samples
im Zwei-Millisekunden-Intervall. Methoden-Timer enthalten verschachtelte
Aufrufe; ihre Summen dürfen nicht addiert werden. CPU-Sampling und Wrapper
erzeugen Messaufwand. Methoden-Zähler beginnen schon im Countdown; die
Frame-Statistik erfasst die Phase `running`.

Die erste Sekunde ist wegen des Messaufbaus gesondert zu betrachten. Die dort
beobachteten Spitzen sind kein isolierter Beleg für einen Produktionsfehler.
Auch die genaue Ursache späterer Spitzen wird ohne zeitlich zugeordnete
Tracing-Daten nicht behauptet.

| Szenario                      | Run-Frames |     p95 | Max. einschließlich Start | Frames >25 ms nach erster Sekunde | Draw-Aufrufe / Run-Frame* | Timer-Neuzeichnungen |
| ----------------------------- | ---------: | ------: | ------------------------: | --------------------------------: | ------------------------: | -------------------: |
| Voll, ohne Talente            |      5.388 | 16,7 ms |                  150,0 ms |                                 1 |                     74,03 |                5.479 |
| Voll, ausgebaute Talente      |      5.398 | 16,7 ms |                   50,1 ms |                                 0 |                     72,21 |                5.489 |
| Sparsam, ausgebaute Talente   |      5.398 | 16,7 ms |                   49,9 ms |                                 0 |                     57,20 |                5.491 |
| Voll, Talente, Rechteck-Cache |      5.398 | 16,7 ms |                   50,1 ms |                                 0 |                     72,12 |                5.489 |

\* WebGL-Zähler laufen bereits im Countdown, der Nenner zählt nur Run-Frames.
Die Zahl ist daher eine vergleichbare Näherung mit Countdown-Aufwand, keine
exakt auf einzelne Run-Frames begrenzte Draw-Statistik.

Der spätere Ausreißer im Run ohne Talente lag bei **83,3 ms** nach rund
17,7 Sekunden Spielzeit. Im unmittelbar vorherigen aufgezeichneten Frame war
kein Fang-/Spawn-Ereignis erfasst. Das isoliert seine Ursache nicht.
Die Abschnitte von 30–60 und 60–90 Sekunden enthielten in allen vier Runs
keine Frames über 25 ms. Dauerhaft ruckelnde Bewegung wurde auf diesem
Desktop nicht reproduziert.

Es wurden 177 beziehungsweise 191 Relikte eingesammelt; höchstens acht Relikte
und fünf Fang-Effekte waren gleichzeitig aktiv. Alle Runs erreichten `ended`
mit Restzeit null. JavaScript-Seitenfehler: null.

## Befunde aus Code und Profil

### Graphics-Verarbeitung benötigt kontinuierlich CPU

Der Phaser-Graphics-Renderer bildet den größten benannten Self-Time-Anteil
der ersten CPU-Profile außerhalb von Idle. Die Spielfigur baut Reichweiten-,
Magnetismus- und Spur-Grafik laufend auf (`src/entities/Player.ts:335`, `:833`).
Relikte zeigen zusätzlich Lebensdauerbögen und bei aktivem Magnetismus
Sog-Grafik (`src/entities/Collectible.ts:297`, `:315`). Fang-Effekte verwenden
ebenfalls einen gemeinsamen Graphics-Layer (`src/ui/CollectionEffects.ts:137`).

Die aufsummierte gesampelte Self-Time von `GraphicsWebGLRenderer` lag bei
**3.641 / 3.321 / 3.205 / 3.375 ms** in den vier Szenarien in Tabellenreihenfolge.
Das sind CPU-Samples, keine GPU-Zeiten und keine exakten Messungen der einzelnen
Grafikflächen. Der Run mit Talenten war damit nicht teurer als der ohne Talente.

Phasers Graphics-WebGL-Renderer zerlegt ARC-Befehle beim Rendern wieder in
Punkte: `iterStep = 0.01`, `Math.sin`/`Math.cos` je Schritt und neue Point-
Objekte (`node_modules/phaser/src/gameobjects/graphics/GraphicsWebGLRenderer.js`).
Ein selteneres Neuschreiben des Command-Buffers allein beseitigt diese Arbeit
des Renderers daher nicht.

Das bestätigt einen Ort erheblicher CPU-Arbeit im lokalen Profil. Es beweist
weder einen dominanten Engpass auf dem iPhone noch, dass Talente allein mehr
Gesamtkosten verursachen: Sie ändern auch die Lebensdauer und Anzahl sichtbarer
Relikte. Ein Fix muss gezielt die gemessenen Grafikflächen optimieren und
Lebensdauer-, Serien- und Talentinformation erhalten.

### Die Fang-Maske wird auch bei gleichem Ausschnitt aktualisiert

`CollectionEffects.update()` setzt bei aktiven Fängen pro Frame denselben
Playfield-Ausschnitt. `ClipMask.set()` zeichnet das Rechteck neu und setzt
`filter.needsUpdate = true` (`src/ui/clipMask.ts:44`).

Zusätzlich ist Phasers `Mask.autoUpdate` standardmäßig **true**.
`updateDynamicTexture()` löscht beziehungsweise rendert die Maskentextur neu.
Ein Rechteck-Cache allein verhindert deshalb nicht die automatische
Masken-Aktualisierung. Ein separater Versuch prüft einen Cache mit expliziter
Aktualisierung nur bei geändertem Ausschnitt.

Im vollständigen Run wurden ohne Cache **5.163** Rechteck-Neuzeichnungen und
mit Rechteck-Cache **eine** gezählt. Die gesamten Draw-Aufrufe blieben mit
72,21 gegenüber 72,12 pro Run-Frame nahezu gleich; Phasers `autoUpdate` war
in beiden Fällen weiterhin aktiv. Aus diesem Versuch lässt sich kein
relevanter Frame-Gewinn ableiten.

Diese Versuchsanordnung betrifft die unbewegte Kamera in Silberhain. Ein
produktiver Fix muss außerdem Kamera- und Viewportänderungen berücksichtigen;
ein statischer Cache darf bei Kamerawacklern, Resize oder scrollenden Masken
keinen falschen Ausschnitt erzeugen.

Im separaten Versuch mit 20 Sekunden aktivem Gameplay wurden die tatsächlichen
`Mask.updateDynamicTexture`-Aufrufe gezählt:

| Versuch                                 | Rechteck-Neuzeichnungen | Maskentextur-Aktualisierungen | Draw-Aufrufe / Run-Frame* |
| --------------------------------------- | ----------------------: | ----------------------------: | ------------------------: |
| Unverändert                             |                     979 |                         1.329 |                     73,65 |
| Rechteck-Cache und `autoUpdate = false` |                       1 |                             2 |                     73,23 |

Die Zähler enthalten auch den Countdown. Beide Runs sammelten 35 Relikte ein.
Die p95-Framezeit blieb bei 16,7 ms. Der Versuch bestätigt das Vermeiden
wiederholter Maskentextur-Aktualisierungen, keinen nachgewiesenen FPS-Gewinn
und keine Lösung des Ruckelns auf dem iPhone.

### Wiederholte Media-Abfragen sind messbar, aber kein belegter Hauptengpass

`prefersReducedMotion()` ruft jedes Mal erneut `window.matchMedia()` auf
(`src/systems/AccessibilitySystem.ts:17`). Im kurzen unveränderten Gameplay-
Versuch wurden **13.728 native Aufrufe** und 39,2 ms aufsummierte Wrapper-Zeit
gezählt. Ein temporärer Cache des MediaQueryList-Objekts reduzierte die nativen
Aufrufe auf einen; 13.897 Abfragen des Wrappers benötigten zusammen 4,3 ms.

Der native Cache wurde nicht auf echte iOS-Einstellungswechsel geprüft und ist
kein produktiver Fix. Die gemessene absolute Zeit ist gegenüber dem Render-
Profil klein. Dieses Ergebnis rechtfertigt keine Behauptung, Media-Abfragen
seien die Ursache des Bewegungsruckelns.

Zusätzliche Wrapper auf `Graphics.renderWebGL` einzelner Objekte wurden von
Phasers aktivem Renderpfad nicht aufgerufen. Die entsprechenden Null-Zähler
in den Rohdaten sind **keine Messung kostenloser Grafikobjekte**. Eine
Zuordnung der Graphics-Self-Time zu einzelnen Flächen bleibt offen.

### Timer bleibt ein bestätigter Optimierungspunkt

Der HUD-Timer setzt seine Textfarbe weiterhin pro Frame; Phaser rastert dabei
auch bei unveränderter Farbe neu. Der im ersten Audit geprüfte Farbcache ist
noch nicht produktiv umgesetzt. Die vollständigen Runs erfassen diese Arbeit
ebenfalls, einschließlich des Wechsels zur roten Schlussphase.

### Fang-Anzeigen erzeugen zusätzliche kurze CPU-Spitzen

Im Run ohne Talente erreichte ein Aufruf von `CollectionEffects.add()`
8,9 ms; `Game.updateCollectibles()` inklusive Fang-Verarbeitung maximal
11,0 ms. Ein Fang erzeugt einen neuen Text mit anschließendem Umbruch-Setter
und setzt weitere HUD-Werte. Diese Werte stammen aus Methoden-Timern mit
verschachtelten Aufrufen und Messaufwand. Sie belegen CPU-Spitzen im Test,
aber keine Zuordnung des späteren 83,3-ms-Frames zu einer Fang-Anzeige.
Eine begrenzte Wiederverwendung von Labels ist ein weiterer Prüfkandidat;
ihre Wirksamkeit wurde in diesem Audit nicht getestet.

### Bewegungslogik und bewusste Effekte

`Player.move()` verwendet `dtSec` für Position und exponentielle Annäherung
der Geschwindigkeit. Auch Änderungen des Serienbonus werden geglättet
(`src/entities/Player.ts:517`). Die Steuerung folgt absichtlich dem Fingerziel
mit Beschleunigung; sie klebt nicht direkt am Finger.

Bei einem Hindernistreffer aktiviert `GameScene` bewusst einen Kamerawackler
von 120 ms, sofern reduzierte Bewegung nicht gewünscht ist
(`src/scenes/GameScene.ts:838`). Das erklärt einzelne Trefferreaktionen,
aber nicht durchgehend unruhige Bewegung. Die Silberhain-Runs enthalten
keine Hindernisspawns und prüfen diesen Effekt nicht.

### Objektmengen sind begrenzt, ein Leck ist damit nicht ausgeschlossen

Solo-Spawns berücksichtigen `MAX_ACTIVE_COLLECTIBLES = 14`; aktive Fang-
Effekte sind auf acht begrenzt. Eingesammelte Relikte werden zerstört.
Synchronisierte Duelle verwenden eine andere Kapazitätsregel und wurden
hier nicht gemessen. Ein begrenzter Einzel-Run ist keine Langzeit-
Speicherleckprüfung.

## Konsequenz

Für unruhige Bewegung muss die dauerhafte Renderarbeit geprüft werden,
zusätzlich zu kurzen Fang-Spitzen. Die automatische Effektabsenkung reagiert
weiterhin auf langsame Median-Fenster und wirkt erst beim nächsten Szenenstart;
sie ist kein unmittelbarer Schutz gegen kurze Hänger.

Die weitere Umsetzung sollte zuerst bestätigte redundante Updates entfernen,
dann die gemessenen Graphics-Flächen optimieren und eine leichte
Produktionsmessung für das betroffene iPhone ergänzen. Rendering, tatsächliche
Touch-Eingabe, Temperaturentwicklung und Frame-Spitzen sind am Gerät gemeinsam
zu prüfen. Grenzwerte und ein mobiles Renderbudget sind anhand dieser Daten
festzulegen, nicht anhand der Desktop-FPS.

Messdaten: [vollständige Runs](audits/2026-10-10/gameplay-full-runs.json) und
[kurze Einzelversuche](audits/2026-10-10/gameplay-micro-probes.json).

## Umgesetzte Fixes und Vergleichsmessung (10.10.2026)

Der Benutzerauftrag „fix das“ wird als Runtime-Fix umgesetzt, nicht als weitere
reine Audit-Veroeffentlichung. Timer-Farbe, ortsfeste Fang-Maske und Media-
Abfragen vermeiden redundante Arbeit. Die statischen Sternkreise werden
durch kleine Texturen und GPU-Sprite-Puffer ersetzt. Automatische Absenkung
ersetzt die schwere Kulissen-/Kameradekoration bereits im laufenden Run.

Zwei weitere vollstaendige 90-Sekunden-Runs wurden nach den Fixes mit
demselben Messverfahren gefahren. Waehrend dieser Vergleichsmessung wurden
keine weiteren Browsertests ausgefuehrt oder Runtime-Dateien geaendert.
Die Vergleichsprofile aggregieren `GraphicsWebGLRenderer` ueber alle
Call-Stack-Kontexte, nicht nur die Top-25-Liste.

| Messung                                | Voll ohne Talente vorher → nachher | Voll mit Talenten vorher → nachher |
| -------------------------------------- | ---------------------------------: | ---------------------------------: |
| Graphics-Self-Time, CPU-Samples        |                 3.641,3 → 724,3 ms |               3.320,9 → 1.138,5 ms |
| Timer-Neuzeichnungen                   |                         5.479 → 91 |                         5.489 → 91 |
| WebGL-Textur-Upload-Aufrufe            |                      7.226 → 1.863 |                      7.572 → 2.222 |
| Neuzeichnungen des Maskenrechtecks     |                          4.915 → 1 |                          5.163 → 1 |
| Maskentextur-Aktualisierungen nach Fix |                                  1 |                                  1 |

Graphics-Self-Time sank in diesen Profilen um 80,1 beziehungsweise 65,7 Prozent.
Die Effekte werden mit weniger CPU- und Upload-Arbeit dargestellt; es handelt
sich nicht um eine gemessene Beschleunigung des echten iPhone. Spawns und
Fangverlaeufe sind weiterhin kein identischer Replay.

Beide Fix-Runs erreichten das regulaere Ende, p95 blieb bei 16,7 ms und es gab
keine JavaScript-Seitenfehler. Ein spaeterer 83,4-ms-Frame im Run ohne Talente
bleibt nicht kausal zugeordnet. Kurze Haenger sind mit diesen Desktop-Profilen
deshalb nicht als vollstaendig beseitigt nachgewiesen.

Die Browser-Regression prueft normale und kritische Timerfarbe, Maskenruhe,
Kamera-Shake inklusive dessen Ende, beide Motion-Praeferenzen, Sternzahlen
sowie voll → mittel → sparsam ohne Wechsel von Figur, Wertung oder Run-Zeit.
Der Timer-Test wurde ohne Farbguard rot (92 Neuzeichnungen statt sekundenweise)
und mit Guard gruen. Masken- und Media-Regressionen wurden ebenfalls zuerst
gegen den unfixed Stand rot gefahren.

Rohdaten: [Fix-Runs](audits/2026-10-10/gameplay-fixed-runs.json) und
[Vergleichskennzahlen](audits/2026-10-10/gameplay-fix-comparison.json).

### Validierung der Fixes

`npm run verify` bestand mit 71 Testdateien und 770 Tests. Die Gameplay-
Browserregression bestand auch nach den finalen Aenderungen. Die Messdaten
tragen die lokale Version 0.1.426 und enthalten die noch uncommitteten Fixes;
sie beschreiben nicht den damaligen unveraenderten Live-Stand.

Die Lesbarkeitspruefung auf der RTX-5080-GPU bestand im vollstaendigen
Wiederholungslauf fuer alle zehn Welten. Der erste GPU-Lauf meldete fuer
Lichtkern 1,23 statt der erforderlichen 1,26; ein isolierter Nachtest ergab
1,38 und der vollstaendige Wiederholungslauf 1,37. Ein separater Checkout
des unveraenderten Commits 296c8d6 bestand auf derselben GPU mit 1,36.
Diese Abweichung ist nicht kausal zugeordnet; die gespeicherte Basis wurde
nicht veraendert. Der zusaetzliche Software-WebGL-Lauf wurde wegen seiner
langen Laufzeit abgebrochen und gilt nicht als bestanden.

Alle 90 Playtest-Schritte bestanden ohne `--sim`: 88 Schritte im
vollstaendigen Lauf, darunter WebKit, Navigation, Persistenz und drei
Solo-Welten. Nach einer Sitzungsunterbrechung wurden die beiden noch offenen
Challenge-Runden mit unveraenderten Pruefungen separat nachgeholt; Tageslauf
und Bot-Duell bestanden jeweils bis zum regulaeren Ende. Der Navigationstest
normalisiert jetzt zweizeilige Menuewoerter wie "Optio- / nen", bevor er den
tatsaechlichen Knopf anklickt.
