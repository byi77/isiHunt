# Sound-Assets und Audio-Lizenzen

**Stand:** 2026-08-22 · Im Repository sind aktuell noch keine externen
Sounddateien integriert.

Dieses Dokument ist das Lizenzinventar für die geplante Audio-Erweiterung aus
`TODO.md`/P5-12. Ein Sound darf erst in `public/audio/` landen, wenn der
konkrete Download hier eingetragen und geprüft ist. „Kostenlos“, „royalty
free“ oder eine Pack-Seite ohne Datei-Lizenz gelten nicht als Nachweis.

## Zulässige Recherchequellen

- [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio) und weitere offizielle
  Kenney-Assetseiten: CC0. [Kenney bestätigt in seinem Support-Artikel](https://kenney.nl/support),
  dass die Assets auf den Assetseiten Public Domain/CC0 sind und keine
  Attribution verlangen.
- [Freesound FAQ](https://freesound.org/help/faq/): nur einzelne Dateien mit
  explizitem CC0- oder CC-BY-Hinweis verwenden. CC-BY braucht Attribution;
  CC-BY-NC wird für isiHunt ausgeschlossen. Der Nutzer, Autor und die
  Lizenzseite werden pro Datei gespeichert.
- [OpenGameArt-Lizenz-FAQ](https://opengameart.org/node/5571): die Lizenz wird
  pro Asset geprüft. Für den ersten Pilot werden ausschließlich klar als CC0
  markierte Dateien akzeptiert; andere Lizenzen benötigen eine eigene
  Freigabe- und Attribution-Entscheidung.

Die Quellen sind Recherchequellen, keine pauschale Freigabe für jeden Upload.
Bei widersprüchlichen Angaben wird die Datei nicht verwendet.

## Inventar

| Asset-ID | Ereignis | Datei | Quelle/Autor | Lizenz | Attribution | Hash | Status |
| -------- | -------- | ---- | ------------ | ------- | ----------- | ---- | ------ |
| — | — | Noch kein externer Sound integriert | — | — | — | — | offen |

Beim Eintrag eines Sounds werden mindestens URL, Autor/Uploader, konkrete
Lizenz-URL, Download-Datum, Dateiformat, Hash und die geplante Verwendung
ergänzt. Bearbeitete Dateien erhalten zusätzlich den Hinweis, wie sie aus dem
Original entstanden sind.

## Zielarchitektur

Das Spiel verwendet logische Ereignisse, keine Dateipfade:

```text
GameEvent / UI-Aktion
        ↓
SoundSystem (öffentliche Fassade, Settings, Feedback-Gate)
        ↓
SoundModule-Vertrag
   ┌────┴──────────────────┐
   │                       │
ProceduralSoundModule   SampledSoundModule
   │                       │
WebAudio-Fallback       lizenzierte OGG/WAV-Dateien
```

`ProceduralSoundModule` bleibt immer verfügbar. Ein Asset-Ladefehler, ein
gesperrter AudioContext oder eine fehlende Datei darf nur auf den prozeduralen
Fallback wechseln und nie den Run blockieren. Scenes und Gameplay-Systeme
importieren keine konkreten Sounds.

Das geplante Manifest ordnet logische Ereignisse den Asset-IDs zu. Dadurch
kann ein komplettes Soundmodul über Konfiguration getauscht werden, ohne
`GameScene`, `ResultScene`, HUD oder Progression anzupassen. TON-, HAPTIK-,
Reduced-Motion- und iOS-Unlock-Regeln bleiben zentral im `SoundSystem`.

## Pilotumfang

Zuerst nur kurze Einzelklänge für Button, seltenen Reliktfang, Combo-Stufe,
Level-Up und Run-Ende. Keine Musikschleife und keine großen Audioarchive,
bevor Ladezeit, Bundlegröße und tatsächliche Wirkung auf iPhone/iPad geprüft
sind.
