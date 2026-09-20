# Bonusrunden: Sicherheitsgrenzen

Die Clientverträge für Finish, Abbruch und Zustandswechsel reduzieren
Wiederholungs- und UI-Fehler. Sie beweisen jedoch nicht, dass ein Ergebnis echt
gespielt wurde: Ein manipulierter Client kann plausible Fangdaten erzeugen.

Die verbindlichen Schutzmaßnahmen gehören daher in einen authentifizierten
Serverpfad: Konto- und Laufbindung, Serverzeit, Ablauf, serverseitiger Seed,
Plausibilitätsgrenzen, atomare Buchung und idempotente Fingerprints. Ein Hash
eines clientseitigen Logs ist kein Echtheitsnachweis.

Eine spätere Härtung kann reproduzierbare Simulationen mit serverseitigem Seed,
versionierten Regeln und überprüfbaren Eingaben untersuchen. Das ist eine
separate Kosten-/Nutzenentscheidung und keine Voraussetzung, um den aktuellen
Vertrag korrekt zu dokumentieren.

Technische Abstürze und absichtliche Abbrüche sind clientseitig nicht sicher zu
unterscheiden. Deshalb gibt es keine automatische Erstattung allein wegen
fehlendem Finish; Ersatzanwendungen müssen als separate, auditierte
Betreibervergabe entstehen.
