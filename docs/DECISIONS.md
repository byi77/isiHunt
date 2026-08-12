# Architekturentscheidungen (ADR)

Jede Entscheidung, die spaeter jemand hinterfragen wird, steht hier mit
Begruendung und den verworfenen Alternativen.

**Format:** Kontext → Entscheidung → Begruendung → Konsequenzen.
**Regel:** Entscheidungen werden nie geloescht. Ueberholte bekommen den Status
*Ersetzt durch ADR-XXXX*.

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
  eine native App (M6), ohne Neuschreiben.

### Verworfene Alternativen

| Alternative | Warum nicht |
|---|---|
| **Godot (GDScript)** | Staerker bei komplexen Spielen, aber schwerer Editor, langsamerer Weg zum ersten Test auf dem Geraet, und die Projektdaten sind weniger gut in Textform pflegbar. Fuer diese Spielmechanik ueberdimensioniert. |
| **Flutter + Flame** | Gute native Leistung, aber kleineres Spiele-Oekosystem und der Web-Export ist schwerer als eine reine Web-App. |
| **Unity** | Fuer ein 2D-Arcade-Spiel dieser Groesse deutlich zu viel Werkzeug, lange Build-Zeiten, Lizenzfragen. |
| **Reines Canvas ohne Engine** | Klingt schlank, endet aber darin, Tweens, Szenenverwaltung und Eingabe selbst zu bauen. |

### Konsequenzen

- Wir sind an die Leistung des mobilen Browsers gebunden. Fuer diese Mechanik
  unkritisch, aber Grafikaufwand muss bewusst bleiben.
- Kein Zugriff auf native Funktionen bis Capacitor (M6).

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
