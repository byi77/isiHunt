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
