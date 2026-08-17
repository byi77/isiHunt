# Changelog

Alle nennenswerten Aenderungen an isiHunt.

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

---

## [Unreleased]

### Geaendert

- Talent-Reset kostet jetzt 100 statt 200 Coins — ein frueher Fehlkauf war
  fast so teuer wie der naechste Rang selbst und bremste Experimentieren.
- Talent _Gunst_ (Punkte) gibt jetzt +5 % pro Rang statt +4 % — damit ist es
  bei identischen Kosten gleich stark wie _Erkenntnis_ (XP).
- Admin-Wartungsboost (`admin_boost_user`) setzt jetzt 50000 statt 5000
  Coins. **Die SQL-Funktion in `supabase/phase_2_7_admin_tools.sql` muss
  dafuer manuell im Supabase SQL-Editor neu ausgefuehrt werden**, der
  Client-Fix allein reicht nicht.
- `MenuScene.checkCloudSave()`/`synchronizeData()` protokollieren jetzt
  Diagnosedaten (`console.warn`) zu jedem Entscheidungspunkt des
  automatischen Profil-Abgleichs. Anlass: ein Boost auf ein anderes Geraet
  kam dort nicht automatisch an, obwohl der manuelle "PROFIL ABGLEICHEN"-
  Button in den Einstellungen sofort funktionierte — die Ursache dafuer ist
  noch nicht gefunden, die Logs sollen den naechsten Fall beweisbar machen.
- Alle sichtbaren "5000 Coins"-Texte im Wartungsbereich (`AdminUsersScene`)
  auf 50000 nachgezogen; zwei Stellen hatte der vorige Boost-Fix noch nicht
  erfasst.
- **Login-Alias und Anzeigename sind jetzt derselbe Wert** (ADR-0017). Bisher
  liefen beide unabhaengig auseinander — Admin-Login-Alias `byi77`,
  Anzeigename `Yavuz` zum Beispiel — und das Wartungsdashboard zeigt den
  Anzeigenamen, waehrend Boost/Reset nur nach Alias suchen. Ein gemeldeter
  Spielername war darueber nicht zuverlaessig wiederzufinden. Es gelten
  jetzt ueberall dieselben, strengeren Alias-Regeln (3-16 Zeichen, `a-z`,
  `0-9`, `-`, `_`, klein geschrieben); `sanitizePlayerName` folgt derselben
  Regel. **`supabase/phase_2_8_unify_identity.sql` muss nach
  `phase_2_7_admin_tools.sql` einmalig manuell im Supabase SQL-Editor
  ausgefuehrt werden** — sie migriert Bestandsprofile (Anzeigename gewinnt,
  wird normalisiert und zum neuen Alias) und ersetzt `update_profile_name`/
  `update_profile_alias` durch `update_profile_identity`.

### Behoben

- `phase_2_8_unify_identity.sql` aktualisierte `profiles.alias`, aber nicht
  die zugehoerige `auth.users.email` — der Login prueft aber genau diese
  E-Mail. Betroffene Konten (u. a. das Admin-Konto) waren nach der Migration
  ausgesperrt: Login mit dem neuen Namen schlug fehl, weil Supabase Auth
  noch den alten Alias in der internen E-Mail erwartete. Ebenso zog
  `update_profile_identity` diese E-Mail bisher nicht nach — jede kuenftige
  Namensaenderung haette denselben Aussperr-Effekt gehabt.
  `supabase/phase_2_9_fix_auth_email_sync.sql` repariert beides: sie
  gleicht `auth.users.email` einmalig an den aktuellen `alias` an und
  ersetzt `update_profile_identity` durch eine Fassung, die die Login-Adresse
  bei jeder Namensaenderung synchron mitzieht. **Muss nach
  `phase_2_8_unify_identity.sql` einmalig manuell im Supabase SQL-Editor
  ausgefuehrt werden.**
- Der automatische Profil-Abgleich beim Menuebesuch (auch beim App-Start)
  erkannte einen weiter fortgeschrittenen Cloud-Stand nur an Level, Bestwert,
  Runs, Gesamtpunkten und Coins. Ein Talentkauf, ein neuer Erfolg oder XP-
  Zuwachs auf einem anderen Geraet aendern davon oft keinen einzigen Wert —
  der Abgleich hielt den lokalen Stand dann faelschlich fuer aktuell, und nur
  das manuelle "PROFIL ABGLEICHEN" in den Einstellungen zog den echten Stand.
  `isRemoteAhead`/`isLocalAhead` vergleichen jetzt zusaetzlich Talentraenge,
  Anzahl freigeschalteter Erfolge und Gesamt-XP.
- Ton blieb nach App-Kaltstart auf iOS oft dauerhaft stumm, obwohl "TON: AN"
  gesetzt war: Der allererste `AudioContext.resume()`-Aufruf blieb dort
  manchmal fuer immer in der Warteschleife (kein resolve, kein reject). Die
  Diagnoseanzeige im Wartungsbildschirm hat das auf dem Testgeraet
  reproduzierbar gezeigt: "resume() laeuft: ja" auf unbestimmte Zeit. Da
  jeder weitere Tipp im Spiel nur dieselbe haengende Anfrage zurueckbekam,
  half nichts mehr — `resumeAudioContext()` gibt eine haengende Anfrage
  jetzt nach 1,2 Sekunden frei, sodass der naechste Tipp einen frischen
  Versuch bekommt.
- Nach dem Aufwachen aus obigem Zustand kamen mehrere Toene gleichzeitig als
  Haufen statt einzeln: Waehrend `resume()` noch lief, sammelte eine
  Warteschlange jeden angefragten Ton und feuerte beim spaeten `running` alle
  auf einmal ab, ohne den urspruenglich gemeinten zeitlichen Bezug
  zueinander. Die Warteschlange ist entfallen — Toene, die anfallen bevor
  der Kontext laeuft, werden jetzt verworfen statt nachgeholt. Lieber die
  ersten ein bis zwei Sekunden nach Kaltstart still als spaeter ein
  akustisches Durcheinander.
- Ton blieb nach App-Wechsel oder Sperrbildschirm meist stumm: Ein frueherer
  Commit hatte unbeabsichtigt die `click`/`touchend`-Entsperr-Gesten entfernt
  und den `visibilitychange`-Handler so umgebaut, dass er den AudioContext
  beim Verlassen zwar pausierte, bei Rueckkehr aber nicht mehr aktiv
  reaktivierte. Auf iOS Safari zaehlt nicht jede Geste als gueltige
  Nutzeraktivierung fuer `resume()` — `pointerdown` allein reichte oft nicht.
- Der Zeitverlust-Text bei einem Hindernistreffer zeigte einen falschen Wert
  an; er wird jetzt aus dem tatsaechlichen Balancing-Wert berechnet.
- Ein fehlgeschlagenes Schreiben nach einer Spielstand-Migration (z.B. volles
  Speicherkontingent) konnte den migrierten Fortschritt stillschweigend
  durch einen leeren Stand ersetzen.

### Intern

- Wartungsbildschirm zeigt jetzt eine Ton-Diagnose (AudioContext-Status,
  Samplerate, laufender resume()-Versuch) live plus Testton-Knopf. Ohne
  Mac/Safari-Devtools war der AudioContext-Zustand auf dem iPhone bisher
  nicht einsehbar; die Anzeige hat sowohl den haengenden resume() als auch
  den Tonhaufen danach reproduzierbar sichtbar gemacht statt Ratearbeit.
- Balancing-Werte in `SpawnSystem`, `ChallengeSystem`, `ProgressionSystem`
  und `InputController` stehen jetzt vollstaendig in `src/config/`.
- Testabdeckung fuer `CloudSystem`, den Bot- und Tagesmodus in
  `ChallengeSystem`, `ProgressSyncSystem`, den Talent-Maximalrang-Guard,
  `SpawnSystem.reset()`/den Solo-Kapazitaetsguard sowie das Talent-x-Welt-
  Multiplikatorprodukt in `ScoreSystem` nachgezogen.

### Erststart und Profil

- Beim ersten Online-Start wird ein gemeinsames Profil mit Alias und
  sechsstelliger PIN angelegt; offline entsteht zunächst ein lokales Profil.
- Neue Profile verwenden einen PIN statt eines Passworts. Bestehende Konten
  bleiben vorübergehend mit ihrem bisherigen Zugang kompatibel.

### Hinzugefuegt

**Phase 5: Herausforderung**

- Tages-Herausforderung mit UTC-Tagesseed je Welt.
- Bot-Duell mit deterministischer Bewertung und drei internen
  Schwierigkeitsstufen.
- Weltmodifikatoren für Trägheit, kurze Lebensdauer, Sichtbarkeitsblinken und
  seltene Planeten.
- Sichtbare Hindernisse: Bremsfelder in mittleren Welten und Zeitverlust in
  den späten Welten; die Einstiegswelt bleibt frei davon.
- Erste Balancing-Runde: Hindernischance, Trägheit, Lebensdauer und Strafen
  abgeschwächt; die Grundbelohnung pro Solo-Runde steigt auf 30 Coins.
- Lokale Altspielstände schreiben ihre Talentpunkte- und Levelcoin-Migration
  sofort fest, damit sie nach einem Neustart nicht doppelt gutgeschrieben wird.

**Phase 4: Belohnung**

- Auffaelligere Punkte-Popups mit sichtbarem x2-Serienbonus ab drei gleichen
  gruenen, blauen, lila oder orangenen Relikten in Folge.
- Coins fuer jede abgeschlossene Runde, eingesammelte Relikte, neue Erfolge und
  Levelaufstiege.
- Talentbaum im Profil mit steigenden Coin-Kosten je Rang und kostenpflichtigem
  Reset.
- Atomare Talent-RPCs fuer angemeldete Mehrgeraete-Profile.
- Die Talentkosten sind auf 400 Coins für Rang 1 und jeweils 100 Coins mehr
  pro weiterem Rang angepasst; Zielwert ist etwa ein Rang je fünf Runden.
- Ranglisten-Einträge speichern und zeigen jetzt zusätzlich das Spielerlevel.

### Geaendert

- Der manuelle Geräte-Transfer wurde aus den Einstellungen entfernt. Angemeldete
  Profile synchronisieren sich automatisch; der alte Sync-Code bleibt nur als
  interner Migrationsweg für anonyme Alt-Spielstände erhalten.

**Phase 2.6: Login und Mehrgeräte-Profil**

- Freiwilliger Supabase-Login in den Einstellungen mit Alias/Passwort; eine
  E-Mail-Adresse wird vom Spieler weder benötigt noch angezeigt.
- Der Alias wird intern auf eine pseudonyme Auth-ID abgebildet. Für den
  alias-only Login muss die E-Mail-Bestätigung in Supabase deaktiviert sein;
  eine Wiederherstellung per E-Mail gibt es bewusst noch nicht.
- Gemeinsamer Profilstand für iPhone und iPad; das lokale Spiel bleibt ohne
  Login und offline nutzbar.
- Offline-Outbox für angemeldete Solo-Runs mit eindeutiger Ereignis-ID sowie
  serverseitige idempotente Zusammenführung von XP, Coins, Erfolgen und
  Bestwerten.
- SQL-Migration unter `supabase/phase_2_6_auth.sql`; sie muss nach
  `schema.sql` im Supabase SQL Editor ausgeführt werden.

**Tests**

- Vitest eingerichtet (`npm run test`, `npm run test:watch`). 62 Tests decken
  `ScoreSystem`, `ProgressionSystem` und `ChallengeSystem` ab: Combo-Zerfall
  und Multiplikatorstufen, XP-Kurve und Maximalstufe, Weltenfreischaltung,
  Erfolge sowie Sieger- und Gleichstandsermittlung im Duell.
- Die Tests haengen in `npm run verify` und laufen dadurch bei jedem Push
  (`pre-push`), in der CI und vor jedem Deploy.

**Phase 3: Weltraum-Thema**

- ADR-0013 legt den Wechsel von Fantasy zu Weltraum fest; Welt-IDs bleiben
  fuer bestehende Spielstaende unveraendert.
- Die Spielfigur ist jetzt ein Licht-Raumschiff und einsammelbare Relikte
  werden als tintbare Planeten mit Orbit dargestellt.
- Die Raumzonen heissen jetzt Sternenweide, Eisring, Glutnebel, Nullsektor und
  Sonnenkrone.
- Jede Raumzone hat eine eigene feste Stern-/Nebelkomposition mit passenden
  Hintergrundplaneten und Sternfarben.
- Das Raumschiff wechselt bei Level 5, 15, 30, 50, 75 und 100 auf jeweils
  sichtbar ausgebaute Skins; im Duell bleibt die Darstellung fairerweise
  neutral.
- Echte Planetentexturen je Raumzone und ein neues isiHunt-Logo wurden als
  vorab geladene PNG-Assets eingebaut.
- Die einsammelbaren Relikte zeigen jetzt diese echten Planetensprites passend
  zur Welt; die Seltenheitsfarben bleiben ueber Glow und Strahlenkranz lesbar.
- Das Logo nutzt ausschliesslich Gelb, Weiss, Cyan, Blau und Gruen — ohne Rot,
  Orange oder andere rotnahe Akzentfarben.

**Wartung und Safe Area**

- Zurueck-Navigation liegt jetzt auf allen Unterseiten unten links; die
  Versionsangabe sitzt unten rechts am Bildschirmrand.
- Der Update-Hinweis im Hauptmenue ist jetzt als grosser, klarer Ladebutton
  gestaltet; die unauffaellige Ueberschrift der Weltenauswahl wurde entfernt.
- Im Profil stehen Level, Bestwert und Coins jetzt mittig; die Beschriftung des
  Namensfeldes hat wieder ausreichend Abstand zum Eingabefeld.
- Der Wartungsmodus zeigt im Layout-Block jetzt auch erkannte Geraete-,
  Display-, Browser-, CPU-, Netzwerk- und Webspeicher-Daten.
- Eine Namensaenderung im Profil wird jetzt auch auf den bestehenden eigenen
  Ranglisteneintrag uebertragen.
- Die Laufzeile liegt unterhalb des iOS-Systemblurs und wird ohne unscharfen
  Textschatten gezeichnet. Der notwendige Schutzbereich darueber ist
  transparent und zeigt den Welt-Hintergrund statt eines blauen Leerfelds.
  Der Canvas reicht zugleich bis in die untere Home-Indicator-Safe-Area,
  sodass dort kein eigener Balken entsteht.
- Phase 3.5: prozedurale WebAudio-Toene fuer Klicks, Faenge, Combo-Stufen,
  Run-Start, Run-Ende und Levelaufstieg; der Ton ist in den Einstellungen
  abschaltbar und bleibt gespeichert.
- Farbige Planeten (gruen, blau, lila, orange) haben jetzt mehrstimmige,
  deutlich epischere Fangklaenge; das Scrollen durch die Welten spielt einen
  eigenen Auswahlton.
- Der Bereich oberhalb von Spielpixel 0 wird jetzt auf Geraeten mit Safe Area
  genutzt: Im Menue laeuft dort eine dezente Infozeile, waehrend des Runs steht
  dort die verbleibende Zeit in Sekunden.
- Falls iOS keinen oberen Safe-Area-Wert meldet, bleibt die Anzeige dank eines
  28-Pixel-Fallbacks trotzdem sichtbar; der Canvas wird entsprechend nach unten
  verschoben.
- Die Audio-Freischaltung ist robuster gegen iOS-PWA-Unterbrechungen; nach
  App-Wechsel oder Sperrbildschirm kann der Sound beim nächsten Tipp wieder
  aufgenommen werden.
- Der Wartungsmodus wird durch drei kurze Tipps auf die Versionsangabe und
  anschliessend langes Gedrueckthalten geoeffnet.

- Der Spielverlauf fuellt jetzt auch den gepaddeten Spielcontainer; dadurch
  bleibt die untere Safe Area auf iOS farbig statt weiss.
- Der lokale Spielstand-Reset bleibt im Admin-Menue sichtbar, ist waehrend der
  laufenden Testphase aber voruebergehend deaktiviert.
- Der Spielstart wartet in iOS-Home-Screen-Apps auf die endgueltige
  Viewport-Hoehe, bevor Phaser die interne Spielflaeche berechnet. Dadurch
  entsteht nach dem PWA-Start kein FIT-Balken mehr durch eine zu kleine
  Anfangshoehe.
- Der Bestwert steht jetzt im Profilblock des Hauptmenues und direkt neben dem
  Level im Profilbildschirm; die doppelte Anzeige unten im Menue entfaellt.
- Der technische Steuerungshinweis am unteren Bildschirmrand wurde aus dem
  Hauptmenue entfernt.
- Fuer installierte iOS-Web-Apps wird die WebKit-Viewport-Umgehung mit
  `100vh` aktiviert, damit die System-Safe-Area nicht als weisser Bereich
  ausserhalb der Web-Seite erscheint.

**Geraetehoehe und Hochformat**

- Die interne Portraithoehe waechst auf hohen, schmalen Handys mit der
  verfuegbaren sicheren Flaeche; die zusaetzliche Hoehe wird als Spielfeld
  genutzt und hinterlaesst keine FIT-Streifen im Canvas.
- Hochformat wird ueber das PWA-Manifest und die Screen-Orientation-API
  angefordert. Browser ohne diese API zeigen im Querformat einen klaren
  Hochkant-Hinweis statt eines seitlich unbedienbaren Spiels.

**Online: Bestenliste und Spielstand-Abgleich** (Supabase)

- Der Menüpunkt `BESTENLISTE` heißt jetzt `RANGLISTE`; er hat die Größe des
  Hauptbuttons und steht unter `DUELL ZU ZWEIT`. `EINSTELLUNGEN` steht allein
  mittig am unteren Menübereich.
- Coins werden im Spielstand gespeichert; bei voll ausgebautem Talentbaum
  werden ueberschuessige Talentpunkte automatisch in Coins umgewandelt.
- Der Ergebnisbildschirm erklaert diese Umwandlung sichtbar.
- Spielstaende werden nach Solo-Runs automatisch gesichert; Offline-Runs
  bleiben lokal und werden beim naechsten erreichbaren Abgleich nachgeladen.
- Der Menuepunkt `SPIELSTAND` heisst jetzt `EINSTELLUNGEN`; die
  Profiluebertragung auf ein anderes Geraet liegt dort als kindgerechte Option.
- Ein weiterentwickelter Cloud-Stand wird beim Start angezeigt und nur nach
  ausdruecklicher Entscheidung uebernommen.
- gemeinsame Bestenliste ueber alle Welten, Top 10, eigener Eintrag
  hervorgehoben; Weltentabs bleiben als Filter erhalten
- Weltfarbe als Marker pro Zeile, damit die Herkunft in der Gesamtliste
  sichtbar bleibt
- Jeder Solo-Run wird automatisch eingetragen, wenn ein Name gesetzt ist;
  ohne Namen, ohne Backend oder bei einem Fehler bleibt der Ergebnisbildschirm
  unveraendert
- Spielstand zwischen Geraeten per sechsstelligem Code, **ohne Konto,
  Passwort oder E-Mail**; der Code gilt 15 Minuten
- Sind zwei Spielstaende vorhanden, werden beide mit Level, Bestwert und
  Anzahl Runs gegenuebergestellt — uebernommen wird erst auf Ansage
- Profil mit Namensabfrage beim ersten Start, Lichtfigur und spaeterer Aenderung
  des Namens
- Namensfeld aus der Bestenliste entfernt; der Name wird im Profil gepflegt
- Level im Profil und im Hauptmenue prominent sichtbar
- Weltenauswahl als vertikaler Carousel: eine Welt im Fokus, Nachbarn kleiner
  und geblurt, Auswahl per Hoch-/Runter-Wischen
- Bestenliste pro Cloud-Profil auf genau einen Eintrag begrenzt; nur der beste
  Lauf bleibt, umgesetzt ueber einen atomaren Supabase-RPC
- Solo-Runs auf 90 Sekunden verlaengert, XP-Kurve auf `floor(750 · √n)`
  umgestellt und bei Level 100 gedeckelt; alte lokale Spielstaende werden
  automatisch auf die neue Kurve migriert
- Ohne Zugangsdaten laeuft das Spiel unveraendert weiter; der automatische
  Eintrag wird dann einfach uebersprungen
- Datenbankschema samt Rechten und Zugriffsregeln in `supabase/schema.sql`

> **Bekannte Grenze:** Punktestaende sind manipulierbar. Das Spiel laeuft im
> Browser, und ohne serverseitige Nachrechnung eines Runs laesst sich das
> nicht verhindern. Der Server schuetzt aber den Bestwert je Profil vor
> schlechteren Nachtraegen. Siehe ADR-0011.

**Duell-Modus fuer zwei Spieler**

- Zwei Personen spielen abwechselnd an einem Geraet, je 90 Sekunden
- Beide bekommen **dieselbe Relikt-Abfolge** — gleicher Seed, gleiche
  Seltenheiten, gleiche Positionen, gleiche Zeitpunkte
- Faire Bedingungen: keine Talente, und der Spielstand bleibt unberuehrt
- Einfuehrung, Uebergabe-Bildschirm und Ergebnis mit Sieger und Punktabstand
- Vorlage des Gegners im HUD; wird sie ueberholt, wird das gefeiert
- "Revanche" startet ein neues Duell mit frischem Seed

**Vollbild und Installation**

- PWA-Manifest — das Spiel laesst sich auf den Home-Bildschirm legen und
  laeuft dann ohne Adressleiste
- App-Icons, erzeugt von `scripts/generate-icons.mjs` (`npm run icons`)
- Vollbild-Knopf im Menue, wo die Fullscreen-API verfuegbar ist
- Auf dem iPhone stattdessen ein Hinweis auf "Zum Home-Bildschirm" — Safari
  kennt dort keine Fullscreen-API

**Wartungsbildschirm und Update-Erkennung**

- **`version.json`** entsteht beim Build und liegt neben der `index.html`. Sie
  sagt, welcher Stand **verfuegbar** ist — die eingebaute Nummer sagt nur,
  welcher **geladen** wurde. Erst der Vergleich deckt einen haengenden Cache auf
- **Hinweis im Menue**, wenn eine neuere Fassung bereitliegt: ein Tipp laedt
  sie. Nur als Angebot, nie selbsttaetig — ein Neustart mitten im Run waere das
  Gegenteil von hilfreich
- **Wartungsbildschirm** (`AdminScene`) mit Version, Startweg (Browser oder
  Home-Bildschirm), "Neu laden erzwingen" und Spielstand zuruecksetzen.
  Erreichbar ueber **langen Druck auf die Versionsnummer** — auffindbar fuer
  den, der davon weiss, unauffaellig fuer alle anderen. Ein sichtbarer
  Reset-Knopf waere fuer ein Kind eine Falle
- Das Zuruecksetzen braucht **zwei Tipps**; der erste bewaffnet nur
- `forceReload()` haengt einen neuen Suchteil an die Adresse. Ein blosses
  `location.reload()` genuegt auf iOS nicht — der Standalone-Modus beantwortet
  die Anfrage weiterhin aus seinem eigenen Speicher

**Pixel-Lineal** _(im Wartungsbildschirm)_

- Legt ein beschriftetes Raster über den gesamten Bildschirm: `0` liegt am
  tatsächlichen oberen Viewport-Rand hinter Uhr/Dynamic Island, die letzte
  Linie an der unteren Displaykante. Gemessen wird in CSS-Pixeln, unabhängig
  von Position und Skalierung des Spielfelds
- Zeichnet zusaetzlich die **sicheren Raender** ein und nennt die Balkenhoehen
- Damit wird aus "oben ist ein Balken" die Aussage "von 0 bis 160 ist
  schwarz" — eine Zahl, die sich nachrechnen laesst, statt einer Beschreibung,
  die eine Rueckfrage kostet

### Behoben — dritte Runde (iPhone 16 Pro)

- **Die Streifen ausserhalb des Spielfelds sind nicht mehr schwarz.** Das
  Spielfeld ist 9:16, moderne Handys sind schmaler — oben und unten bleiben
  rund 160 CSS-px frei. Dort stand ein harter schwarzer Balken neben einem
  farbigen Verlauf. Die Streifen tragen jetzt die Randfarben der aktuellen
  Welt (`--world-top` / `--world-bottom`, gesetzt von `createWorldBackdrop`),
  sodass die Naht verschwindet

- **Der Zurueck-Knopf verschwand hinter der Dynamic Island.** `viewport-fit=cover`
  laesst die Seite bis unter die Island reichen — richtig fuer den Hintergrund,
  falsch fuer das Spielfeld. `#game` bekommt jetzt ein Padding in Hoehe der
  sicheren Raender; der Hintergrund bleibt randlos, das Spielfeld rutscht
  hinein. Das verschiebt **das ganze Spiel**, nicht nur einen Knopf
- **Der Wartungsbildschirm zeigt die Layout-Werte des Geraets**: Fenstergroesse,
  sichere Raender, Balken oben und unten, Massstab. Ein Browser-Simulator kann
  iPhone-Groessen nachstellen, aber keine sicheren Raender — diese Klasse
  Fehler ist nur auf dem Geraet zu finden
- **Das Code-Feld lag weiterhin auf dem Knopf.** Der Abstand ist von 74 auf
  172 Spielpixel erhoeht. Zwei Anlaeufe mit "rechnerisch reicht das" sind
  gescheitert; im Dev-Build meldet der Bildschirm jetzt die **tatsaechliche**
  Position des Feldes, statt sie zu berechnen

### Behoben — zweite Runde

- **Die Versionsnummer stand zweimal unten rechts.** Sie war in derselben
  Sitzung doppelt eingebaut worden: im DOM (`main.ts`) und zusaetzlich im Canvas
  (`MenuScene`). Die Canvas-Variante ist entfernt; das DOM gewinnt, weil es die
  Nummer auch dann zeigt, wenn Phaser gar nicht erst startet
- **Das Code-Feld sass auf dem Knopf "CODE EINLOESEN".** Nachgemessen: 24
  Spielpixel Abstand, auf dem iPhone rund 13 CSS-px. Zu wenig fuer ein
  HTML-Eingabefeld, das ueber dem Canvas liegt und bei offener Systemtastatur
  zusaetzlich verschoben wird. Jetzt 74 px — rund eine Fingerbreite

**Versionierung und Auslieferung**

> Anlass: Vier Runden Fehlersuche an den Trefferflaechen liefen gegen einen
> Stand, den das Testgeraet nie geladen hatte — dort lief durchgehend v0.1.0.
> Jede Rueckmeldung beschrieb korrekt den **alten** Code.

- Jeder Commit zieht die Patch-Version hoch (`.githooks/pre-commit` →
  `scripts/bump-version.mjs`), einmalig zu aktivieren mit
  `git config core.hooksPath .githooks`
- **`.githooks/pre-push` blockiert Pushes ohne Versionssprung** und faehrt
  ausserdem `npm run verify` — der vorige Push ging mit roter CI raus, weil
  `format:check` in der lokalen Kette fehlte
- **Der Deploy prueft sich selbst.** Vorher liefen CI und Deploy unabhaengig auf
  denselben Push; eine rote CI hielt den Deploy nicht auf. Jetzt faehrt der
  Deploy `verify` und bricht ab, statt einen roten Stand auszuliefern
- **Die CI prueft den Versionssprung** gegen `HEAD~1` — unabhaengig davon, ob
  die lokalen Hooks eingerichtet sind oder mit `--no-verify` uebergangen wurden
- **`npm run deploy:check` / `deploy:wait`** (`scripts/check-deploy.mjs`) fragt
  den Server: laedt die `index.html`, folgt ihr zum gehashten Bundle und liest
  die ausgelieferte Version — denselben Weg geht auch der Browser. Damit meldet
  sich die Kette von selbst, statt auf Aufmerksamkeit angewiesen zu sein
- Der Deploy-Workflow schreibt die ausgelieferte Version in die
  Lauf-Zusammenfassung
- **`index.html` ist `no-cache`.** JS und CSS tragen einen Inhalts-Hash und
  duerfen gecacht werden; die `index.html` ist die einzige Stelle, die auf die
  neuen Hashes zeigt — aus dem Cache blockiert sie jeden Deploy
- **Die Nummer steht im DOM** (unten rechts), nicht nur im Canvas: sichtbar
  auch dann, wenn Phaser gar nicht erst startet
- `npm run verify` faehrt dieselbe Kette wie die CI, inklusive `format:check` —
  dessen Fehlen in der lokalen Pruefung hatte die CI rot gemacht
- `scripts/bump-version.mjs` ersetzt gezielt nur die Versionszeile, statt die
  `package.json` neu zu serialisieren — sonst wuerde jeder Commit die
  Formatierung umschreiben

**Diagnosewerkzeug fuer Trefferflaechen**

- `src/ui/hitDebug.ts`, eingeschaltet mit `?hitboxes` in der Adresse (nur im
  Dev-Build). Zeichnet jede Trefferflaeche, markiert jeden Tipp und zeigt die
  Umrechnungswerte als Text ueber dem Canvas — lesbar auch auf einem iPhone
  ohne angeschlossenen Mac
- Meldet ausdruecklich `<<< WIDERSPRUCH`, wenn Phaser ein anderes Objekt
  meldet, als die Geometrie hergibt

**Pause und Abbruch im Run**

- Pause-Knopf unten rechts im HUD — bisher gab es das nur als Debug-Taste `P`,
  die im fertigen Build nicht existiert
- Pause-Bildschirm mit "Weiter" und "Run verlassen"
- Ein abgebrochener Run wird **nicht gewertet**: kein XP, kein Bestwert, kein
  Erfolg. Sonst gaebe es einen Grund, jeden mittelmaessigen Run wegzuwerfen
- **Im Duell haelt die Simulation nicht an.** Wer pausieren koennte, waehrend
  ein legendaeres Relikt erscheint, duerfte in Ruhe zielen — das bricht die
  Fairness gegenueber dem ersten Spieler. Aussteigen bleibt moeglich, beendet
  dann aber das ganze Duell

**Grafik**

- Relikte sind geschliffene Steine mit acht Facetten statt glatter Kugeln
- Strahlenkranz hinter seltenen Relikten, gegenlaeufig rotierend
- Schockwelle beim Einsammeln; Fang-Partikel sind jetzt Splitter statt Punkte
- Lichtspur hinter der Figur, sobald sie sich bewegt
- Hintergrund in fuenf Ebenen: Verlauf, Horizontschein, Farbwolken, zwei
  Parallax-Ebenen — dazu eine Vignette
- Leuchtende Fortschrittsbalken, Schein hinter Knoepfen, abgesetzte Panels
- Farbmarke je Welt in der Weltenliste

### Behoben

**Nach dem ersten Spieltest mit Kindern (9 und 11)**

> ### ⚠ Der Knopf-Fehler gilt NICHT als behoben
>
> Vier Anlaeufe, vier gefundene und beseitigte Ursachen — das gemeldete Symptom
> ("rechts neben BESTENLISTE reagiert SPIELSTAND") trat danach weiterhin auf.
>
> **Gemessen und belegt** (Edge headless, echtes Spiel, echte Phaser-API):
> Trefferflaeche `74..318` deckungsgleich mit dem sichtbaren Knopf; Umrechnung
> CSS → Spiel mit Fehler 0,0 auf beiden Seiten; ein Tipp am rechten Knopfrand
> trifft den richtigen Knopf.
>
> **Ungeprueft:** dasselbe auf einem echten iPhone. Bis dahin bleibt der Punkt
> in `TODO.md` offen. Die naechste Runde beginnt mit einer Messung
> (`?hitboxes`), nicht mit einer weiteren Vermutung.

- **Trefferflaeche wanderte mit dem Druck-Effekt.** Der Container wurde beim
  Druecken auf 96 % gestaucht, und Phaser rechnet die Trefferflaeche in der
  Skalierung des Objekts, an dem sie haengt — sie schrumpfte also mit, waehrend
  der Finger schon auflag. Ein Tipp nahe am Rand loeste `pointerdown` aus, fiel
  aus der geschrumpften Flaeche und bekam nie ein `pointerup`. Gestaucht wird
  jetzt nur noch eine innere Gruppe, nie das interaktive Objekt.

- **Trefferflaeche lag um den Objekt-Ursprung verschoben.** Phaser addiert vor
  dem Test `displayOriginX` auf den Punkt — beim Container `width * 0.5`, aber
  nur wenn `setSize()` gelaufen ist, sonst 0. Dieselbe Rechteck-Definition war
  dadurch mal richtig und mal um eine halbe Knopfbreite daneben; daher die
  wechselnden Symptome ("rechts geht nicht" / "links geht nicht").

  Die Ausrichtung wird jetzt **gemessen statt gerechnet**
  (`makeAlignedHitArea`): Der Mittelpunkt des Knopfes muss ein Treffer sein,
  sonst wird das Rechteck verschoben. Das bleibt richtig, egal wie Phaser
  intern normalisiert.

- **Ein leicht wandernder Finger brach den Tipp ab.** Verliess der Finger
  zwischen Aufsetzen und Abheben die Flaeche um ein Pixel, passierte nichts
  mehr. Jetzt zaehlt der Tipp, solange er auf demselben Knopf endet.

- **Die Trefferflaechen sind wieder genau so gross wie die Knoepfe.** Der
  Versuch, sie ueber den Lichtschein hinaus zu vergroessern, war ein Fehlschlag:
  61 px unsichtbare Flaeche pro Knopf, und bei einer Ueberlappung gewinnt in
  Phaser das zuletzt erzeugte Objekt — nicht das naeherliegende. Genau so
  erwischte ein Tipp rechts neben BESTENLISTE den Knopf SPIELSTAND.

- **Die Weltenauswahl in der Bestenliste war kaum treffbar.** Die Marker sind
  auf 34 % skaliert und waren selbst interaktiv, also schrumpfte die
  Trefferflaeche mit: rund 12 CSS-Pixel, ein Viertel des Mindestmasses aus
  `ART_STYLE.md` 8. Jetzt 50 CSS-Pixel.

- **`viewport.ts` rechnete mit halb erneuerten Werten.** Vor jeder Beruehrung
  wurde die Canvas-Position neu gemessen, aber nur per `updateBounds()`. Das
  erneuert `canvasBounds`, **nicht** `displayScale` — und Phaser braucht beide
  zusammen (`spielX = (seitenX - bounds.left) * displayScale.x`). Jetzt laeuft
  die volle `refresh()`, aber nur wenn sich die Masse tatsaechlich geaendert
  haben.

- **Der Zurueck-Knopf der Bestenliste war nicht erreichbar.** Er lag unter dem
  Namensfeld, und dieses ist ein echtes HTML-Element ueber dem Canvas — es
  liegt immer obenauf, erst recht bei offener Systemtastatur.
- **Zurueck-Knoepfe waren nicht auffindbar**, weil sie auf jedem Bildschirm
  woanders standen. Sie sitzen jetzt einheitlich oben links.
- **Der iOS-Vollbildhinweis wurde uebersehen.** Er stand klein und grau in der
  Fusszeile; auf dem iPhone ist er aber der einzige Weg zum Vollbild
  (ADR-0009). Jetzt in einem eigenen Kasten.
- Aufraeumen nebenbei: Ein deaktivierter und wieder aktivierter Knopf verlor
  seine vergroesserte Trefferflaeche, weil `setInteractive()` ohne Argumente
  auf die Containergroesse zurueckfaellt.
- Im Ergebnisbildschirm ueberlappten sich "IN DIE BESTENLISTE" und "NOCHMAL"
  um 1 px, und die Statuszeile lag im Knopf darunter. Beim Nachmessen aller
  Knopfpaare aufgefallen — nicht durch das Spielen.
- Ein waehrend des Countdowns abgebrochener Run startete danach trotzdem: Der
  Countdown laeuft ueber `delayedCall` und laesst sich nicht zurueckrufen.

**Sonstiges**

- "1 Relikte" und "1 Runs" heissen jetzt "1 Relikt" und "1 Run"

### Geaendert

- **CI und Deploy fahren jetzt Node 24 statt Node 20.** Die Testumgebung
  `jsdom` verlangt `^22.22.2 || ^24.15.0 || >=26`; unter Node 20 brach der
  Testlauf mit `markAsUncloneable is not a function` ab. `engines` in der
  `package.json` steht entsprechend auf `>=22.22.2` statt `>=20.0.0`.
- **Der `pre-push`-Hook wechselt jetzt in Gits normalisiertes
  Wurzelverzeichnis.** Git startet Hooks unter Windows mit kleingeschriebenem
  Laufwerksbuchstaben; Vitest legte seine Module daraufhin unter `C:/...` ab,
  suchte den Runner aber ueber `c:/...` und brach mit "failed to find the
  runner" ab — ausschliesslich im Hook, waehrend dieselbe Suite in jeder Shell
  gruen lief.
- Die Testeinstellungen stehen jetzt in einer eigenen `vitest.config.ts`, die
  Alias und `define` per `mergeConfig` aus der Vite-Config erbt.
- **`ScoreSystem` importiert Phaser nicht mehr.** Der Import bestand fuer ein
  einzelnes `Math.Clamp`, zog aber die komplette Engine samt Canvas-Erkennung
  mit und machte die Datei ausserhalb eines Browsers unbenutzbar. Ersetzt durch
  eine Standardrechnung; damit gilt Regel 1.6 (Systeme kennen Phaser nicht)
  wieder ohne Ausnahme fuer diese Datei.
- Die CI fuehrt jetzt einen eigenen Test-Schritt aus. Sie ruft die Stufen
  einzeln auf statt `verify`, wodurch neue Tests dort sonst nie gelaufen waeren
  — dasselbe Muster, das zuvor schon einen Push mit rotem `format:check`
  durchgelassen hat.
- **Spawn-System ist deterministisch geworden.** Der Zufallsgenerator wird
  jetzt unabhaengig vom Spielverlauf verbraucht: ein volles Spielfeld haelt
  den Takt nicht mehr an, und die Positionssuche bricht nicht mehr frueh ab.
  Ohne beides haetten zwei Duell-Durchgaenge unterschiedliche Runden ergeben.
- Zeichenreihenfolge zentral in `src/ui/depth.ts` statt verstreuter Zahlen
- Duell-Konstanten in `src/config/challenge.ts`, mit den Fairness-Regeln als
  Begruendung

### Dokumentation

- Fuenf neue Architekturentscheidungen: Duell-Bauform (ADR-0008),
  Vollbild-Strategie (ADR-0009), Weg zum Netzwerkduell (ADR-0010),
  Backend ohne Konto samt Manipulierbarkeit (ADR-0011), Zugangsdaten im
  Repository (ADR-0012)
- Die `GRANT`-Falle bei Supabase dokumentiert: `PGRST205 "not found in schema
cache"` heisst im Zweifel "keine Rechte", nicht "Tabelle fehlt". Beim Aufbau
  hat das zwei Fehlversuche gekostet.
- Roadmap-Eintrag "Mehrspieler in Echtzeit — nicht geplant" als ueberholt
  gekennzeichnet und korrigiert
- ADR-0007 (Lizenz) um den Nachtrag ergaenzt, dass das Repository inzwischen
  oeffentlich und die MIT-Lizenz damit wirksam ist

---

## [0.1.0] — 2026-08-12

Erster spielbarer Prototyp.

### Hinzugefuegt

**Spiel**

- Runs von 60 Sekunden mit Countdown
- Sechs Seltenheitsstufen von Schlicht bis Legendaer, mit eigenen Werten fuer
  Punkte, XP, Spawnrate, Lebensdauer, Tempo und Groesse
- Combo-System mit Multiplikator bis ×5; Zerfall ueber Zeit, nicht durch
  verpasste Relikte
- Spawn-System mit Verdichtung zum Run-Ende und Mindestabstand zur Figur
- Fuenf Welten mit eigener Farbstimmung, freigeschaltet ueber das Level

**Fortschritt**

- Charakterlevel mit XP-Kurve `floor(80 · n^1.45)`
- Talentpunkte pro Levelaufstieg
- Sieben Talente — Wirkung implementiert, Vergabe-UI folgt in M2
- 15 Erfolge, geprueft nach jedem Run
- Spielstand in `localStorage`, versioniert und gegen defekte Daten abgesichert

**Einstellungen**

- Impressum mit Programmiererangabe und persoenlichem Dank an Emre und Simay

**Vollbild**

- Safe-Area-Laufschrift bleibt jetzt auch im Browser-Vollbild sichtbar

**Texte**

- Sichtbare deutsche Spieltexte verwenden jetzt echte Umlaute

**Steuerung**

- Touch: Figur laeuft zum Finger, mit Abbremsen nahe am Ziel
- Tastatur: WASD und Pfeiltasten
- Debug-Tasten im Dev-Build (`1`–`6`, `L`, `K`, `J`, `P`, `0`)

**Darstellung**

- Alle Texturen prozedural erzeugt — keine Bilddateien
- Partikel beim Einsammeln, Kamera-Ruckler ab episch
- HUD mit Punktestand, Combo, Timer-Balken und Warnfaerbung
- Menue mit Charakteruebersicht und Weltenauswahl
- Ergebnisbildschirm mit Ausbeute, XP-Balken und Freischaltungen

**Technik**

- TypeScript strict, Phaser 3, Vite
- Typisierter EventBus zwischen Spiel- und HUD-Scene
- Kollision per Distanztest statt Physik-Engine
- Frameratenunabhaengige Bewegung
- ESLint, Prettier, EditorConfig
- GitHub Actions: CI und automatisches Pages-Deployment

**Dokumentation**

- Game Design Document, Architektur, Roadmap, Art Style, Code Style
- Sieben Architekturentscheidungen mit Begruendung (ADR-0001 bis ADR-0007)
- README, Contributing-Leitfaden, PR-Vorlage

[Unreleased]: https://github.com/USER/isiHunt/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/USER/isiHunt/releases/tag/v0.1.0
