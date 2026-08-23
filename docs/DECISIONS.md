# Architekturentscheidungen (ADR)

Jede Entscheidung, die spaeter jemand hinterfragen wird, steht hier mit
Begruendung und den verworfenen Alternativen.

**Format:** Kontext → Entscheidung → Begruendung → Konsequenzen.
**Regel:** Entscheidungen werden nie geloescht. Ueberholte bekommen den Status
_Ersetzt durch ADR-XXXX_.

---

## ADR-0001 — TypeScript + Phaser 3 + Vite

**Datum:** 2026-08-12 · **Status:** Angenommen

### Kontext

2D-Spiel, muss auf dem Handy laufen, soll schnell testbar sein und von Anfang
an eine saubere, dokumentierte Struktur haben.

### Entscheidung

TypeScript (strict) mit Phaser 3, gebaut ueber Vite. Ausgeliefert als
Web-Anwendung.

### Begruendung

- **Sofort auf dem Handy testbar.** Der Dev-Server ist im WLAN erreichbar —
  ein Link, kein Build, keine Installation, kein Store.
- **Kostenlos verteilbar** ueber GitHub Pages, was ohnehin zum Repo gehoert.
- **TypeScript passt zum Anspruch.** Wenn Struktur und Dokumentation von
  Anfang an sauber sein sollen, ist ein Typsystem das wirksamste Werkzeug.
- **Phaser 3 ist reif.** Touch, Skalierung, Tweens, Partikel sind eingebaut;
  die Community ist gross und die Dokumentation gut.
- **Kein Sackgassen-Risiko.** Aus derselben Codebasis wird ueber Capacitor
  eine native App (M8, siehe ADR-0015), ohne Neuschreiben.

### Verworfene Alternativen

| Alternative                   | Warum nicht                                                                                                                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Godot (GDScript)**          | Staerker bei komplexen Spielen, aber schwerer Editor, langsamerer Weg zum ersten Test auf dem Geraet, und die Projektdaten sind weniger gut in Textform pflegbar. Fuer diese Spielmechanik ueberdimensioniert. |
| **Flutter + Flame**           | Gute native Leistung, aber kleineres Spiele-Oekosystem und der Web-Export ist schwerer als eine reine Web-App.                                                                                                 |
| **Unity**                     | Fuer ein 2D-Arcade-Spiel dieser Groesse deutlich zu viel Werkzeug, lange Build-Zeiten, Lizenzfragen.                                                                                                           |
| **Reines Canvas ohne Engine** | Klingt schlank, endet aber darin, Tweens, Szenenverwaltung und Eingabe selbst zu bauen.                                                                                                                        |

### Konsequenzen

- Wir sind an die Leistung des mobilen Browsers gebunden. Fuer diese Mechanik
  unkritisch, aber Grafikaufwand muss bewusst bleiben.
- Kein Zugriff auf native Funktionen bis Capacitor (M8, siehe ADR-0015).

---

## ADR-0002 — Keine Physik-Engine

**Datum:** 2026-08-12 · **Status:** Angenommen

### Kontext

Phaser bringt Arcade Physics mit. Das Spiel braucht Kollisionserkennung
zwischen Figur und Relikten.

### Entscheidung

Keine Physik-Engine. Bewegung wird manuell integriert, Kollision ist ein
Distanztest zwischen Kreisen.

### Begruendung

Gebraucht wird ausschliesslich "beruehren sich zwei Kreise?" bei maximal 14
Objekten. Arcade Physics wuerde dafuer Bodies, Gruppen und
Kollisionsaufloesung mitbringen, die nirgends benutzt werden.

Dazu ein praktisches Argument: Bei skalierten Sprites ist die Groesse des
Physik-Bodies eine bekannte Fehlerquelle. Der Distanztest arbeitet direkt mit
`collectRadius` — genau der Zahl, die als Ring um die Figur zu sehen ist. Das
Feedback ist dadurch garantiert ehrlich.

### Konsequenzen

- Der Test ist O(n) ueber alle Objekte. Bei 14 Objekten irrelevant; ab etwa
  200 braeuchte es ein raeumliches Gitter (in ARCHITECTURE.md vermerkt).
- Bewegung und Randabprall sind selbst geschrieben — dafuer vollstaendig
  nachvollziehbar.

---

## ADR-0003 — HUD als eigene Scene mit EventBus

**Datum:** 2026-08-12 · **Status:** Angenommen

### Kontext

Punktestand, Combo und Timer muessen waehrend des Runs angezeigt werden.

### Entscheidung

`HudScene` laeuft parallel zu `GameScene`. Kommunikation ausschliesslich ueber
einen typisierten Event-Bus.

### Begruendung

Ohne Trennung wuerde `GameScene` beides tun: simulieren und anzeigen. Sie
waere die Datei, die bei jeder Aenderung angefasst wird — und die, in der sich
Fehler verstecken.

Mit der Trennung laesst sich das HUD komplett umbauen, ohne die Simulation zu
beruehren. Die Simulation koennte sogar ohne HUD laufen (fuer Tests).

### Konsequenzen

- **Jeder Listener muss abgemeldet werden.** Der Bus ueberlebt Scene-Wechsel;
  ohne `offEvent` feuern Listener nach einem Restart doppelt. Diese Regel ist
  in CODE_STYLE.md 1.4 verankert.
- Ein zusaetzliches Konzept, das man verstehen muss.

---

## ADR-0004 — Prozedurale Texturen statt Asset-Dateien

**Datum:** 2026-08-12 · **Status:** Angenommen (befristet bis M4)

### Kontext

Der Prototyp braucht Grafiken. Echte Assets zu beschaffen kostet Zeit und
haette den ersten Spieltest verzoegert.

### Entscheidung

Alle Texturen werden beim Start aus Phaser-Graphics erzeugt (weiss gezeichnet,
zur Laufzeit getintet).

### Begruendung

- Das Spiel ist ohne einen einzigen Download lauffaehig.
- **Eine** Textur bedient sechs Seltenheiten und fuenf Welten.
- Der Austausch beruehrt nur `src/ui/textures.ts` — die Texture-Keys bleiben,
  Spielcode aendert sich nicht.

### Konsequenzen

- Der visuelle Anspruch ist begrenzt. Das ist fuer einen Prototyp richtig.
- Assets muessen spaeter weiss/graustufig geliefert werden, damit das Tinting
  weiter funktioniert (in ART_STYLE.md 7 festgehalten).

---

## ADR-0005 — Verpasste Relikte brechen die Combo nicht

**Datum:** 2026-08-12 · **Status:** Angenommen

### Kontext

Arcade-Spiele brechen Ketten ueblicherweise bei jedem Fehler.

### Entscheidung

Die Combo zerfaellt nur ueber **Zeit** (2,2 s ohne Fang), nie durch ein
verpasstes Relikt.

### Begruendung

Auf dem Handy sind Fehlgriffe haeufig Geraet- statt Spielerfehler:
Fettfinger, Ruckler, eingehender Anruf. Combo-Verlust dafuer fuehlt sich
unfair an — und Unfairness ist bei einer 60-Sekunden-Schleife toedlich, weil
sofort ein neuer Run beginnen soll.

Belohnt wird damit **durchgehender Flow** statt Fehlerfreiheit. Das passt zum
Designziel "in der Bahn spielbar".

### Konsequenzen

- Bei hoher Spawn-Dichte ist die Combo leichter zu halten. Beobachten und
  gegebenenfalls ueber `COMBO_GRACE_MS` nachziehen.
- Verpasste Relikte werden trotzdem gezaehlt — fuer spaetere Statistik.

---

## ADR-0006 — Spielstand in localStorage, versioniert

**Datum:** 2026-08-12 · **Status:** Angenommen

### Kontext

Level, XP, Talente und Erfolge muessen ueber Sitzungen hinweg erhalten bleiben.

### Entscheidung

`localStorage`, gekapselt hinter `SaveSystem`. Schema mit `SAVE_VERSION`
versioniert, `reconcile()` fuellt fehlende Felder auf.

### Begruendung

- Kein Backend, kein Login, kein Datenschutz-Aufwand.
- Die Kapselung macht einen spaeteren Wechsel auf Cloud-Saves (M5) zu einer
  Aenderung an genau einer Datei.
- `reconcile()` bedeutet: neue Felder brauchen **keine** Migration, nur
  Umbenennungen und Bedeutungswechsel tun das.

### Konsequenzen

- Spielstand haengt am Browser. Loeschen der Browserdaten loescht ihn.
- Kein Wechsel zwischen Geraeten bis M5.
- Der Spielstand ist manipulierbar. Fuer ein Einzelspieler-Spiel ohne
  Bestenliste akzeptabel — bei einer Online-Bestenliste (M5) muss die
  Bewertung serverseitig erfolgen.

**Nachtrag 2026-08-14 — Phase 2:** Mit `SAVE_VERSION = 2` wird die neue
90-Sekunden-Spielzeit und XP-Kurve eingefuehrt. Alte Spielstaende werden ueber
ihren bisherigen Level-plus-XP-Gesamtstand auf die neue Kurve abgebildet; der
Fortschritt wird nicht einfach verworfen. Level 100 ist das neue Maximum.

---

## ADR-0007 — Lizenz MIT (vorlaeufig)

**Datum:** 2026-08-12 · **Status:** Vorlaeufig — vor Veroeffentlichung bestaetigen

### Kontext

Ein Repository ohne Lizenz ist rechtlich "alle Rechte vorbehalten" — auch fuer
Mitwirkende.

### Entscheidung

MIT als Platzhalter.

### Begruendung

Unkompliziert und ueblich fuer Open-Source-Projekte. Solange das Repository
privat ist, hat die Wahl keine Wirkung.

### Zu klaeren vor der Veroeffentlichung

- Soll das Spiel ueberhaupt quelloffen sein?
- Bei kommerzieller Absicht: proprietaere Lizenz statt MIT.
- Assets aus fremden Quellen haben **eigene** Lizenzen, unabhaengig von dieser
  — sie gehoeren in eine `CREDITS.md`.

**Nachtrag 2026-08-12:** Das Repository ist inzwischen oeffentlich (noetig fuer
GitHub Pages ohne kostenpflichtigen Tarif). Die MIT-Lizenz ist damit wirksam.
Die Frage nach kommerzieller Absicht bleibt offen — eine spaetere Umstellung
gilt nur fuer neue Versionen, bereits veroeffentlichter Stand bleibt MIT.

---

## ADR-0008 — Duell lokal am Geraet, mit gleichem Seed und ohne Progression

**Datum:** 2026-08-12 · **Status:** Angenommen

### Kontext

Gewuenscht war ein Modus fuer zwei Spieler. Drei Bauformen kamen in Frage:
geteilter Bildschirm, abwechselnd am selben Geraet, oder ueber Netzwerk.

### Entscheidung

Abwechselnd am selben Geraet ("Hot Seat"). Beide Spieler bekommen **denselben
Seed**, spielen **ohne Talente** und das Duell **veraendert den Spielstand
nicht**. Ein Durchgang dauert 90 statt 60 Sekunden.

### Begruendung

**Gegen geteilten Bildschirm:** Auf 720 × 1280 blieben je Spieler 360 × 640
Pixel. Bei einem Sammelradius von 46 Pixeln waere das Spielfeld zu eng, und
zwei Daumen auf einem Handy behindern sich gegenseitig.

**Gegen Netzwerk als ersten Schritt:** Braucht Server-Infrastruktur, die es
nicht gibt (ADR-0010). Der lokale Modus liefert sofort Spielwert und legt
zugleich die Grundlage — ein Netzwerkduell ist danach im Wesentlichen
"derselbe Seed, andere Person, anderes Geraet".

**Fuer die drei Fairness-Regeln:** Jede verhindert einen konkreten Weg, auf dem
das Duell unfair wuerde — Glueck bei der Relikt-Verteilung, Talent-Vorsprung des
Geraetebesitzers, und ein Gast, der den fremden Spielstand veraendert.

**Fuer 90 Sekunden:** Ein einzelner Durchgang entscheidet alles. Mehr Zeit
bedeutet mehr Spawns und damit weniger Streuung — das Ergebnis bildet Koennen
ab statt Glueck.

### Konsequenzen

- **Das Spawning ist jetzt an Determinismus gebunden.** Zwei Aenderungen daran
  waren noetig (siehe ARCHITECTURE.md 4.1), und kuenftige Aenderungen koennen
  ihn unbemerkt brechen. Ein Vitest-Test dafuer ist in M2 vorgemerkt.
- Ein Duell dauert mit Uebergabe rund vier Minuten — laenger als die
  60-Sekunden-Schleife, fuer die das Spiel sonst gebaut ist. Das ist bei einem
  Modus fuer zwei Personen vertretbar.
- Talente wirken im Duell nicht. Wer sie erspielt hat, sieht dort keinen
  Nutzen — das muss die Oberflaeche erklaeren, sonst wirkt es wie ein Fehler.

---

## ADR-0009 — Vollbild ueber zwei getrennte Wege je Plattform

**Datum:** 2026-08-12 · **Status:** Angenommen

### Kontext

Die Adressleiste des Browsers nimmt auf dem Handy dauerhaft Platz weg und
stoert bei einem Spiel, das den ganzen Bildschirm nutzt.

### Entscheidung

Zwei Wege parallel:

1. **Fullscreen-API** ueber einen Knopf im Menue — dort, wo sie funktioniert.
2. **Installation als Web-App** ("Zum Home-Bildschirm") ueber ein
   PWA-Manifest — ueberall, und auf dem iPhone der einzige Weg.

Der Vollbild-Knopf erscheint nur, wenn die API verfuegbar ist. Auf iOS steht
stattdessen ein Installationshinweis in der Fusszeile.

### Begruendung

Apple gibt die Fullscreen-API auf dem iPhone nur fuer Videoelemente frei, nicht
fuer beliebige Elemente. Ein Vollbild-Knopf waere dort ein Knopf, der nichts
tut — schlimmer als kein Knopf.

Als installierte Web-App laeuft das Spiel dagegen auf allen Plattformen ohne
jede Browserleiste. Das Manifest bringt zusaetzlich Icon, Startfarbe und
Hochformat-Sperre mit.

### Verworfene Alternativen

| Alternative                              | Warum nicht                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| Nur Fullscreen-API                       | Laesst iPhone-Nutzer ohne Loesung — die Zielplattform.                           |
| Nur PWA                                  | Auf Android und Desktop ist ein Knopf der schnellere Weg.                        |
| Adressleiste per Scroll-Trick verstecken | Funktioniert seit Jahren unzuverlaessig und bricht die Scroll-Sperre des Spiels. |

### Konsequenzen

- Zwei Wege heissen zwei Pfade zum Testen und zwei Stellen, an denen sich
  Plattformverhalten aendern kann. Gekapselt in `src/core/display.ts`.
- Das Projekt hat jetzt PNG-Dateien im Repository (App-Icons). Sie werden von
  einem Skript erzeugt, nicht von Hand gemalt — die prozedurale Linie bleibt.

---

## ADR-0010 — Netzwerkduell: erst per geteiltem Link, Echtzeit spaeter

**Datum:** 2026-08-12 · **Status:** Vorgeschlagen — noch nicht umgesetzt

### Kontext

Naheliegende naechste Frage nach dem lokalen Duell: zwei Handys gegeneinander.

### Ausgangslage

Das Spiel liegt auf **GitHub Pages**. Das ist reines Datei-Hosting — es kann
keinen Server-Prozess ausfuehren, keine WebSocket-Verbindung halten und nichts
speichern. Jede Form von Netzwerkspiel braucht deshalb zusaetzliche
Infrastruktur, die es heute nicht gibt.

### Vorgeschlagene Reihenfolge

**Schritt 1 — Duell per geteiltem Link (kein Server noetig).**
Der Seed wandert in die Adresse:
`…/isiHunt/#duell=<seed>&punkte=<wert>`. Wer den Link oeffnet, spielt exakt
dieselbe Jagd und sieht die Vorlage im HUD. Das ist derselbe Modus wie heute,
nur ueber zwei Geraete und zeitversetzt.

- **Aufwand:** gering — die Seed-Mechanik steht bereits.
- **Ehrliche Grenze:** Punktzahlen im Link sind manipulierbar. Fuer ein Duell
  unter Bekannten unerheblich, fuer eine Bestenliste unbrauchbar.

**Schritt 2 — Echtzeit, beide gleichzeitig.**
Braucht einen Server fuer Verbindungsaufbau und Abgleich. Realistische
Optionen: ein kleiner WebSocket-Dienst (Fly.io, Railway) oder eine fertige
Echtzeit-Plattform. WebRTC verlagert die Spieldaten direkt zwischen die
Geraete, braucht aber trotzdem einen Server fuer den Verbindungsaufbau.

- **Aufwand:** deutlich hoeher — Verbindungsabbrueche, unterschiedliche
  Bildraten, Wiedereinstieg nach Anruf.
- **Vorbedingung:** laufende Kosten und ein Betreiber. Solange beides offen
  ist, bleibt Schritt 1 die bessere Antwort.

### Warum diese Reihenfolge

Schritt 1 liefert den Grossteil des Spielwerts ("ich fordere jemanden heraus")
zu einem Bruchteil des Aufwands und ohne laufende Kosten. Erst wenn sich
zeigt, dass das Zeitversetzte nicht reicht, lohnt sich Schritt 2.

### Konsequenzen

- Der Eintrag "Mehrspieler in Echtzeit — nicht geplant" in der Roadmap ist
  damit ueberholt und wurde korrigiert.
- Eine echte Online-Bestenliste setzt Schritt 2 voraus: Punkte muessen
  serverseitig bewertet werden (siehe auch ADR-0006, letzte Konsequenz).

**Nachtrag 2026-08-12:** Mit ADR-0011 kam ein Backend (Supabase) dazu. Der
Weg zum Echtzeitduell ist damit kuerzer als hier beschrieben — die
Infrastrukturfrage ist beantwortet, offen bleibt der Abgleich zweier
laufender Spiele.

---

## ADR-0011 — Bestenliste und Spielstand-Abgleich ueber Supabase, ohne Konto

**Datum:** 2026-08-12 · **Status:** Angenommen

### Kontext

Gewuenscht waren eine Bestenliste und ein Spielstand, der zwischen zwei Handys
umzieht. Beides scheitert an GitHub Pages: reines Datei-Hosting kann keinen
Server-Prozess ausfuehren und nichts speichern.

### Entscheidung

Supabase als Backend. **Keine Anmeldung**: Ein Spielstand gehoert einer
zufaelligen UUID, die nur lokal liegt. Fuer den Umzug erzeugt das erste Geraet
einen sechsstelligen Code mit 15 Minuten Gueltigkeit.

Der lokale Stand wird nach Solo-Runs automatisch hochgeladen, sobald der
Backend-Dienst erreichbar ist. Bei zwei vorhandenen Staenden entscheidet der
Nutzer nach einem sichtbaren Vergleich; ein besserer Cloud-Stand wird nie
still ueberschrieben.

### Begruendung

**Gegen Konten mit E-Mail oder Passwort:** Das Spiel dauert 60 Sekunden. Eine
Registrierung davorzuschalten, um einen Punktestand zu speichern, steht in
keinem Verhaeltnis — und wuerde personenbezogene Daten einbringen, die es
sonst nirgends gibt.

**Fuer den Code statt eines QR-Codes oder Links:** Sechs Zeichen tippt man in
zehn Sekunden ab, ohne Kamera, ohne zweiten Kanal. Das Alphabet laesst `I`,
`O` und `L` weg, weil man sie auf einem Handy mit `1` und `0` verwechselt; die
Eingabe bildet sie zusaetzlich auf ihre Zwillinge ab.

**Fuer die kurze Gueltigkeit:** Sechs Zeichen aus 33 sind rund eine Milliarde
Moeglichkeiten — ratbar, wenn man beliebig lange Zeit hat. Nach 15 Minuten ist
ein Treffer wertlos.

**Gegen automatische Konfliktuebernahme im Hintergrund:** Sie muesste bei
jedem Konflikt still entscheiden, welcher Stand gewinnt. Die falsche
Entscheidung kostet Wochen Fortschritt, und der Nutzer bemerkt sie erst, wenn
es zu spaet ist. Ein fehlertoleranter Upload ist davon getrennt: Er speichert
Offline-Runs nach, solange der Cloud-Stand nicht weiter ist.

### Ehrliche Grenze: die Bestenliste ist manipulierbar

Das Spiel laeuft vollstaendig im Browser, der Code ist oeffentlich, und der
Datenbankschluessel steht im ausgelieferten JavaScript — weil er dort stehen
muss. Wer will, traegt jede beliebige Zahl ein.

Das ist **keine Nachlaessigkeit, sondern die Grenze jeder Bestenliste ohne
serverseitige Nachrechnung des Runs**. Die einzige echte Loesung waere, den
kompletten Spielverlauf zu uebertragen und auf einem Server nachzuspielen.

Abgesichert ist deshalb nur, was sich ohne Server absichern laesst:

- Eintraege sind **unveraenderlich** — kein `UPDATE`, kein `DELETE`, schon auf
  der Rechteebene.
- Spielstaende sind nur mit Kenntnis ihrer zufaelligen UUID erreichbar (seit
  dem Nachtrag 2026-08-17 durch RPCs statt durch Tabellenrechte durchgesetzt).
- Sync-Codes verfallen (ebenfalls seit 2026-08-17 durch RPCs durchgesetzt).
- Wertebereiche und Namenslaengen sind in der Datenbank begrenzt.

**Konsequenz:** Fuer ein Duell unter Bekannten ist das unerheblich. Bevor die
Liste oeffentlich beworben wird, muss die Bewertung auf einen Server.

### Weitere Konsequenzen

- Das Projekt hat jetzt eine externe Abhaengigkeit, die ausfallen kann. Jede
  Netzfunktion hat deshalb ein Zeitlimit von fuenf Sekunden, gibt ein
  Ergebnisobjekt zurueck statt zu werfen, und die Online-Knoepfe erscheinen
  nur, wenn Zugangsdaten vorhanden sind.
- Wer das Repository ohne eigenes Supabase-Projekt auscheckt, kann trotzdem
  spielen — nur ohne Bestenliste und Abgleich.
- Der Abgleich **ersetzt** einen Spielstand, statt zwei zusammenzufuehren. Wer
  auf beiden Geraeten regelmaessig spielt, verliert bei jedem Abgleich eine
  Seite. Feldweises Zusammenfuehren waere moeglich, ist aber bei XP und
  Talenten nicht eindeutig — bewusst offen gelassen.

**Nachtrag 2026-08-13 — Phase 1.3:** Die Bestenliste ist standardmaessig eine
gemeinsame Top-10-Liste ueber alle Welten. `world_id` bleibt erhalten und wird
pro Zeile als Weltfarbmarker gezeigt; die Weltentabs sind optionale Filter.
Neben dem bestehenden Index fuer Weltfilter gibt es deshalb einen zweiten
Index auf `(score desc, created_at asc)` fuer die Gesamtliste.

Ausserdem wird ein Solo-Ergebnis automatisch eingetragen, sobald ein Name
gesetzt und der Backend-Dienst verfuegbar ist. Der bisherige Knopf im
Ergebnisbildschirm entfaellt. Ohne Namen, ohne Dienst oder bei einem
Netzfehler bleibt der Ergebnisbildschirm still und unveraendert. Duell-Runden
bleiben wegen der Fairness-Regel ausgeschlossen. Damit ist die fruehere
Entscheidung fuer einen manuellen Eintrag ersetzt; der manuelle
Spielstand-Abgleich bleibt davon unberuehrt.

**Nachtrag 2026-08-14 — automatische Spielstand-Sicherung:** Der Button
`SPIELSTAND` im Hauptmenue wurde zu `EINSTELLUNGEN`; die Geraeteuebertragung
bleibt dort als kindgerechte Option erhalten. Ein Solo-Run laedt den lokalen
Stand automatisch hoch. Bei fehlendem Netz bleibt `localStorage` die
massgebliche Quelle; beim naechsten Start oder nach Rueckkehr des Netzes wird
erneut geprueft. Ein weiterentwickelter Cloud-Stand verlangt eine sichtbare
Entscheidung.

**Nachtrag 2026-08-13:** Die Bestenliste speichert je `SaveData.cloudId` nur
noch den besten Lauf. Der Client schreibt nicht mehr direkt in `scores`,
sondern ruft `submit_best_score` auf. Die Datenbank entscheidet atomar ueber
den hoechsten Score; dadurch entstehen bei schnellen oder parallelen Runs
keine Duplikate. Die bisherige Liste wird einmalig und bewusst ueber
`supabase/cleanup_leaderboard.sql` geloescht.

**Nachtrag 2026-08-17 — Korrektur: "nur mit Kenntnis der UUID erreichbar" war
falsch begruendet.** `saves` und `sync_codes` hatten direkte Tabellenrechte
(`grant select, insert, update`) mit `using (true)`-Policies. Das schuetzt
nichts: PostgREST erlaubt ungefilterte Abfragen wie
`GET /rest/v1/saves?select=*`, und RLS filtert dabei keine Zeile heraus, wenn
die Policy jede Zeile erlaubt. Jeder mit dem oeffentlichen anon-Key — also
jeder Browser, der das Spiel laedt — konnte damit alle Spielstaende lesen und
ueberschreiben sowie alle gueltigen Sync-Codes samt `save_id` auflisten, ohne
die 6-stellige Rateschranke zu benoetigen. Die bisherige Formulierung "die
Sicherheit liegt in der Unratbarkeit der UUID, nicht in der Regel" beschrieb
nur, wie der eigene Client fragt (`eq('id', ...)`) — nicht, was die
Schnittstelle erlaubt.

**Fix (`supabase/phase_2_10_lock_saves_access.sql`):** Direkte Rechte auf
`saves` und `sync_codes` fuer `anon`/`authenticated` entzogen. Zugriff laeuft
jetzt ausschliesslich ueber security-definer-RPCs (`get_save`, `upsert_save`,
`create_sync_code`, `redeem_sync_code`), die `id`/`code` als Argument nehmen —
dasselbe Muster, das fuer `scores` bereits seit `submit_best_score` gilt.
`CloudSystem.ts` ruft diese RPCs auf statt `.from('saves')`/`.from('sync_codes')`
direkt anzusprechen.

---

## ADR-0012 — Zugangsdaten des Clients liegen im Repository

**Datum:** 2026-08-12 · **Status:** Angenommen

### Kontext

Der Supabase-Client braucht Projekt-URL und oeffentlichen Schluessel. Beide
muessen zur Bauzeit vorliegen, auch im GitHub-Actions-Build.

### Entscheidung

Beide Werte stehen in `.env.production` und sind eingecheckt. Der geheime
Schluessel (`service_role` bzw. `secret`) ist ausgeschlossen — er darf das
Repository und den Client nie beruehren.

### Begruendung

Der `publishable`-Schluessel ist dafuer gemacht, oeffentlich zu sein. Er landet
ohnehin im ausgelieferten JavaScript; jeder Besucher kann ihn aus dem Browser
auslesen. Ihn zusaetzlich in Repository-Secrets zu legen, waere ein
Scheinschutz — am Ergebnis im Browser aendert sich nichts.

Der eigentliche Schutz liegt in den Zugriffsregeln der Datenbank
(`supabase/schema.sql`). Sie legen fest, was mit diesem Schluessel moeglich
ist.

### Konsequenzen

- Ein Schluesselwechsel braucht einen Commit. Bei einem oeffentlichen
  Schluessel unkritisch.
- Die Trennung muss beim Lesen sofort erkennbar sein: `.env.production` und
  `config/backend.ts` benennen beide ausdruecklich, welcher Schluessel hier
  gehoert und welcher nie.
- Wer die Werte lieber nicht im Repository haette, legt sie als
  Repository-Secrets an und reicht sie in `deploy.yml` durch. Der Code aendert
  sich dafuer nicht.

---

## ADR-0013 - Themenwechsel von Fantasy zu Weltraum

**Datum:** 2026-08-14 · **Status:** Angenommen

### Kontext

Die bisherige Fantasy-Sprache mit Wald, Gletschern und Relikten war ein
Platzhalter fuer die Spielmechanik. Die Kernschleife funktioniert inzwischen:
90-Sekunden-Runs, Weltenauswahl, Progression und automatische Sicherung sind
stabil. Phase 3 gibt dem Spiel jetzt eine eigene visuelle Identitaet.

### Entscheidung

isiHunt wird als Weltraum-Arcade weiterentwickelt. Die Spielfigur ist ein
kleines Licht-Raumschiff, die einsammelbaren Relikte werden als Planeten
dargestellt und die Welten werden zu Raumzonen. Die sechs Seltenheitsfarben
bleiben unveraendert, weil sie die wichtigste Lesesprache fuer den Wert sind.

Die bestehenden Welt-IDs bleiben unveraendert. Dadurch bleiben lokale
Spielstaende, Freischaltungen und gespeicherte Bestenlisten-Weltmarker
kompatibel; nur Namen, Beschreibungen und die Darstellung wechseln.

### Verworfene Alternative

Ein kompletter Neustart mit neuen IDs und einer neuen Spielstandsstruktur
waere technisch sauber, wuerde aber bestehende Fortschritte und Weltmarker
brechen. Der visuelle Wechsel liefert denselben Nutzen ohne Datenmigration.

### Konsequenzen

- Die prozeduralen Texture-Keys bleiben stabil; nur ihre Formen aendern sich.
- Hintergrundsterne und Nebel werden zur gemeinsamen Sprache aller Raumzonen.
- Mechanische Weltmodifikatoren bleiben getrennt und werden erst spaeter
  implementiert; der Themenwechsel veraendert das Balancing nicht.
- Echte Raumschiff-/Planeten-Skins koennen spaeter je nach Level folgen.

---

## ADR-0014 — Login und dauerhaftes Profil auf mehreren Geräten

**Datum:** 2026-08-14 · **Status:** Geplant, Phase 2.6 priorisiert

### Kontext

Der bestehende sechsstellige Sync-Code ist für einen einmaligen Gerätewechsel
geeignet. Nach dem Einlösen kennen beide Geräte zwar dieselbe `cloudId`, aber
der nächste vollständige Upload kann den Fortschritt des anderen Geräts
ersetzen. Gewünscht ist ein gemeinsames Profil auf iPhone und iPad.

### Entscheidung für die Planung

Supabase Auth verwaltet ein plattformübergreifendes Login. Eine Zeile in
`profiles` gehört zu `auth.users.id`; alle Geräte, die sich mit diesem Login
anmelden, gehören zum selben Profil. Das Backend speichert Fortschritts-
ereignisse mit eindeutiger `event_id` und führt sie idempotent zusammen.

Der erste Weg ist Alias/Passwort. Supabase Auth akzeptiert beim
Passwort-Login technisch E-Mail oder Telefonnummer, daher wird aus dem
normalisierten Alias eine pseudonyme technische interne Auth-ID
gebildet. Der Spieler gibt keine E-Mail an und sieht auch keine. Der Alias ist
3 bis 16 Zeichen lang und nutzt nur `a-z`, `0-9`, `-` und `_`. Apple-Login oder
eine optionale Wiederherstellungsadresse können später für die native App
ergänzt werden. Ein Pflichtkonto ist erst aktiv, wenn diese Phase gebaut ist;
bestehende lokale Profile bleiben bis dahin nutzbar.

Für den Alias-only-Betrieb muss im Supabase-Dashboard die Bestätigungspflicht
für E-Mail-Accounts deaktiviert werden. Ohne diese Einstellung würde Supabase
eine Bestätigung an die interne technische Adresse
verlangen.

### Konfliktregeln

- XP und Coins aus bestätigten Solo-Runs werden genau einmal gutgeschrieben.
- Erfolge werden als Mengenunion behandelt.
- Bestwert und Best-Combo nehmen jeweils den höheren Wert.
- Namensänderungen werden als bewusste letzte Änderung gespeichert und auf
  allen Geräten angezeigt.
- Talentkäufe werden serverseitig atomar gegen verfügbare Punkte geprüft.
- Offline-Runs bleiben in einer lokalen Outbox, bis der Server sie bestätigt.

### Migration und Konsequenzen

Bestehende `cloudId`-Profile können nach dem ersten Login übernommen werden;
der alte Sync-Code bleibt zunächst als einmaliger Migrations- und Notfallweg.
Supabase erhält dafür Profil-, Ereignis- und RLS-Regeln. Der spätere
Capacitor-/TestFlight-Weg verwendet dieselbe Profil-ID und benötigt keine
zweite Synchronisationsarchitektur.

---

## ADR-0015 — Native App über Capacitor, iOS-Build und TestFlight-Auslieferung über Codemagic

**Datum:** 2026-08-17 · **Status:** Geplant, Vorbereitung fuer M8

### Kontext

isiHunt soll kuenftig ueber TestFlight an Tester ausgeliefert werden koennen.
ADR-0001 hat diesen Weg von Anfang an vorgesehen ("aus derselben Codebasis
wird ueber Capacitor eine native App, ohne Neuschreiben"), und ADR-0014 hat
die Profil-Architektur bereits so gebaut, dass "der spaetere
Capacitor-/TestFlight-Weg dieselbe Profil-ID verwendet und keine zweite
Synchronisationsarchitektur benoetigt". Es fehlte bisher eine konkrete
Entscheidung zu Build-Weg und Signing. Randbedingung: kein Mac vorhanden, und
keiner wird angeschafft — der iOS-Build muss vollstaendig cloud-basiert
erfolgen. Ein Apple Developer Account existiert; sein genauer Status
(Mitgliedschaft aktiv, Team-ID) ist ungeprueft und muss vor Beginn der
Umsetzung geklaert werden.

### Entscheidung

Capacitor wird als Wrapper um die bestehende Vite/Phaser-Codebasis gelegt
(kein Rewrite). Build und Signing fuer iOS laufen vollstaendig cloud-basiert
ueber **Codemagic**, mit Signing ueber eine App Store Connect API Key
Integration. Die Auslieferung an Tester erfolgt ueber TestFlight. Der
bestehende Web-Weg (GitHub Actions → GitHub Pages) bleibt unveraendert
parallel bestehen; Codemagic kommt als zusaetzliche, getrennte Pipeline
hinzu, ohne `.github/workflows/ci.yml` oder `deploy.yml` anzufassen.

Diese Entscheidung betrifft **nur die Vorbereitung und den technischen Weg**.
Die tatsaechliche Umsetzung (Capacitor-Pakete einbinden, `ios/`-Ordner
erzeugen, `codemagic.yaml` bauen) bleibt Teil von M8 und wird nicht
vorgezogen — M4.1, M6 und M7 stehen davor.

### Begründung

- **Kein Mac vorhanden.** Codemagic uebernimmt den macOS-Build in der Cloud;
  eine Anschaffung oder Miete eines Macs entfaellt.
- **Gefuehrtes Signing statt manuellem Zertifikats-Handling.** Die App Store
  Connect API Key Integration zieht Zertifikat und Provisioning Profile
  automatisch — die Alternative (Fastlane + selbstverwaltete Zertifikate)
  waere ohne physischen Mac zum Debuggen deutlich fehleranfaelliger.
- **Kein Sackgassen-Risiko.** Die Codebasis wird nicht neu geschrieben — das
  war bereits die Kernbegruendung fuer Phaser in ADR-0001.
- **Backend ist bereits vorbereitet.** ADR-0014 hat die Profil-/Login-Struktur
  plattformuebergreifend gebaut; die native App braucht keine zweite
  Synchronisationsarchitektur.

### Konsequenzen

- Neuer `ios/`-Ordner (natives Xcode-Projekt, von Capacitor erzeugt) sowie
  `capacitor.config.ts` und `codemagic.yaml` kommen bei der Umsetzung ins
  Repository. Der `ios/`-Ordner ist ohne Mac lokal nicht oeffenbar; seine
  Pflege laeuft praktisch ausschliesslich ueber Codemagic-Logs.
- `src/core/updateCheck.ts` und das `version.json`-Update-Hinweis-Verfahren
  funktionieren in einer nativen App nicht wie im Browser — `version.json`
  liegt nur im gebuendelten Snapshot, ein Vergleich gegen sich selbst findet
  nie eine neuere Version. Die native Variante braucht eine eigene Loesung
  (deaktivieren oder TestFlight-Hinweis); die konkrete Wahl wird erst mit der
  M8-Umsetzung getroffen.
- TestFlight-Freigaben fuer externe Tester durchlaufen Apples Beta App
  Review (bis zu 24–48h), was ausserhalb eigener Kontrolle liegt.
- Bundle-ID-Wahl, Android-Reihenfolge und die Vorbereitung fuer Push/Live
  Activities sind bewusst offen gelassen und werden erst bei M8-Start
  entschieden.

### Verworfene Alternativen

| Alternative                                   | Warum nicht                                                                                                                                                                                                                  |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fastlane + GitHub-Actions-macOS-Runner**    | Technisch gleichwertig erreichbar, aber manuelles Zertifikats-/Profil-Management ist ohne physischen Mac zum Debuggen deutlich fehleranfaelliger, und macOS-Runner-Minuten sind bei GitHub Actions teurer als Linux-Minuten. |
| **Eigener Mac oder Mac-in-Cloud-Miete**       | Laufende Kosten und Wartungsaufwand fuer ein Werkzeug, das nur gelegentlich gebraucht wird. Explizit vom Nutzer abgelehnt.                                                                                                   |
| **Neuschreiben in React Native oder Flutter** | Wuerde die gesamte bestehende Phaser-Codebasis verwerfen und widerspricht der in ADR-0001 begruendeten Wahl, aus genau diesem Grund auf Capacitor zu setzen.                                                                 |

---

## ADR-0016 — Debug-Modus fuer Tester: PIN-freier Zugang, Modul-Singleton, Web-Share-API

**Datum:** 2026-08-17 · **Status:** Angenommen

### Kontext

Bugs auf Testgeraeten (v.a. bei Emre und Simay) waren bisher schwer zu
diagnostizieren: keine Konsole am iPhone, und Rueckmeldungen ohne
Versionsnummer/Zustand haben bereits Fehlersuchrunden gekostet
(`CODE_STYLE.md` 1.9). Der bestehende Wartungsbildschirm (`AdminScene`) ist
bewusst PIN-geschuetzt, weil er den Spielstand loeschen kann — fuer "auf
jedem Handy ohne Admin einschaltbar" ist er deshalb ungeeignet.

### Entscheidung

Ein zweiter, **PIN-freier** Debug-Modus: zehnmal aufs Logo im Hauptmenue
tippen schaltet ihn um (`MenuScene`, `DebugSystem.registerLogoTap()`). Aktiv
zeigt ein schwebender DOM-Knopf (`ui/debugOverlay.ts`) ueberall im Spiel, der
bei Tipp einen Report (Geraet/Version/Layout/Ton-Diagnose plus ein
rollierendes Ereignis-/Fehler-Log der letzten 200 Eintraege) und einen
Screenshot erzeugt und beides ueber `navigator.share()` an das native
Share-Sheet uebergibt.

Der Ringpuffer laeuft ab dem allerersten Moment des App-Starts mit, nicht
erst ab Aktivierung des Debug-Modus: `DebugSystem.logAppStart()` haelt
Version, Startweg (Standalone/Browser) und Netzwerkstatus als ersten Eintrag
fest, und `DebugSystem.installConsoleCapture()` faengt `console.warn`/
`console.error` global ab und schreibt jeden Aufruf zusaetzlich in den
Puffer — das deckt die bereits bestehenden `console.warn`-Stellen in
`SaveSystem`, `CloudSystem`, `ProgressSyncSystem` usw. automatisch ab, ohne
jede einzeln anzufassen.

Drei Architekturentscheidungen dabei, die von den sonst geltenden Regeln
abweichen und deshalb hier begruendet werden:

1. **Der schwebende Knopf ist ein DOM-Element, keine Phaser-Scene.** Eine
   Parallel-Scene (analog `HudScene`) muesste in allen 17 Scenes einzeln
   gestartet werden, um wirklich ueberall sichtbar zu sein — eine
   Fehlerquelle, die eine neue Scene leicht vergisst. Ausserdem laege sie im
   gemeinsamen Canvas und muesste vor jedem Screenshot versteckt werden. Ein
   DOM-Overlay hat keine Scene-Grenze und landet automatisch nicht im
   Canvas-Screenshot. Vorbild: `RulerScene.installViewportRuler()` und
   `ui/hitDebug.ts::ensurePanel()` machen dieselbe Technik bereits vor.
2. **Der Ereignis-Ringpuffer bekommt bewusst kein `offEvent`.** Regel 1.4
   ("jeder `eventBus.onEvent` braucht ein `offEvent` im SHUTDOWN-Handler")
   gilt fuer Scenes, die wiederholt erzeugt und zerstoert werden — ohne
   Abmeldung entstehen doppelte Listener. Der Ringpuffer-Listener gehoert
   dagegen zu einem Modul-Singleton (wie `eventBus` selbst), das einmal beim
   App-Start verdrahtet wird und bis zum Schliessen der Seite lebt. Es gibt
   keinen "Neustart", an den ein Abmelden andocken koennte.
3. **Web-Share-API als neue Browser-Abhaengigkeit ohne Server-Gegenstueck.**
   `navigator.share()` mit `files`-Array ist in iOS Safari und
   Standalone-PWA lauffaehig. Fehlt die API (Android-Browser ohne
   Unterstuetzung, Desktop), faellt das System auf einen unsichtbaren
   Download-Link zurueck — bewusst ohne Zwischenablage-Fallback, da die
   Zielplattform iOS ist und ein Kind nicht selbst zwischen Apps wechseln
   soll.

### Begruendung

Der PIN-Schutz des Wartungsbereichs existiert, weil dieser schreibend in den
Spielstand eingreifen kann. Der Debug-Modus liest ausschliesslich — er
veraendert nichts am Spielstand oder Backend — und darf deshalb ohne
Berechtigungspruefung zugaenglich sein. Die Geste (zehn Tipps in einem
Zeitfenster) verhindert ein versehentliches Ausloesen durch normales Spielen,
ohne eine Huerde wie eine PIN aufzubauen.

### Konsequenzen

- Neue Dateien: `config/DebugConfig.ts`, `systems/DebugSystem.ts` (+Test),
  `ui/debugOverlay.ts`. `SoundSystem.formatDiagnostics()` wurde aus
  `AdminScene` herausgehoben, damit Wartungsbildschirm und Debug-Report
  dieselbe Formatierung teilen statt sie zu duplizieren.
- Der Debug-Modus-Zustand liegt in einem eigenen localStorage-Schluessel
  (`isihunt.debug-mode.v1`), getrennt vom Spielstand — Praezedenzfall:
  `SaveSystem.TEST_PROFILE_KEY`.
- Die Puffergroesse wuchs von urspruenglich 50 auf 200 Eintraege, weil der
  Puffer seit dem Konsolen-Abgriff und der App-weiten Laufzeit (statt nur
  eines Runs) deutlich schneller befuellt wird. Seit v0.1.252 steht sie auf
  **1000** mit einer ausdruecklichen Zusage: ein vollstaendiger
  90-Sekunden-Run passt samt Vor- und Nachlauf hinein (Rechnung in
  `DebugConfig.ts`, nachgerechnet am Geraetebericht vom 2026-08-23). Die
  Kosten wurden gemessen statt geschaetzt: ~250 KB Nutzdaten (rund 5% der
  iOS-Grenze von 5 MB pro Origin), ~0,5 ms je `JSON.stringify`, und durch die
  500-ms-Drosselung in `schedulePersist()` hoechstens zwei Schreibvorgaenge
  pro Sekunde - unabhaengig von der Puffergroesse.
- **Ein zweiter, geschuetzter Puffer fuer seltene Ereignisse (seit
  v0.1.251).** Die Groesse allein loest das Verdraengungsproblem nicht: ein
  Fang erzeugt drei Eintraege, und der Geraetebericht vom 2026-08-23 zaehlte
  148 Relikte in einer Runde - 444 Eintraege gegen 400 Plaetze. Alles vom
  Rundenstart war am Rundenende weg, einschliesslich der eigens fuer die
  Fehlersuche eingebauten Kanal- und Sendeprotokollierung. Den Hauptpuffer
  weiter zu vergroessern waere der falsche Hebel, weil er bei jeder Aenderung
  vollstaendig nach `localStorage` serialisiert wird. Stattdessen nimmt
  `pushProtectedLogEntry()` seltene Ereignisse in einen eigenen kleinen
  Puffer (`DEBUG_PROTECTED_BUFFER_SIZE`), der im Bericht getrennt ausgegeben
  wird. **Die Trennlinie ist die Ereignisrate, nicht die Wichtigkeit** -
  sonst wandert nach und nach alles in den geschuetzten Puffer und das
  Problem beginnt von vorn.
- Ob WhatsApp beim Teilen von zwei Dateien (PNG + TXT) beide uebernimmt oder
  nur eine, ist am Schreibtisch nicht pruefbar und bleibt bis zum ersten
  echten Geraetetest ungeprueft (No-Guess-Vertrag).
- **Der Screenshot haengt am WebGL-Zeichenpuffer, und der haengt am
  Debug-Modus — nicht am Build.** `canvas.toBlob()` liest ein schwarzes Bild,
  wenn WebGL seinen Puffer nach dem Frame freigibt; `preserveDrawingBuffer`
  muss beim Erzeugen des Kontexts gesetzt sein und ist zur Laufzeit nicht
  umschaltbar. Bis v0.1.249 war die Bedingung dafuer `import.meta.env.DEV` —
  also genau falsch herum: der Debug-Modus wird per Zehnfach-Tipp auf dem
  Geraet eingeschaltet, im Production-Build. Jeder Fehlerbericht vom Handy
  trug deshalb ein schwarzes Bild (belegt 2026-08-23), waehrend es im
  Dev-Build funktionierte und deshalb nie auffiel. Seit v0.1.250 entscheidet
  der gespeicherte Debug-Modus (`DEBUG_MODE_STORAGE_KEY`, beim Start
  gelesen); der Bericht nennt im Abschnitt SCREENSHOT ausserdem, ob ein Bild
  ueberhaupt moeglich ist, und verlangt sonst einen Neustart. Die Kosten
  (gehaltener Puffer) fallen damit nur dort an, wo Berichte entstehen.

  Die allgemeine Lehre: **eine Diagnose-Funktion darf nicht an einem Flag
  haengen, das im Diagnosefall falsch steht.** Debug-Werkzeuge werden
  definitionsgemaess dort gebraucht, wo der Dev-Build nicht laeuft.

---

## ADR-0017 — Login-Alias und Anzeigename zu einer Identitaet vereinheitlicht

**Datum:** 2026-08-17 · **Status:** Angenommen

### Kontext

`profiles.alias` (Login-Kennung, technisch Teil der internen Auth-Adresse)
und `profiles.player_name` (sichtbarer Name im Spiel/Bestenliste) liefen als
zwei unabhaengig editierbare Felder auseinander: ein Admin-Konto hatte Alias
`byi77`, aber Anzeigename `Yavuz`. Das Wartungsdashboard
(`get_admin_dashboard`) zeigt ausschliesslich `player_name`; der
Boost-/Reset-Werkzeugkasten (`admin_boost_user`, `admin_reset_user`) sucht
ausschliesslich nach `alias_normalized`. Ohne Verbindung zwischen beiden war
ein von einem Spieler genannter Name im Wartungsbereich nicht zuverlaessig
wiederzufinden.

### Entscheidung

Ein Konto hat ab sofort nur noch einen Namen, der gleichzeitig Login-Alias
und Anzeigename ist. Es gelten durchgehend die bisherigen (strengeren)
Alias-Regeln: 3-16 Zeichen, nur `a-z`, `0-9`, `-` und `_`, klein geschrieben.
`sanitizePlayerName` wendet dieselbe Regel an wie `AuthSystem.isValidAlias`.
`update_profile_name` und `update_profile_alias` wurden durch eine einzige
SQL-Funktion `update_profile_identity` ersetzt, die `alias`,
`alias_normalized`, `player_name` und `data.playerName` in einem Schritt
setzt; die alten Funktionsnamen bleiben als duenne SQL-Huellen bestehen, die
intern auf die neue Funktion delegieren, damit ein Rollout keine strikte
Reihenfolge zwischen Migration und Client-Deploy braucht. Client-seitig
ersetzt `CloudSystem.updateProfileIdentity` die bisherigen
`updateProfileName`/`updateProfileAlias`.

Fuer Bestandsprofile (u. a. das Admin-Konto) gewinnt beim einmaligen
Migrationslauf `player_name`: er wird normalisiert (klein geschrieben, alles
ausser `a-z0-9_-` entfernt, auf 16 Zeichen gekuerzt) und als neuer `alias`
uebernommen. Kollidieren zwei Profile nach der Normalisierung, erhaelt das
juengere einen Zahlen-Suffix (`emre_2`), damit kein Konto verloren geht oder
ein anderes stillschweigend ueberschreibt.

### Begruendung

- Es gibt keinen Gastmodus. `MenuScene` verlangt fuer jeden Spieler ohne
  `save.playerName` ein Konto (`AccountScene`, `firstStart: true`), und
  `ensureFirstStartOnline()` blockt den Erststart ganz ohne Internet. Die
  fruehere Trennung "freier Anzeigename fuer alle, strenger Alias nur fuer
  eingeloggte Nutzer" hatte damit keine reale Zielgruppe mehr, fuer die sie
  noetig gewesen waere.
- Zwei unabhaengig aenderbare Namen fuer dieselbe Person sind der eigentliche
  Fehlerherd: jedes Werkzeug, das nur eines der beiden Felder kennt, wird
  frueher oder spaeter am falschen Namen suchen.

### Konsequenzen

- `PLAYER_NAME_MAX_LENGTH` wurde von 12 auf 16 angehoben, um exakt
  `AuthSystem.ALIAS_MAX_LENGTH` zu entsprechen — beide Konstanten bezeichnen
  jetzt denselben Wert.
- Anzeigenamen verlieren Grossschreibung und Sonderzeichen ausserhalb von
  `-`/`_`. Ein bisheriger Anzeigename wie `Emre` erscheint nach der Migration
  als `emre`.
- `supabase/phase_2_8_unify_identity.sql` muss nach `phase_2_7_admin_tools.sql`
  einmalig manuell im Supabase SQL-Editor ausgefuehrt werden — es gibt keinen
  automatischen Migrationsweg in diesem Projekt.
- **Nachtrag:** `phase_2_8_unify_identity.sql` aenderte `profiles.alias`,
  liess aber `auth.users.email` unangetastet, gegen die der Login tatsaechlich
  prueft. Betroffene Konten waren dadurch nach der Migration ausgesperrt.
  `supabase/phase_2_9_fix_auth_email_sync.sql` gleicht `auth.users.email`
  nachtraeglich an und korrigiert `update_profile_identity`, damit auch
  kuenftige Namensaenderungen die Login-Adresse mitziehen. Ebenfalls
  einmalig manuell auszufuehren, nach `phase_2_8_unify_identity.sql`.

---

## ADR-0018 — Talente bleiben bei Coin-Kosten; der Talentpunkte-Umbau wird verworfen

**Datum:** 2026-08-21 · **Status:** Angenommen

### Kontext

Seit dem 2026-08-19 stand die Idee im Raum, Talente nicht mehr mit Muenzen zu
bezahlen, sondern mit Talentpunkten, die es bei jedem Levelaufstieg gibt. Die
Begruendung lautete: **der Reiz von Talentpunkten liegt im Verzicht** — wer
nur begrenzt viele Punkte hat, muss sich entscheiden.

Die Frage blockierte vier Punkte in der Planung (Baumausbau, Migration,
Punkteanzahl, Bezeichnung) und stand an drei Stellen gleichzeitig in `TODO.md`,
wobei die entscheidende Rechnung nur an einer davon notiert war.

**Nachgerechnet am 2026-08-21 (aus `config/talents.ts` und `config/shop.ts`):**

|              |      Anzahl | Kosten |
| ------------ | ----------: | -----: |
| Talente voll |   32 Raenge | 15 650 |
| Shop voll    | 130 Artikel | 16 122 |
| zusammen     |             | 31 772 |

Bei rund 475 Muenzen am Tag (zehn Runs mittlerer Guete, Login-Bonus und
Tageslauf eingerechnet) sind das 33 Tage fuer die Talente, 34 fuer den Shop.

### Entscheidung

**Talente werden weiterhin mit Muenzen gekauft.** Der Umbau auf Talentpunkte
wird verworfen, nicht vertagt.

Zwei Gruende, der erste ist der ausschlaggebende:

**1. Der Verzicht existiert bereits.** Shop und Talente kosten fast exakt
dasselbe. Seit der Shop am 2026-08-20 ausgeliefert wurde, geht jede Muenze
entweder in einen Talentrang oder in eine Fluggestalt — eine echte, taeglich
wiederkehrende Abwaegung. Der Umbau wuerde sie **abschaffen** statt schaffen:
Talente kaemen automatisch mit Leveln, Muenzen waeren nur noch fuer Kosmetik
da. Zwei getrennte Stroeme, zwischen denen es nichts abzuwaegen gibt.

Dieser Zusammenhang war zum Zeitpunkt der urspruenglichen Idee noch nicht
sichtbar — der Shop existierte damals nicht.

**2. Die Punktezahl geht nicht auf.** Bei einem Punkt je zwei Level gaebe es
bis Stufe 100 fuenfzig Punkte fuer 32 Raenge. Ab etwa Stufe 64 waere alles
ausgebaut und jeder weitere Punkt wertlos. Der Coin-Weg hat fuer genau diesen
Fall bereits eine Antwort (ADR-Kontext: entschieden am 2026-08-13):
ueberschuessige Talentpunkte werden zu Muenzen umgerechnet
(`COINS_PER_EXTRA_TALENT_POINT = 10`).

### Verworfene Alternative

**Baum auf 99 Raenge ausbauen, damit die Punkte aufgehen.** Das haette die
Zahlen in Einklang gebracht, aber den Umfang verdreifacht — sieben Talente mit
je 14 Raengen statt vier bis fuenf. Bei `TALENT_COSTS`, das nach dem fuenften
Rang nicht weiter steigt, waeren die zusaetzlichen Raenge ausserdem beliebig
billig. Der eigentliche Zweck (eine Wahl erzwingen) waere damit erneut
verfehlt.

### Was gegen die Entscheidung spricht

**Levelaufstiege fuehlen sich duenn an.** Ein Aufstieg gibt `COINS_PER_LEVEL`
= 20 Muenzen; bei rund 475 am Tag sind das gut vier Prozent. Fuer ein Kind
waere "du hast einen Talentpunkt bekommen" greifbarer als ein Kontostand, der
sich kaum bewegt.

**Das Argument ist gueltig und wird nicht weggewischt** — es braucht aber
keinen Systemumbau. Es steht als eigener Punkt in `TODO.md` (P1-05,
"Levelaufstiege spuerbar machen") mit zwei moeglichen Wegen: den Muenzbetrag
anheben, oder den Aufstieg als sichtbaren Moment inszenieren.

### Konsequenzen

- **Am Code aendert sich nichts.** `config/talents.ts`, `TALENT_COSTS` und
  `ProgressionSystem.purchaseTalent()` bleiben, wie sie sind. Keine Migration,
  kein Eingriff in bestehende Spielstaende.
- Vier Planungspunkte entfallen ersatzlos (Umbau, Punktezahl, Baumausbau,
  Migration). P1 ist damit nicht mehr blockiert.
- **Offen bleibt die Darstellung — und das ist eine eigene Frage.** Die
  Ansicht ist fachlich eine Talentliste: sieben Talente ohne Verbindungen oder
  Voraussetzungen, obwohl sie "Talentbaum" heisst. **Dieser ADR entscheidet
  darueber ausdruecklich nicht.** Womit bezahlt wird und wie der Fortschritt
  aussieht, sind unabhaengige Fragen; der urspruengliche Wunsch aus der
  Planung lautete woertlich "darunter eine kindgerechte Schleife/Route als
  sichtbaren Fortschritt zeichnen" und haengt an keiner Kostenentscheidung.
  Drei Wege standen damals in der historischen `TODO.md`-Notiz P1.a zur Wahl:
  echter Baum mit
  Voraussetzungen, gezeichnete Route als reine Darstellung, oder ehrliches
  Umbenennen.
- **Die Kopplung Shop/Talente wird damit zur tragenden Saeule der
  Wirtschaft.** Beide Seiten gehoeren ab jetzt gemeinsam betrachtet.
  **Nachtrag (2026-08-21, nach der Balance-Kette):** Der urspruengliche Satz
  hier lautete, eine Aenderung der Coin-Einnahmen verschiebe zwangslaeufig das
  Tempo im Talentfortschritt. Das gilt seit `config/balance.ts` nicht mehr
  uneingeschraenkt — Talent-, Reset- und Shop-Kosten werden ueber
  `balancedCoinCost()` mit der Einnahmenrate mitskaliert, sodass die Dauer in
  Runs erhalten bleibt (nachgemessen: `economy.globalMultiplier` verdoppelt,
  `runsToMaxTalents` bleibt bei 299,9). **Was bestehen bleibt:** Wer einzelne
  Shop-Preise oder einzelne Talentkosten von Hand verschiebt statt ueber die
  Kette, umgeht diese Kopplung — dann gilt der Satz wieder.

**Nachtrag 2026-08-22:** Die offene Darstellungsfrage ist für den aktuellen
Produktstand entschieden: `TalentScene` bleibt eine ehrliche, unabhängige
Liste unter „Talente“. Es gibt keine gezeichnete Route und keinen Baum mit
Voraussetzungen. Gekaufte Ränge dürfen visuell hervorgehoben werden, ändern
aber weder Kaufregeln noch Freischaltungen. Die operative Aufgabe P2-01 ist
damit abgeschlossen; weitere Politur ist kein Systemumbau.
