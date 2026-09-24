# Einbauplan: Endlosmodus

## Spielablauf

1. Im Hauptmenü stehen **Jagd** und **Endlos** nebeneinander. Endlos startet in der Sternenweide, unabhängig von der zuletzt gewählten Jagdwelt.
2. Jede Runde dauert genau 30 Sekunden. Das HUD zeigt Rundennummer und Gate; nur die in dieser Runde gefangenen Punkte zählen für das Gate. Der Gesamtstand wird für das Endergebnis gesammelt.
3. Bei erreichtem Gate wird die Runde samt XP und Coins gebucht. Danach wählt der Spieler einen temporären Talentrang aus drei Angeboten. Nach jedem vierten Checkpoint gibt es zwei Wahlen. Der dauerhafte Talentbaum bleibt für Endlos wirkungslos; Ausdauer wird nicht angeboten.
4. Alle zwei Runden wechselt die Welt. Hindernisse bremsen im Endlosmodus, ziehen aber weder Zeit noch Punkte ab. Die Weltboni und ein eigener Rundenbonus erhöhen Punkte und XP; der Coinbonus steigt mit der Rundennummer.
5. Bei verfehltem Gate endet die Serie. Auch diese letzte Runde wird ausgezahlt. Der Ergebnisbildschirm zeigt die erreichte Runde und den Gesamtstand; „Nochmal“ startet eine neue Serie.

## Vorläufige Balance

| Runde |          Gate | Welt                                             |
| ----- | ------------: | ------------------------------------------------ |
| 1     |           500 | Sternenweide                                     |
| 2     |           700 | Sternenweide                                     |
| 3     |           900 | Eisring                                          |
| 4     |         1.100 | Eisring                                          |
| 5     |         1.300 | Glutnebel                                        |
| ab 6  | +300 je Runde | Weltwechsel alle zwei Runden, danach letzte Welt |

Punktebonus: +2 % pro Runde nach der ersten. XP-Bonus: +4 % pro Runde nach der ersten. Coins: +2 pro Runde nach der ersten, zusätzlich zu Fang- und Seltenheitsboni. Der Basis-Coinanteil entspricht 30 statt 90 Sekunden. Diese Zahlen sind Startwerte; die Gate-Erfolgsquoten und Erträge müssen im Playtest gemessen werden. Ziel für Runde 1 bis 4: deutlich über 90 % erfolgreiche Gates bei neuen Spielern, danach ein gleichmäßiger Anstieg der Ausfälle.

## Technik und Abnahme

- `GameScene` startet jede Runde mit frischem Score und temporärem Build. `HudScene` zeigt das Gate. Die Runde wird genau einmal verbucht; ein Scene-Restart beginnt erst nach der Talentwahl.
- `ProgressionSystem` skaliert Coins für die 30-Sekunden-Runde. `ProgressSyncSystem` sendet Endlos-Runden mit Serienkennung, Nummer und temporären Talenten an den eigenen RPC. Der Server verlangt für Runde 2 und später einen gültigen vorherigen Checkpoint derselben Serie. Die SQL-Migration `phase_2_67_endless_rounds.sql` wurde am 2026-09-24 auf dem verknüpften Projekt eingespielt; Marker 67, Spalten und RPC-Signatur wurden live geprüft.
- Prüfen: vier frühe Gates, Rundenwechsel, Talent-Maximalrang, Pause und Abbruch, 30-Sekunden-Ablauf, Profilabgleich nach Offline-Spiel sowie kleine Handy-Viewports. Normale Jagd, Tageslauf und Duelle behalten ihre bisherigen Ergebnisse und Bestenlisten.
