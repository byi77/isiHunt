# Einbauplan: Endlosmodus

## Spielablauf

1. Im Hauptmenü stehen **Jagd** und **Endlos** nebeneinander. Endlos startet in der Sternenweide, unabhängig von der zuletzt gewählten Jagdwelt.
2. Jede Runde dauert genau 30 Sekunden. Das HUD zeigt den fortlaufenden Serienstand und das kumulierte Gate. Punkteüberschüsse aus früheren Runden zählen weiter.
3. Bei erreichtem Gate wird die Runde samt XP und Coins gebucht. Danach wählt der Spieler einen temporären Talentrang aus drei Angeboten. Nach jedem vierten Checkpoint gibt es zwei Wahlen. Der dauerhafte Talentbaum bleibt für Endlos wirkungslos; Ausdauer wird nicht angeboten.
4. Alle zwei Runden wechselt die Welt. Hindernisse bremsen im Endlosmodus, ziehen aber weder Zeit noch Punkte ab. Die Weltboni und ein eigener Rundenbonus erhöhen Punkte und XP; der Coinbonus steigt mit der Rundennummer.
5. Bei verfehltem Gate endet die Serie. Auch diese letzte Runde wird ausgezahlt. Der Ergebnisbildschirm zeigt die erreichte Runde und den Gesamtstand; „Nochmal“ startet eine neue Serie. Die Rangliste zeigt je Spieler die beste Serie.

Ab Runde 8 zieht die Schwierigkeit stark an: 1,6-facher Weltfaktor in Runde 8,
2,1-facher in Runde 9 und 2,8-facher ab Runde 10. Das verkuerzt die sichtbare
Zeit der Relikte und erhoeht die Hindernischance. Der einmalige Serien-Rettungsring
ab Serie 6 bleibt ueber die gesamte Endlos-Serie verbraucht, auch nach einem
Checkpoint.

## Vorläufige Balance

| Runde | Runden-Zuwachs | Kumuliertes Gate | Welt                                             |
| ----- | -------------: | ---------------: | ------------------------------------------------ |
| 1     |            500 |              500 | Sternenweide                                     |
| 2     |            700 |            1.200 | Sternenweide                                     |
| 3     |            900 |            2.100 | Eisring                                          |
| 4     |          1.100 |            3.200 | Eisring                                          |
| 5     |          1.300 |            4.500 | Glutnebel                                        |
| 6     |          1.600 |            6.100 | Glutnebel                                        |
| ab 7  |  +300 je Runde |          additiv | Weltwechsel alle zwei Runden, danach letzte Welt |

Punktebonus: +2 % pro Runde nach der ersten. XP-Bonus: +4 % pro Runde nach der ersten. Coins: +2 pro Runde nach der ersten, zusätzlich zu Fang- und Seltenheitsboni. Der Basis-Coinanteil entspricht 30 statt 90 Sekunden. Diese Zahlen sind Startwerte; die Gate-Erfolgsquoten und Erträge müssen im Playtest gemessen werden. Ziel für Runde 1 bis 4: deutlich über 90 % erfolgreiche Gates bei neuen Spielern, danach ein gleichmäßiger Anstieg der Ausfälle.

## Technik und Abnahme

- `GameScene` startet intern jede Runde mit frischem Score und temporärem Build. `HudScene` addiert den bisherigen Serienstand und zeigt das kumulierte Gate. Die Runde wird genau einmal verbucht; ein Scene-Restart beginnt erst nach der Talentwahl. „Serie beenden“ steht unterhalb der Talentwahl am unteren Bildschirmrand.
- `ProgressionSystem` skaliert Coins für die 30-Sekunden-Runde. `ProgressSyncSystem` sendet Endlos-Runden mit Serienkennung, Nummer und temporären Talenten an den eigenen RPC. Der Server verlangt für Runde 2 und später einen gültigen vorherigen Checkpoint derselben Serie. Die SQL-Migration `phase_2_67_endless_rounds.sql` wurde am 2026-09-24 auf dem verknüpften Projekt eingespielt; Marker 67, Spalten und RPC-Signatur wurden live geprüft.
- Phase 2.68 prüft den vorigen Checkpoint anhand der Summe aller Rundenpunkte derselben Serie. `get_endless_leaderboard` ermittelt den besten kumulierten Serienstand je Spieler aus den angenommenen Rundenbelegen. Die Migration wurde am 2026-09-24 live eingespielt; Marker 68, Ausführungsrechte und eine Ranglistenabfrage wurden geprüft.
- Phase 2.69 nimmt Endlos-Belege vom allgemeinen 60-Sekunden-Mindestabstand aus. Eine Endlosrunde dauert nur 30 Sekunden; offline gespielte Runden koennen zudem direkt nacheinander hochgeladen werden. Gate- und Talentpruefung bleiben im Endlos-RPC.
- Phase 2.70 ergaenzt im RPC die Summe aller bestaetigten Serienpunkte je Profil. Die Rangliste zeigt bewusst nur `score`: das Endergebnis der besten einzelnen Serie einschliesslich aller in ihren Runden vergebenen Punkteboni.
- Prüfen: vier frühe Gates, Rundenwechsel, Talent-Maximalrang, Pause und Abbruch, 30-Sekunden-Ablauf, Profilabgleich nach Offline-Spiel sowie kleine Handy-Viewports. Normale Jagd, Tageslauf und Duelle behalten ihre bisherigen Ergebnisse und Bestenlisten.
