# Belohnungscodes — Datenmodellgrundlage (P1-70/P1-71)

Diese Datei beschreibt den Vertrag vor der produktiven SQL-Migration. Die
Einlösung ist noch nicht freigeschaltet; Klartextcodes werden bis dahin weder
im Frontend-Bundle noch in Logs oder einer lesbaren Katalogtabelle gespeichert.

## Produktvertrag

- Eingabe: exakt zwölf ASCII-Ziffern als Text.
- Anzeige: `1234-5678-9012`.
- Erlaubte Normalisierung: nur Leerzeichen und Bindestriche entfernen.
- Führende Nullen bleiben erhalten; keine Zahlkonvertierung.
- Belohnungstypen: `coins`, `cosmetic_grant`, `minimum_level`, `xp_run_boost`.
- `cosmetic_purchase_unlock` bleibt ein späterer, eigener Berechtigungstyp.
- Jeder Einlöseversuch erhält eine Request-ID; Wiederholung derselben Request-ID
  darf höchstens dasselbe Ergebnis liefern.

## Tabellenentwurf

| Tabelle | Zweck |
| --- | --- |
| `reward_campaigns` | Status, Zeitfenster, Gesamt-/Kontolimits und Ersteller |
| `reward_packages` | versioniertes, validiertes Belohnungs-JSON; veröffentlichte Version unveränderlich |
| `reward_codes` | HMAC-Prüfwert, Schlüsselversion, Kampagne, Status und maskierte Endziffern |
| `reward_redemptions` | Konto, Code, Paketversion, Request-ID und Ergebnisbeleg |
| `reward_campaign_accounts` | atomarer Kontozähler je Kampagne |
| `reward_grants` | tatsächlich gebuchte Positionen mit vorher/nachher relevanten Werten |
| `profile_boosts` | erworbene und noch nicht verbrauchte Laufrechte |
| `boost_run_attempts` | Start-Request, Balance-Snapshot, Frist und Laufstatus |
| `boost_applications` | eindeutige Anwendung eines Bonusrechts auf einen Lauf |
| `reward_admin_audit` | bereinigte Admin-Aktion ohne Klartextcode |

## Verbindliche Sicherheitsgrenzen

RLS bleibt aktiv; Clients schreiben weder Zähler noch Grants. Ein authentifi-
zierter Handler ermittelt das Konto aus dem Token. Die atomare Einlösung muss
Kampagnen-/Kontolimit, Ablauf, Status und Request-ID in einer Transaktion
prüfen. HMAC-Geheimnis, Rate-Limits und Fehlversuchszähler gehören in die
serverseitige Sicherheitsphase P1-72; sie sind noch nicht produktiv.
