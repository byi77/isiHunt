# Balance-Kette

Alle Zahlen, die Punkte, XP oder Coins erzeugen bzw. verbrauchen, beginnen in
`src/config/balance-data.json`. Die Berechnung liegt in `src/config/balance.ts`.

Die Konfiguration arbeitet mit Referenz-Runs:

- Rohwerte beschreiben Relikte, Punkte, XP, Coin-Quellen und Multiplikatoren.
- Zielwerte beschreiben die gewuenschte Dauer in Runs, etwa fuer Level, Talente
  oder Tagesboni.
- Konkrete XP-, Score- und Coin-Werte werden daraus automatisch abgeleitet.

Beispiele:

- Aendert sich XP je Relikt, wird die XP-Kurve so skaliert, dass die geplante
  Level-Dauer in Runs erhalten bleibt.
- Aendert sich die Coin-Einnahme, werden Talent-, Reset- und Shop-Kosten sowie
  laufbasierte Boni mit der neuen Economy skaliert.
- Aendert sich der Punktewert eines Relikts, verschiebt sich auch die
  Score-Schwelle des Tagesbonus.

Nach einer Änderung:

```text
npm run typecheck
npm test -- --run src/config/Balance.test.ts
```

Der exportierte `BALANCE_SNAPSHOT` zeigt die erwarteten Werte pro Fang/Run und
die ungefähre Run-Anzahl bis Level 100 bzw. zum vollständigen Talentbaum.

Für ein bereits eingerichtetes Supabase-Projekt muss zusätzlich die Migration
`supabase/phase_2_14_balance_chain.sql` ausgeführt werden. Sie hält Level-XP,
Tagesboni, Talentkosten, Resetkosten und die Score-Plausibilitätsprüfung auf
derselben Ableitungslogik wie der Client.

Wenn `balance-data.json` geändert wurde, aktualisiert `npm run balance:sync`
den JSON-Block der Migration automatisch.

## Eingefrorene Baselines

`src/config/balance.ts` enthält drei bewusst eingefrorene Bezugsgrößen:

| Baseline              |          Wert | Einheit                |
| --------------------- | ------------: | ---------------------- |
| `expectedXpPerRun`    |   `1 883,985` | XP je Referenz-Run     |
| `expectedCoinsPerRun` |      `52,186` | Coins je Referenz-Run  |
| `expectedScorePerRun` | `1 499,07625` | Punkte je Referenz-Run |

Sie stammen aus vier simulierten Startwelt-Runs vom `2026-08-19`, vor der
Zentralisierung der Balance-Kette. Sie sind der Maßstab, gegen den neue
Rohwerte skaliert werden, nicht die aktuelle Messung. Eine neue Rarität,
geänderte Gewichte, andere erwartete Fangzahlen oder eine neue Referenz-Combo
erfordern deshalb zuerst eine dokumentierte Neumessung und eine bewusste
Entscheidung, ob nur die Rohwerte oder auch die Baseline geändert werden.
Die Herkunft steht zusätzlich maschinenlesbar in `BALANCE_BASELINES`, damit
Tests und der Snapshot dieselbe Quelle verwenden.

## Verträge und Inventur

Der Test in `src/config/Balance.test.ts` liest den `$json$`-Block aus
`supabase/phase_2_14_balance_chain.sql` und vergleicht ihn strukturell mit
`balance-data.json`. Eine Abweichung macht `npm run verify` rot; mit
`npm run balance:sync` wird der Serverblock reproduzierbar aktualisiert.

`npm run balance:inventory` scannt die produktiven Scenes, Entities und
Systems auf neue Inline-Coin-Gutschriften, direkte Coin-Abzüge sowie harte
XP-/Punkte-/Bonusfelder. Test-Fixtures und die ausdrücklich zentralen
Konfigurationstabellen werden nicht als Laufzeitquelle behandelt.

Die vollständige Einnahmen-/Kosten-Inventur liegt in
`docs/BALANCE_INVENTORY.md`. Dort ist für jede Quelle und Senke die Rohquelle,
die Laufzeitstelle, der Serverpfad und die begründete Ausnahme dokumentiert.

## Änderungsbericht

```text
npm run balance:report
```

Der Befehl importiert die echte TypeScript-Ableitung und gibt deterministisch
aus: Punkte/XP/Coins pro Fang und Run, Runs bis Level 100 und Talentmaximum,
Tagesabschluss und maximale Tagesbelohnung, Talentkosten sowie Beispiele für
die teuersten und günstigsten bezahlten Shop-Einträge. Er enthält kein zweites
Berechnungsmodell und ist deshalb die schnellste Kontrolle nach einer Änderung
an `balance-data.json`.
