# isiHunt — Arbeitsplatz auf einem neuen Rechner einrichten

**Eine Datei, alles drin.** Ziel: auf einem zweiten Rechner exakt so arbeiten
koennen wie auf dem Hauptrechner — gleiche Toolchain, gleiche Claude-Code-
Umgebung, gleiche Testskripte, gleicher Deploy-Weg.

Aufgenommen am **2026-09-03** vom Hauptrechner (Windows 11, ARM64).
Alles darin ist ausgelesen, nicht erinnert. Was nicht geprueft werden konnte,
ist im Anhang als solches benannt.

> **Das Wichtigste zuerst: `/start` laeuft beim ersten Mal ZWEIMAL.**
> Der erste Lauf spielt die globale Claude-Konfiguration ein und haelt an.
> Dann die Claude-Sitzung neu starten und `/start` erneut sagen — der zweite
> Lauf macht den Rest. Warum, steht unten im Kasten "Warum zweimal?".

---

## Der kurze Weg

Wer nicht alles lesen will — das hier genuegt.

**1. In einer PowerShell:**

```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
winget install Microsoft.VisualStudioCode
git clone https://github.com/byi77/isiHunt.git C:\Git\isiHunt
```

**2. PowerShell neu oeffnen.** `winget` aendert den PATH, die laufende Sitzung
erbt ihn nicht — ohne diesen Schritt findet der naechste kein `npm`.

```powershell
code C:\Git\isiHunt
```

**3. In VS Code:** Erweiterung `anthropic.claude-code` installieren, anmelden.

**4. `/start` sagen.** Der Skill spielt die globale Claude-Konfiguration ein
und haelt an.

**5. Claude-Sitzung neu starten, dann noch einmal `/start`.** Jetzt laeuft der
Rest ohne Rueckfragen durch: Git-Hooks, Abhaengigkeiten, Playwright-Browser,
Erinnerungen, `.env` — und zum Schluss `npm run verify` als Nachweis.

> **Warum zweimal?** In der globalen `settings.json` steht
> `bypassPermissions`. Solange sie nicht in `~/.claude` liegt, muss jeder
> Schritt einzeln bestaetigt werden — acht Rueckfragen fuer etwas, dem man mit
> `/start` schon zugestimmt hat. Und die globalen Arbeitsregeln aus
> `CLAUDE.md` greifen ebenfalls erst nach einem Neustart. Der Neustart ist
> ohnehin faellig; die Aufteilung nutzt ihn.

**Der Rest dieses Dokuments erklaert, was `/start` tut** — als Nachschlagewerk,
wenn etwas klemmt oder von Hand gemacht werden soll.

> **Reihenfolge einhalten**, wenn von Hand gearbeitet wird: Teil 3 (Repo)
> setzt Teil 1 (Toolchain) voraus, Teil 5 (Verifikation) setzt alles davor
> voraus.

---

## Teil 0 — Was hier NICHT drinsteht (und warum)

| Sache               | Warum nicht                                                                                                   | Wo stattdessen |
| ------------------- | ------------------------------------------------------------------------------------------------------------- | -------------- |
| Supabase-Schluessel | Geheimnis, gehoert nicht in ein versioniertes Dokument                                                        | Teil 4         |
| GitHub-Zugangsdaten | dito                                                                                                          | Teil 1.5       |
| Claude-Code-Login   | An das Anthropic-Konto gebunden, nicht an den Rechner                                                         | Teil 2.1       |
| MCP-Server (lokal)  | **Es sind keine konfiguriert.** `mcpServers` ist in `~/.claude.json` global und projektweit ein leeres Objekt | Teil 2.4       |

---

## Teil 1 — Systemvoraussetzungen

### 1.1 Node.js

`package.json` verlangt `"engines": { "node": ">=22.22.2" }`.
Hauptrechner faehrt **v24.20.0**, CI faehrt **Node 24**.

**Node 24 nehmen, nicht 20 oder 22.** Begruendet in `.github/workflows/ci.yml`:
`jsdom` (Testumgebung) verlangt `^22.22.2 || ^24.15.0 || >=26`, sein `undici`
mindestens 22.19. Unter Node 20 bricht der Testlauf mit
`markAsUncloneable is not a function` ab.

```powershell
winget install OpenJS.NodeJS.LTS
```

Pruefen (Ziel: v24.x, npm 11.x):

```powershell
node -v; npm -v
```

Der `pre-commit`-Hook sucht Node zusaetzlich unter
`C:\Program Files\nodejs\node.exe`, falls der PATH in der Git-Hook-Shell fehlt.
Eine Installation an anderer Stelle (nvm, scoop) funktioniert, solange `node`
im PATH steht — sonst greift der Fallback nicht.

### 1.2 Git

Hauptrechner: **2.55.0.windows.5**

```powershell
winget install Git.Git
```

### 1.3 GitHub CLI

Hauptrechner: installiert unter `C:\Program Files\GitHub CLI\gh`.
Gebraucht fuer PR- und Actions-Arbeit.

```powershell
winget install GitHub.cli
gh auth login
```

### 1.4 VS Code

```powershell
winget install Microsoft.VisualStudioCode
```

Beim Installieren **"Zu PATH hinzufuegen"** anhaken — sonst fehlt der Befehl
`code` in der Konsole, den Teil 2.6 braucht. Fuer `/start` ist er nicht
noetig.

### 1.5 GitHub-Zugang

Remote des Repos: `https://github.com/byi77/isiHunt.git` (HTTPS).
Nach `gh auth login` uebernimmt der Git-Credential-Manager die Anmeldung.

Commit-Identitaet auf dem Hauptrechner: `Yavuz Isik <yavuz.isik@gmail.com>`.
Fuer dieses Repo wird teils die noreply-Adresse benutzt
(`52194710+byi77@users.noreply.github.com`). Im Zweifel die letzten Commits
ansehen:

```powershell
git log -5 --format='%an <%ae>'
```

---

## Teil 2 — Claude Code

### 2.1 Installation und Anmeldung

Claude Code ist auf dem Hauptrechner als **VS-Code-Erweiterung**
`anthropic.claude-code` (Version 2.1.259) installiert.

1. VS Code oeffnen
2. Erweiterung `anthropic.claude-code` installieren (siehe Teil 2.6)
3. Anmelden — laeuft ueber das Anthropic-Konto, nicht ueber lokale Dateien

### 2.2 Globale Einstellungen (`~/.claude/settings.json`)

Das ist der Kern. Auf dem neuen Rechner nach
`C:\Users\<NAME>\.claude\settings.json` legen.

Die Originaldatei vom Hauptrechner enthaelt eine lange, historisch gewachsene
`permissions.allow`-Liste mit PowerShell-Einzelbefehlen aus frueheren
Sitzungen (Systemcheck, ein anderes Repo `isilive-workspace`). **Die braucht
der neue Rechner nicht** — durch `"defaultMode": "bypassPermissions"` ist sie
ohnehin wirkungslos. Diese Minimalfassung entspricht dem wirksamen Verhalten:

```json
{
  "permissions": {
    "allow": ["Bash", "Read", "Edit", "Write", "WebFetch", "WebSearch"],
    "defaultMode": "bypassPermissions"
  },
  "model": "opus",
  "effortLevel": "high",
  "agentPushNotifEnabled": true,
  "inputNeededNotifEnabled": true,
  "enabledPlugins": {
    "claude-mem@thedotmack": true,
    "headroom@headroom-marketplace": true,
    "claude-code-setup@claude-plugins-official": true
  },
  "extraKnownMarketplaces": {
    "thedotmack": {
      "source": { "source": "github", "repo": "thedotmack/claude-mem" }
    },
    "headroom-marketplace": {
      "source": { "source": "github", "repo": "headroomlabs-ai/headroom" }
    },
    "claude-plugins-official": {
      "source": { "source": "github", "repo": "anthropics/claude-plugins-official" }
    }
  }
}
```

> `"defaultMode": "bypassPermissions"` heisst: Claude fragt vor Werkzeug-
> aufrufen nicht nach. Bewusste Entscheidung des Hauptrechners. Wer das auf
> dem Zweitrechner nicht will, setzt `"acceptEdits"` oder loescht die Zeile.

### 2.3 Globale Arbeitsanweisungen (`~/.claude/CLAUDE.md`)

3155 Bytes, gilt fuer **alle** Projekte, nicht nur isiHunt. Inhalt in
Stichworten:

- **Shell-Praeferenz:** PowerShell statt Bash (Windows-System)
- **Task-Observer:** Skill zu Sitzungsbeginn aufrufen
- **Ehrlichkeit vor Diplomatie** — drei Regeln:
  1. Nichts erfinden; bei Unsicherheit "ich weiss es nicht"
  2. Erst Schwachstellen suchen, dann bewerten
  3. Bei strittigen Fragen Gegenposition zuerst, dann klares Urteil

**Uebertragen:** erledigt `/start` — die Datei liegt versioniert unter
`.claude/global/CLAUDE.md` und wird nach `~/.claude/` kopiert, falls dort noch
keine steht (Teil 6.2).

### 2.4 MCP-Server

**Lokal ist keiner konfiguriert.** Geprueft in `~/.claude.json`: `mcpServers`
ist global `{}` und fuer alle drei isiHunt-Pfadvarianten `{}`,
`enabledMcpjsonServers` ist `[]`.

Verfuegbar sind stattdessen **Konto-Konnektoren von claude.ai** (Gmail, Google
Drive). Die haengen am Anthropic-Konto, nicht am Rechner — nach der Anmeldung
sind sie da. Google Drive verlangt eine einmalige Freigabe in den
claude.ai-Konnektoreinstellungen.

**Auf dem neuen Rechner also nichts zu tun.**

### 2.5 Plugins und Skills

Drei Plugins, alle im Benutzer-Scope installiert:

| Plugin              | Version | Marketplace (GitHub)                 |
| ------------------- | ------- | ------------------------------------ |
| `claude-mem`        | 13.14.0 | `thedotmack/claude-mem`              |
| `headroom`          | 0.34.0  | `headroomlabs-ai/headroom`           |
| `claude-code-setup` | 1.0.0   | `anthropics/claude-plugins-official` |

Wenn `settings.json` aus Teil 2.2 steht (mit `extraKnownMarketplaces` und
`enabledPlugins`), installiert Claude Code sie beim naechsten Start selbst
nach. Sonst manuell in einer Claude-Code-Sitzung:

```
/plugin marketplace add thedotmack/claude-mem
/plugin marketplace add headroomlabs-ai/headroom
/plugin marketplace add anthropics/claude-plugins-official
/plugin install claude-mem@thedotmack
/plugin install headroom@headroom-marketplace
/plugin install claude-code-setup@claude-plugins-official
```

**Zwei eigene Skills** liegen unter `~/.claude/skills/`. Sie sind im Repo
unter `.claude/global/skills/` versioniert und werden von `/start` eingespielt
(Teil 6.2):

- `codebase-improvement-audit/`
- `task-observer/`

Der `task-observer` wird laut globaler `CLAUDE.md` zu jedem Sitzungsbeginn
aufgerufen; ohne ihn fehlt ein Baustein des Arbeitsablaufs.

### 2.6 VS-Code-Erweiterungen

Vom Hauptrechner ausgelesen (`~/.vscode/extensions`). Fuer isiHunt relevant
sind die ersten vier; der Rest ist persoenliche Umgebung bzw. stammt aus
anderen Projekten.

```powershell
# Fuer isiHunt gebraucht
code --install-extension anthropic.claude-code
code --install-extension github.vscode-github-actions
code --install-extension github.vscode-pull-request-github
code --install-extension ms-vscode.powershell

# Persoenliche Umgebung (optional)
code --install-extension ms-ceintl.vscode-language-pack-de
code --install-extension sdras.night-owl
code --install-extension openai.chatgpt

# Aus anderen Projekten, fuer isiHunt ohne Belang (optional)
code --install-extension ms-python.python
code --install-extension ms-python.debugpy
code --install-extension ms-python.vscode-pylance
code --install-extension ms-python.vscode-python-envs
code --install-extension ketho.wow-api
code --install-extension stanzilla.vscode-wow-toc
code --install-extension sumneko.lua
```

Die Projekt-Einstellungen (`.vscode/settings.json`) kommen mit dem Klon und
schalten die Python-Erweiterung fuer `.env`-Dateien stumm — isiHunt liest die
Supabase-Variablen ueber `import.meta.env`, nicht ueber die
VS-Code-Terminalumgebung.

> **Architektur:** Der Hauptrechner ist **ARM64** (`win32-arm64`-Builds). Ein
> x64-Rechner bekommt automatisch die passenden Builds — die Erweiterungs-IDs
> sind dieselben, nur die heruntergeladenen Pakete unterscheiden sich.

### 2.7 Erinnerungen (Memory) — laufen ueber das Repo

Claude legt seine Erinnerungen unter
`C:\Users\<NAME>\.claude\projects\C--Git-isiHunt\memory\` ab — ausserhalb des
Repos, also rechnerlokal. Damit sie zwischen den Rechnern gleich bleiben,
liegen sie zusaetzlich versioniert in `.claude/memory/` und werden per Skript
hin- und hergeschoben:

```powershell
npm run memory:load    # Repo -> ~/.claude   (einmal nach dem Klonen)
npm run memory:save    # ~/.claude -> Repo   (vor dem Commit; /finish macht das)
npm run memory:check   # nur melden, nichts schreiben
```

**Auf dem neuen Rechner also: nach `npm ci` einmal `npm run memory:load`.**
Danach sind die Erinnerungen da, ohne dass etwas von Hand kopiert wird.

Warum ueber Git und nicht ueber einen Cloud-Ordner: Der Ordner
`~/.claude/projects/C--Git-isiHunt/` ist **113 MB**, davon sind die
Erinnerungen **2,5 KB**. Der Rest sind Sitzungstranskripte (`.jsonl`), in die
Claude waehrend laufender Sitzungen schreibt — ein Sync-Client wuerde dort
Konfliktdateien erzeugen. Die Skripte fassen nur `*.md` im `memory/`-Ordner an.

Der Ordnername leitet sich vom Projektpfad ab (`C:\Git\isiHunt` →
`C--Git-isiHunt`). `sync-memory.mjs` berechnet ihn selbst aus dem
tatsaechlichen Pfad und prueft beide Schreibweisen des Laufwerksbuchstabens —
ein Klon an anderer Stelle funktioniert also auch, dann aber ohne die
Sitzungshistorie des Hauptrechners.

Die zwei Erinnerungen in Kurzform:

- **Doku nur auf Nachfrage:** Markdown-Doku erst nach Task-Ende aktualisieren,
  vorher immer fragen.
- **Playtest immer mit `--watch`:** Tests nie headless starten, der Nutzer
  will zusehen.

### 2.8 Der Skill `/finish`

Liegt versioniert unter `.claude/skills/finish/SKILL.md` und ist damit auf
jedem Rechner sofort da, sobald das Repo geklont ist — **kein eigener Sync
noetig.**

`/finish` faehrt die vollstaendige Auslieferungskette:

```
memory:save → verify → commit → push → deploy:wait → Versionsnummer melden
```

Regeln, die der Skill einhaelt:

- **`verify` rot heisst Stopp.** Kein Commit, kein Push, keine Reparatur auf
  eigene Faust.
- **Commit-Nachricht aus dem Diff**, in der Form `typ(bereich): beschreibung`.
- **Warten, bis die Version live ist** (bis zu 10 Minuten), dann die Nummer
  melden. Ein Push allein gilt nicht als fertig.
- **Keine Doku-Updates ungefragt** — er fragt am Ende nach.
- **Kein `--no-verify`**, kein Branch-Wechsel.

Aufruf: `/finish` oder mit Text `/finish zeitring im hud`, der dann zum Kern
der Commit-Nachricht wird.

---

## Teil 3 — Repository

### 3.1 Klonen

```powershell
New-Item -ItemType Directory -Force C:\Git
git clone https://github.com/byi77/isiHunt.git C:\Git\isiHunt
Set-Location C:\Git\isiHunt
```

**Nach `C:\Git\isiHunt`, nicht woandershin** — sonst greift der Memory-Ordner
aus Teil 2.7 nicht.

### 3.2 Abhaengigkeiten

```powershell
npm ci
```

`npm ci`, nicht `npm install`: faehrt exakt gegen `package-lock.json`, so wie
die CI. Produktion: `phaser`, `three`, `@supabase/supabase-js`.
Werkzeuge: `typescript`, `vite`, `vitest`, `eslint`, `prettier`, `playwright`,
`jsdom`.

### 3.3 Git-Hooks aktivieren — **der Schritt, der am ehesten vergessen wird**

`.git/hooks` wird nicht mitgeklont. Ohne diesen Befehl laufen `pre-commit` und
`pre-push` nicht:

```powershell
git config core.hooksPath .githooks
```

| Hook         | Tut                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| `pre-commit` | zaehlt die Patch-Version hoch (`scripts/bump-version.mjs`) und legt `package.json` mit in den Commit |
| `pre-push`   | faehrt `npm run verify`                                                                              |

**Warum das keine Formsache ist** (aus `CLAUDE.md`): Ein kompletter Testabend
ging verloren, weil auf dem Handy weiterhin v0.1.0 lief, waehrend lokal
laengst korrigiert war — vier Fehlersuchrunden gegen einen Stand, den das
Geraet nie geladen hatte.

Pruefen — muss `.githooks` ausgeben:

```powershell
git config core.hooksPath
```

### 3.4 Playwright-Browser — **der "Simulator"-Teil**

Die Playtest-Suiten fahren echte Browser; `layout` prueft 19 Geraeteformate,
`ios` faehrt echtes WebKit statt Chromium.

Auf dem Hauptrechner liegen unter `~/AppData/Local/ms-playwright`:
`chromium-1234`, `chromium_headless_shell-1234`, `webkit-2336`,
`ffmpeg-1011`, `winldd-1007`.

```powershell
npx playwright install chromium
npx playwright install webkit
```

Ohne `webkit` bricht die `ios`-Suite ab und weist selbst auf
`npx playwright install webkit` hin. Ein iOS-Geraetesimulator (Xcode) ist
**nicht** noetig und unter Windows auch nicht verfuegbar — die `ios`-Suite
prueft die WebKit-Engine, nicht ein Geraet.

---

## Teil 4 — Umgebungsvariablen (Supabase)

`.env` ist per `.gitignore` ausgeschlossen und kommt **nicht** mit dem Klon.

```powershell
Copy-Item .env.example .env
```

Dann `.env` mit den echten Werten fuellen:

```
VITE_SUPABASE_URL=https://<projekt>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

Die Werte stehen im Supabase-Dashboard unter **Project Settings → API keys**.

> **Nur der oeffentliche Schluessel** (`publishable` bzw. `anon`). Der
> `secret`- bzw. `service_role`-Schluessel umgeht alle Zugriffsregeln und darf
> nie in den Client.

**Ohne diese Variablen laeuft das Spiel vollstaendig** — nur Bestenliste und
Spielstand-Abgleich blenden sich aus. Zum reinen Entwickeln und Spielen also
nicht zwingend.

Zwei weitere Env-Dateien sind versioniert und ohne Handgriff nutzbar:

| Datei             | Zweck                                                               |
| ----------------- | ------------------------------------------------------------------- |
| `.env.playtest`   | enthaelt bewusst leere Werte, wird von `npm run playtest` gebraucht |
| `.env.production` | Werte fuer den Produktionsbuild                                     |

Das Datenbankschema selbst: `supabase/schema.sql` im SQL-Editor ausfuehren,
danach die `phase_2_*.sql`-Migrationen in numerischer Reihenfolge. Auf einem
Zweitrechner, der gegen dieselbe Supabase-Instanz arbeitet, entfaellt das.

---

## Teil 5 — Verifikation: sitzt es?

Der Reihe nach. Wenn alle vier gruen sind, ist der Rechner arbeitsbereit.

### 5.1 Toolchain

```powershell
node -v; npm -v; git --version; git config core.hooksPath
```

Erwartung: `v24.x`, `11.x`, `2.5x`, `.githooks`

### 5.2 Die volle Pruefkette

```powershell
npm run verify
```

Faehrt in genau dieser Reihenfolge — dieselbe wie CI und `pre-push`:

```
typecheck → lint → format:check → balance:inventory → scene:guards
→ save:version → balance:check → test → build
```

Die vier statischen Gates decken ab, was Vitest nicht erreicht:

| Gate                | Prueft                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `balance:inventory` | haelt Balance-Zahlen aus dem produktiven Code heraus                                     |
| `scene:guards`      | kein Oberflaechenzugriff nach `await` ohne `this.scene.isActive()`                       |
| `save:version`      | `SAVE_VERSION` und die Postgres-Funktion `save_version()` auf derselben Zahl             |
| `balance:check`     | `balance-data.json` und der JSON-Block in der Supabase-Migration nennen dieselben Zahlen |

`format:check` gehoert dazu — sein Fehlen hat schon eine rote CI erzeugt,
obwohl lokal alles durchlief.

### 5.3 Dev-Server

```powershell
npm run dev
```

`vite --host` gibt eine Netzwerk-Adresse aus. **Handy und PC im selben WLAN**,
dann die Adresse dort oeffnen — so wird auf echter Hardware getestet.

### 5.4 Playtest

```powershell
npm run playtest -- --sim --watch
```

`--sim` rechnet die 90-Sekunden-Runde statt sie abzuwarten (~9 statt ~20
Minuten). `--watch` zeigt ein sichtbares Fenster statt headless — **so wird
hier gearbeitet**, damit man zusehen kann.

Sieben Suiten:

| Suite      | Prueft                                                         |
| ---------- | -------------------------------------------------------------- |
| `screens`  | jeder Menue-Bildschirm oeffnet ohne Konsolenfehler             |
| `nav`      | Menuewege hin und zurueck, per echtem Klick auf den Knopf      |
| `controls` | ueberlappende, verrutschte oder zu kleine Knoepfe; Scrollen    |
| `layout`   | Canvas-Ueberstand ueber 19 Geraeteformate                      |
| `ios`      | dieselbe Seite in echtem WebKit statt in Chromium              |
| `progress` | Levelaufstieg, Muenzen, Erfolge, Spielstand ueber ein Neuladen |
| `modes`    | Solo in drei Welten, Tageslauf, Bot-Duell                      |

Einzelne Suite: `npm run playtest -- --only=nav --watch`

Vor einem Release **ohne** `--sim` fahren: mit `--sim` schlaeft Phasers Loop,
Rendering, Tweens und Bildrate werden dabei nicht geprueft.

---

## Teil 6 — Einrichtung per `/start`

Der Skill `/start` erledigt Teil 3 und Teil 4 vollstaendig und Teil 2 bis auf
die Anmeldung. Er liegt versioniert unter `.claude/skills/start/SKILL.md` und
ist damit nach dem Klonen sofort da.

```
/start
```

Dahinter steht `scripts/setup-workstation.mjs`, das auch von Hand fahrbar ist:

```powershell
npm run setup          # einrichten
npm run setup:check    # nur pruefen, nichts schreiben
```

Was es der Reihe nach tut:

| Schritt               | Tut                                                                   |
| --------------------- | --------------------------------------------------------------------- |
| Werkzeuge             | prueft Node, Git, gh und meldet Fehlendes mit dem winget-Befehl       |
| Git-Hooks             | `git config core.hooksPath .githooks`                                 |
| Abhaengigkeiten       | `npm ci`, wenn `node_modules` fehlt                                   |
| Playwright            | `chromium` und `webkit` nachinstallieren                              |
| Globale Claude-Config | `.claude/global/` → `~/.claude/` (CLAUDE.md, settings.json, 2 Skills) |
| Erinnerungen          | `memory:load` — Repo → `~/.claude/projects/<slug>/memory/`            |
| `.env`                | aus `.env.example` anlegen                                            |

**Wiederholbar.** Was schon sitzt, wird nicht angefasst; ein zweiter Lauf
aendert nichts. `npm run setup:check` taugt deshalb auch als Diagnose, wenn
spaeter etwas klemmt.

**Vorhandene Dateien in `~/.claude` werden nie ueberschrieben.** Auf einem
Rechner, auf dem schon gearbeitet wurde, steht dort der gewachsene Stand. Das
Skript meldet stattdessen "weicht vom Repo ab" — ein Hinweis, keine
Aufforderung.

### 6.1 Was `/start` nicht kann

Vier Dinge bleiben Handarbeit, weil sie einen Browser oder eine Entscheidung
brauchen:

| Offen                      | Warum                                                |
| -------------------------- | ---------------------------------------------------- |
| Claude Code anmelden       | OAuth im Browser, an das Anthropic-Konto gebunden    |
| `gh auth login`            | dito; nur fuer PR- und Actions-Arbeit noetig         |
| VS-Code-Erweiterungen      | `code` steht nicht zuverlaessig im PATH (Teil 2.6)   |
| Supabase-Schema einspielen | nur bei eigener Instanz — eine Entscheidung (Teil 4) |

Die Supabase-Schluessel fragt `/start` ab und traegt sie ein; wer sie nicht zur
Hand hat, kann abwinken und spaeter nachtragen.

### 6.2 Die globale Claude-Konfiguration im Repo

Unter `.claude/global/` liegt versioniert, was sonst nur in `~/.claude`
stuende:

| Datei                                | Enthaelt                                   |
| ------------------------------------ | ------------------------------------------ |
| `CLAUDE.md`                          | globale Arbeitsanweisungen (Teil 2.3)      |
| `settings.json`                      | Berechtigungen, Modell, Plugins (Teil 2.2) |
| `skills/codebase-improvement-audit/` | Audit-Skill                                |
| `skills/task-observer/`              | Beobachter-Skill                           |

Das ist eine bewusste Entscheidung mit einem Preis: `~/.claude/CLAUDE.md` gilt
fuer **alle** Projekte, nicht nur isiHunt. Sie hier zu versionieren heisst,
dass isiHunt die projektuebergreifenden Arbeitsregeln mitverwaltet. Bei zwei
Rechnern und einem Hauptprojekt ist das der einzige Weg, die Einrichtung ohne
Handarbeit zu bekommen.

Die versionierte `settings.json` ist die **bereinigte** Fassung: ohne die
historisch gewachsene `permissions.allow`-Liste des Hauptrechners, die Pfade
zu einem anderen Repo (`isilive-workspace`) enthaelt und durch
`"defaultMode": "bypassPermissions"` ohnehin wirkungslos ist.

Aendert sich auf dem Hauptrechner etwas an diesen Dateien, gehoert es von Hand
nach `.claude/global/` zurueck — dafuer gibt es keinen Automatismus, weil ein
`~/.claude` mit gewachsenem Stand nicht ungefragt ins Repo geschrieben werden
soll.

## Teil 7 — Der taegliche Arbeitsablauf

Damit auf dem Zweitrechner nicht nur die Werkzeuge, sondern auch die
Arbeitsweise dieselbe ist.

### 7.1 Befehle

```powershell
npm run dev                       # Entwicklungsserver, mit Netzwerkadresse fuers Handy
npm run verify                    # die volle Kette, muss vor jedem Commit gruen sein
npm run test                      # Vitest einmalig
npm run test:watch                # Vitest mitlaufend
npm run test:scope -- --run       # ermittelt die angemessene Teststufe und faehrt sie
npm run playtest -- --sim --watch # Browser-Playtest, sichtbar
npm run test:duel2g               # Online-Duell: Lobby, Talentphase, Run, Ergebnis
npm run deploy:wait               # nach jedem Push: wartet, bis die Version live ist
npm run balance:sync              # nach Balance-Aenderung, SQL-Datei mitcommitten
npm run release:check             # smoke + production + performance + ios + sql
npm run memory:check              # weichen die Claude-Erinnerungen ab?
```

In einer Claude-Code-Sitzung ersetzt **`/finish`** die Kette von Hand:
`memory:save` → `verify` → commit → push → `deploy:wait` → Versionsnummer
(Teil 2.8).

### 7.2 Teststufen

Nicht jede Aenderung braucht jeden Test. `npm run test:scope` liest die
geaenderten Dateien und nennt die Stufe:

| Stufe   | Dauer   | Wann                                               |
| ------- | ------- | -------------------------------------------------- |
| _keine_ | 0 Min   | Doku, Hooks, CI — `npm run verify` genuegt         |
| klein   | ~2 Min  | sonstiger Quellcode                                |
| mittel  | ~5 Min  | `ui/`, einzelne Scenes, Eingabe                    |
| gross   | ~11 Min | `index.html`, `main.ts`, `viewport.ts`, Persistenz |
| voll    | ~20 Min | `GameScene`, Balancing, Welten, Entities           |

Ein Volltest bei einer Doku-Aenderung kostet 20 Minuten fuer nichts.

### 7.3 Die Deploy-Kette

```
Aenderung → commit (Version +1) → push → CI + Deploy → Pages → Handy
```

Jedes Glied kann reissen, deshalb sichert sich jede Bruchstelle selbst ab:

| Bruchstelle                | Absicherung                                            |
| -------------------------- | ------------------------------------------------------ |
| Version nicht hochgezaehlt | `pre-commit` zaehlt hoch, `pre-push` und CI blockieren |
| Kaputter Code gepusht      | `pre-push` faehrt `npm run verify`                     |
| CI rot, Deploy trotzdem    | der Deploy faehrt `verify` selbst und bricht ab        |
| `index.html` aus dem Cache | `no-cache`-Meta                                        |
| Deploy kommt nicht an      | `npm run deploy:check` fragt den Server                |

**Pflicht nach jedem Push:**

```powershell
npm run deploy:wait
```

Holt die `index.html` vom Server (`https://byi77.github.io/isiHunt/`), folgt
ihr zum gehashten Bundle und vergleicht die Version mit der lokalen —
denselben Weg geht auch der Browser. Erst wenn das gruen ist, sind
Rueckmeldungen vom Geraet verwertbar.

> **Ein Fehlerbericht ohne Versionsnummer ist wertlos.** Die Nummer steht
> unten rechts auf dem Bildschirm — im DOM, nicht im Canvas, also sichtbar
> auch dann, wenn Phaser nicht startet.

Zwei GitHub-Workflows laufen dabei: `ci.yml` (jeder Branch: `verify` +
`release:check`) und `deploy.yml` (nur `main`: baut und veroeffentlicht auf
GitHub Pages). Beide auf Node 24.

### 7.4 Vor dem ersten Handgriff im Code lesen

| Frage                       | Datei                  |
| --------------------------- | ---------------------- |
| Was soll das Spiel sein?    | `docs/GAME_DESIGN.md`  |
| Wie ist der Code aufgebaut? | `docs/ARCHITECTURE.md` |
| Wie wird geschrieben?       | `docs/CODE_STYLE.md`   |
| Warum so und nicht anders?  | `docs/DECISIONS.md`    |
| Was kommt als naechstes?    | `docs/ROADMAP.md`      |

Die neun Regeln stehen in `CLAUDE.md` im Repo-Wurzelverzeichnis und werden zu
jeder Claude-Code-Sitzung automatisch geladen.

---

## Teil 8 — Checkliste zum Abhaken

```
[ ] Node 24, Git, VS Code installiert
[ ] PowerShell nach der Installation NEU geoeffnet (PATH!)
[ ] Repo nach C:\Git\isiHunt geklont, Ordner in VS Code geoeffnet
[ ] Claude-Code-Erweiterung installiert und angemeldet
[ ] /start (1. Lauf) - globale Konfiguration eingespielt
[ ] Claude-Sitzung neu gestartet
[ ] /start (2. Lauf) - Rest eingerichtet
[ ] npm run setup:check meldet nichts Offenes
[ ] npm run verify ist gruen
[ ] gh auth login          (nur fuer PR-Arbeit)
[ ] npm run dev laeuft, Handy erreicht die Netzwerkadresse
[ ] npm run playtest -- --sim --watch ist gruen
```

---

## Anhang — Was diese Datei bewusst offen laesst

- **`code` im PATH:** Auf dem Hauptrechner war der Befehl im geprueften
  Shell-PATH nicht auffindbar (die Aufnahme lief in Git Bash). Ob er in
  PowerShell dort funktioniert, wurde nicht geprueft. `/start` braucht ihn
  nicht; nur die Erweiterungsbefehle in Teil 2.6 setzen ihn voraus. Falls er
  fehlt, die Erweiterungen von Hand im VS-Code-Marktplatz installieren.
- **Supabase-Projekt:** Ob der Zweitrechner gegen dieselbe Instanz arbeitet
  oder eine eigene bekommt, ist eine Entscheidung, keine Einstellung.
  Dieselbe Instanz ist einfacher; eine eigene braucht das volle
  Schema-Einspielen aus `supabase/` (Teil 4, letzter Absatz).
- **Genaue Versionen der VS-Code-Erweiterungen:** bewusst nicht gepinnt —
  `code --install-extension` holt die aktuellen. Die Stichtagsstaende vom
  Hauptrechner stehen in Teil 2.6 nur als Beleg der Aufnahme.
- **Claude-Code-Version:** Die Erweiterung auf dem Hauptrechner steht auf
  2.1.259 (Stand 2026-09-03). Ein Pinnen ist weder noetig noch vorgesehen —
  VS Code aktualisiert sie selbst.
