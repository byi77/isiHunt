---
name: start
description: >
  Richtet diese Arbeitskopie von isiHunt vollstaendig ein: fehlende Werkzeuge
  nachinstallieren, Git-Hooks aktivieren, Abhaengigkeiten und
  Playwright-Browser holen, die globale Claude-Konfiguration und die
  Erinnerungen einspielen, die Supabase-Zugangsdaten erfragen und zum Schluss
  pruefen, ob alles laeuft. Verwenden, wenn der Nutzer /start schreibt, das
  Repo frisch geklont hat oder sagt, dass er auf einem neuen Rechner
  anfaengt - auch bei "einrichten", "aufsetzen", "hier zum ersten Mal".
---

# /start — Arbeitskopie einrichten

Bringt einen frisch geklonten Rechner in denselben Zustand wie den
Hauptrechner. **Wiederholbar:** Was schon sitzt, wird nicht angefasst — der
Skill laesst sich jederzeit erneut fahren, etwa um zu pruefen, ob noch alles
steht.

Die Arbeit erledigt `scripts/setup-workstation.mjs`. Dieser Skill fuehrt darum
herum, was ein Skript nicht kann: fehlende Werkzeuge nachinstallieren, nach
den Supabase-Schluesseln fragen und das Ergebnis einordnen.

## Schritt 1 — Bestandsaufnahme

```bash
npm run setup:check
```

Meldet je Punkt "sass schon" oder "offen". **Zuerst lesen, dann handeln** —
oft ist fast alles da und es fehlt nur ein Detail.

Exit-Code 1 heisst nur "es ist etwas offen", nicht "Fehler".

> Laeuft `npm` selbst nicht, fehlt Node. Dann direkt zu Schritt 2.

## Schritt 2 — Fehlende Werkzeuge nachinstallieren

Nur, wenn Schritt 1 sie als fehlend meldet:

```powershell
winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
winget install --id Git.Git --accept-source-agreements --accept-package-agreements
winget install --id GitHub.cli --accept-source-agreements --accept-package-agreements
```

**Node 24, nicht 20 oder 22.** `jsdom` verlangt `^22.22.2 || ^24.15.0 || >=26`;
unter Node 20 bricht der Testlauf mit `markAsUncloneable is not a function` ab.
Meldet Schritt 1 eine zu alte Version, ist das der Grund.

**Nach der Installation ist eine neue Shell noetig**, damit der PATH stimmt.
Das dem Nutzer sagen und ihn bitten, `/start` danach erneut zu fahren —
weiterarbeiten in derselben Shell scheitert an genau diesem PATH.

VS Code und die Erweiterungen gehoeren nicht hierher: Wenn `/start` laeuft,
laeuft Claude Code bereits.

## Schritt 3 — Einrichten

```bash
npm run setup
```

Das Skript ist der eigentliche Kern. Es faehrt der Reihe nach:

| Schritt               | Tut                                                                   |
| --------------------- | --------------------------------------------------------------------- |
| Git-Hooks             | `git config core.hooksPath .githooks`                                 |
| Abhaengigkeiten       | `npm ci`, wenn `node_modules` fehlt                                   |
| Playwright            | `chromium` und `webkit` nachinstallieren                              |
| Globale Claude-Config | `.claude/global/` → `~/.claude/` (CLAUDE.md, settings.json, 2 Skills) |
| Claude-Erinnerungen   | `memory:load` — Repo → `~/.claude/projects/<slug>/memory/`            |
| `.env`                | aus `.env.example` anlegen                                            |

Braucht beim ersten Mal mehrere Minuten (`npm ci` und zwei Browser-Downloads) —
Timeout auf **900000 ms** setzen.

**Vorhandene Dateien in `~/.claude` werden nicht ueberschrieben.** Auf einem
Rechner, auf dem schon gearbeitet wurde, steht dort der gewachsene Stand; ihn
still zu ersetzen waere ein Datenverlust. Meldet das Skript "weicht vom Repo
ab", ist das ein Hinweis, keine Aufforderung — nur angleichen, wenn der Nutzer
es will.

## Schritt 4 — Supabase-Zugangsdaten

Meldet Schritt 3 `.env ... enthaelt noch Platzhalter`, den Nutzer nach den
beiden Werten fragen:

```
VITE_SUPABASE_URL=https://<projekt>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

Sie stehen im Supabase-Dashboard unter **Project Settings → API keys**.

**Nur der oeffentliche Schluessel** (`publishable` bzw. `anon`). Kommt etwas,
das mit `sb_secret_` oder `service_role` anfaengt: **nicht eintragen**, sondern
darauf hinweisen, dass dieser Schluessel alle Zugriffsregeln umgeht und nie in
den Client gehoert.

Der Nutzer kann auch abwinken: **ohne die Werte laeuft das Spiel vollstaendig**,
nur Bestenliste und Spielstand-Abgleich blenden sich aus. Dann die `.env` mit
den Platzhaltern stehen lassen und im Bericht erwaehnen.

Die Werte per `Edit` in die `.env` schreiben, nicht ueber die Shell — sonst
stehen sie in der Befehlshistorie.

## Schritt 5 — Nachweis, dass es laeuft

```bash
npm run verify
```

Timeout **600000 ms**. Faehrt dieselbe Kette wie CI und `pre-push`: Typecheck,
Lint, Format, vier Gates, Tests, Build.

**Das ist der eigentliche Beweis der Einrichtung** — nicht die Meldung des
Setup-Skripts. Ist verify gruen, ist der Rechner arbeitsfaehig.

Ist verify rot, den Fehler einordnen:

| Rot bei             | Bedeutet meist                                     |
| ------------------- | -------------------------------------------------- |
| `typecheck`, `test` | `npm ci` unvollstaendig — nochmal fahren           |
| `format:check`      | Zeilenenden: `git config core.autocrlf` pruefen    |
| `balance:check`     | nichts mit der Einrichtung zu tun, hier unerwartet |

## Schritt 6 — Melden

Kurz, mit Zahlen:

- was eingerichtet wurde, was schon sass
- ob `verify` gruen ist
- was noch offen ist (meist: `.env`, `gh auth login`)

Beispiel:

> Eingerichtet: Git-Hooks, Abhaengigkeiten, chromium + webkit, globale
> Claude-Konfiguration, 3 Erinnerungen, `.env`.
> `npm run verify` ist gruen — der Rechner ist arbeitsfaehig.
> Offen: `gh auth login` fuer PR-Arbeit.

Danach die drei naechsten Schritte nennen:

```bash
npm run dev                       # Server mit Netzwerkadresse fuers Handy
npm run playtest -- --sim --watch # Browser-Playtest
/finish                           # fertige Arbeit ausliefern
```

**Auf Claude Code hinweisen, wenn die globale Konfiguration neu eingespielt
wurde:** Sie greift erst nach einem Neustart der Sitzung. Bis dahin laeuft
Claude ohne die globalen Arbeitsanweisungen und ohne die beiden Skills.

## Was dieser Skill nicht kann

- **Claude Code anmelden.** Laeuft ueber das Anthropic-Konto im Browser. Wenn
  `/start` laeuft, ist es ohnehin schon angemeldet.
- **`gh auth login`.** Braucht einen Browser und eine Eingabe des Nutzers — im
  Bericht als offener Punkt nennen, nicht selbst versuchen.
- **VS-Code-Erweiterungen installieren.** `code --install-extension` steht
  nicht zuverlaessig im PATH. Wenn der Nutzer danach fragt, auf Teil 2.6 in
  `SETUP_NEUER_RECHNER.md` verweisen.
- **Das Supabase-Schema einspielen.** Nur noetig, wenn der Rechner gegen eine
  eigene Instanz arbeiten soll — dann `supabase/schema.sql` und die
  `phase_2_*.sql` in numerischer Reihenfolge. Das ist eine Entscheidung des
  Nutzers, keine Einrichtung.
- **Werkzeuge ohne winget installieren.** Fehlt winget, die Downloadseiten
  nennen statt zu raten.

## Wenn der Nutzer sagt, etwas sei kaputt

`/start` ist auch die richtige Antwort auf "hier geht nichts mehr". Dann
`npm run setup:check` fahren und die offenen Punkte melden — das findet die
haeufigsten Ursachen: Hooks nicht aktiv, `node_modules` nach einem
Node-Update unbrauchbar, Playwright-Browser nach einem Playwright-Update
fehlend.
