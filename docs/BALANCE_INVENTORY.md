# Balance-Inventur

**Stand:** 2026-08-21 · Quelle: `src/config/balance-data.json`

Dieses Dokument beantwortet für jede laufende Einnahme und Ausgabe drei
Fragen: Wo beginnt der Rohwert? Wo wird er im Client verrechnet? Welcher
Server- oder Synchronisationspfad muss denselben Wert verwenden?

## Punkte

| Vorgang              | Rohquelle                                 | Client-Stelle                                              | Server-/Schutzpfad                                                   |
| -------------------- | ----------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| Punkte je Relikt     | `rarities.*.points`                       | `ScoreSystem.registerCollect()`                            | `max_plausible_score()` liest dieselben Raritäten                    |
| Combo-Multiplikator  | `score.comboTiers`                        | `multiplierForCombo()` und `ScoreSystem`                   | Tages-Score-Tiers verwenden `balance_score_for_runs()`               |
| Weltbonus            | `worlds.*.scoreMultiplier`                | `ScoreSystem` erhält den Weltmultiplikator aus `GameScene` | `max_plausible_score()` prüft Welt-ID und Multiplikator              |
| Tages-Score-Schwelle | `economy.daily.scoreTierRuns`             | `DAILY_SCORE_BONUS_STEP` und `ChallengeSystem`             | `claim_daily_bonus()` berechnet die Tierzahl serverseitig            |
| Score-Grenze         | keine Belohnungsquelle; Sicherheitsgrenze | kein separater Generator                                   | `max_plausible_score()` cappt Missbrauch und nutzt Sicherheitsmargen |

Die Rarity-Tabelle in `src/config/rarities.ts` ist eine Kompatibilitätsansicht
für den Client. Ihr Punkte-/XP-Inhalt wird in `Balance.test.ts` gegen die
Balance-Rohquelle geprüft.

## XP

| Vorgang           | Rohquelle                                           | Client-Stelle                           | Server-/Synchronisationspfad                                                          |
| ----------------- | --------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------- |
| XP je Relikt      | `rarities.*.xp`                                     | `ScoreSystem.registerCollect()`         | Run-Event überträgt `xpGained`; der Server übernimmt nur sichere, nichtnegative Werte |
| Weltbonus         | `worlds.*.xpMultiplier`                             | `GameScene`/`ScoreSystem`               | Server-Levelberechnung bleibt auf der zentralen Kette                                 |
| Talentbonus       | `talents.insightXpPerRank`                          | `resolveStats()`                        | kein eigener Generator; Event wird serverseitig begrenzt                              |
| XP je Level       | `progression.xp.runsPerLevel` und `referencePerRun` | `xpForLevel()` / `ProgressionSystem`    | `balance_xp_for_level()` und `profile_level_from_xp()`                                |
| Tagesabschluss    | `progression.xp.dailyCompletionRuns`                | `ChallengeSystem` / `applyDailyBonus()` | `claim_daily_bonus()`                                                                 |
| Tages-Score-Tiers | `progression.xp.dailyScoreTierRuns`                 | `ChallengeSystem`                       | `claim_daily_bonus()`                                                                 |

## Coin-Quellen

| Quelle              | Rohquelle                                                      | Client-Stelle                                        | Server-/Synchronisationspfad                                      |
| ------------------- | -------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| Grundbetrag pro Run | `economy.sources.runBaseCoins`                                 | `ProgressionSystem.coinsForRun()`                    | Run-Event und serverseitige Plausibilisierung                     |
| Sammlung            | `collection.stepSize`, `coinsPerStep`, `maxCoins`              | `coinsForRun()`                                      | über das verbuchte Run-Ergebnis, keine zweite Sammlungskonstante  |
| Seltenheit          | `rarity.rareCatchesPerCoin`, `epic*`, `legendaryCoinsPerCatch` | `coinsForRun()`                                      | Server-Event bleibt idempotent; Rohquelle ist dieselbe JSON-Kopie |
| Levelaufstieg       | `sources.levelRewardRuns`                                      | `grantLevelReward()`                                 | `claim_daily_bonus()` und Profil-Level-RPC                        |
| Erfolge             | `achievement.baseRuns`, `additionalRunsPerRank`                | `achievementCoinReward()` / `evaluateAchievements()` | Event überträgt nur validierte Erfolge                            |
| Login-Bonus         | `daily.loginRuns`                                              | `CloudSystem`/Menü-Bonus                             | `claim_daily_login_bonus()`                                       |
| Tagesabschluss      | `daily.completionRuns`                                         | `ChallengeSystem.completeDaily()`                    | `claim_daily_bonus()`                                             |
| Tages-Score-Tiers   | `daily.scoreTierRuns`, `scoreTierCount`                        | `ChallengeSystem`                                    | `claim_daily_bonus()`                                             |

Alle laufbasierten Quellen gehen über `coinsForRuns()` und damit über den
aktuellen Coin-Run-Scale. `totalCoinsEarned` ist nur Buchhaltung und keine
zusätzliche Quelle.

## Coin-Senken

| Senke             | Rohquelle                                 | Client-Stelle                                                  | Schutz                                             |
| ----------------- | ----------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| Talent-Rang       | `sinks.talentCosts[]`                     | `talentCost()` / `ProgressionSystem.purchaseTalent()`          | `purchase_talent()` mit Rang- und Guthabenprüfung  |
| Talent-Reset      | `sinks.talentResetRuns`                   | `resetTalents()`                                               | `reset_talents()` mit Sperre und Kostenprüfung     |
| Schiffsformen     | Referenzpreise in `SHIP_SHAPES_REFERENCE` | `balancedCoinCost()` in `shop.ts`, Kauf in `ProgressionSystem` | Besitzprüfung, Guthabenprüfung und Cloud-Reconcile |
| Schiff-Farben     | Referenzpreise in `SHIP_COLORS_REFERENCE` | `balancedCoinCost()` in `shop.ts`, Kauf in `ProgressionSystem` | Besitzprüfung, Guthabenprüfung und Cloud-Reconcile |
| Künftige Kosmetik | eigene Referenzpreise, sobald eingeführt  | muss denselben `balancedCoinCost()`-Pfad verwenden             | vor Umsetzung in diese Inventur aufnehmen          |

Shop-Referenzpreise sind absichtlich keine zweite Coin-Wahrheit: Sie sind
Gestaltungswerte in einer anderen Einheit und werden beim Export in echte
Coins skaliert. Die Endpreise dürfen nicht zusätzlich in Scenes wiederholt
werden.

## Offline-, Cloud- und Legacy-Pfade

Die dritte Kosmetik-Kategorie `SHIP_AURAS_REFERENCE` folgt demselben
`balancedCoinCost()`- und Besitzpfad wie Formen und Farben. Sie ist deshalb
eine Coin-Senke, aber keine neue Währung oder zusätzliche Balancequelle.

- `ProgressSyncSystem` transportiert Run- und Tageswerte aus der lokalen
  Outbox; es erzeugt keine neue XP- oder Coin-Quelle.
- `CloudSystem` übergibt nur nichtnegative, gerundete Eventwerte an
  `submit_progress_event`; die Event-ID verhindert Doppelgutschriften.
- `claim_daily_bonus()` und `claim_daily_login_bonus()` sind die serverseitigen
  Tagesquellen und prüfen den erlaubten Tages-Key.
- `totalCoinsEarned` und `coinsSpent` sind Buchhaltungsfelder. Sie dürfen nur
  zusammen mit einer echten Gutschrift bzw. Ausgabe verändert werden.
- `COINS_PER_EXTRA_TALENT_POINT` und alte `talentPoints` sind ausschließlich
  SAVE-/RPC-Migrationskompatibilität. Sie sind keine aktive neue Belohnung.

## Bewusste Ausnahmen

- Achievement-Schwellen, Weltfreischaltungen und Shop-Referenzpreise sind
  Content- bzw. Designwerte. Ihre endgültigen Coin-/XP-Wirkungen müssen aber
  über die zentralen Balance-Funktionen laufen.
- `max_plausible_score()` enthält Sicherheitsmargen und ein Abuse-Cap. Diese
  Zahlen sind keine Spielerbelohnungen und werden deshalb nicht in
  `balance-data.json` als Einnahmequelle geführt.
- Zahlen in `*.test.ts` und Debug-/Admin-Fixtures sind Testdaten. Sie dürfen
  feste Werte enthalten, solange sie keinen Produktpfad konfigurieren.

## Automatische Schutzmechanismen

- `npm run balance:inventory` blockiert neue Inline-Gutschriften in produktiven
  Scenes, Entities und Systems.
- `Balance.test.ts` vergleicht JSON und Supabase-SQL strukturell.
- `npm run balance:report` gibt die abgeleiteten Zielwerte und Kosten aus.
- Alle drei Prüfungen laufen vor einem Release über `npm run verify` oder als
  gezielte Balance-Befehle.
