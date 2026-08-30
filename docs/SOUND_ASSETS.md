# Sound-Assets und Audio-Lizenzen

**Stand:** 2026-08-30

Ein CC0-UI-Pilot ist integriert. Reliktfang, Combo, Level-Up, Run-Ende und
Weltwechsel bleiben bewusst prozedural, bis weitere konkrete Dateien separat
geprueft und auf iPhone/iPad abgehoert wurden.

## Lizenzregeln

- [OpenGameArt-Lizenz-FAQ](https://opengameart.org/node/5571): Die konkrete
  Datei und ihre Lizenz werden pro Asset geprueft.
- [Kenney Support](https://kenney.nl/support): Offizielle Kenney-Assetseiten
  sind Public Domain/CC0, Attribution ist nicht erforderlich.
- [Freesound FAQ](https://freesound.org/help/faq/): CC0 ist bevorzugt; CC-BY
  braucht Attribution, CC-BY-NC wird fuer isiHunt ausgeschlossen.

Kostenlos, royalty-free oder eine Pack-Seite ohne konkrete Dateilizenz reicht
nicht als Freigabe. Jeder Eintrag braucht URL, Autor, Lizenz, Download-Datum,
Format und SHA-256.

## Inventar

| Asset-ID   | Ereignis | Datei                                  | Quelle/Autor                                                         | Lizenz                                                | Attribution        | SHA-256                                                            | Status     |
| ---------- | -------- | -------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------- | ------------------ | ------------------------------------------------------------------ | ---------- |
| `ui.click` | UI-Klick | `public/assets/audio/cc0-ui-click.wav` | [OpenGameArt: Click](https://opengameart.org/content/click), qubodup | [CC0](https://creativecommons.org/public-domain/cc0/) | keine erforderlich | `9E8DBBD40836EAA3F8305403E869FBEE0752E85FCB86B3A536FB03844F40912E` | integriert |

Download: 2026-08-22. Der Hash der gelieferten Datei ist im Repository als
Pruefanker dokumentiert; eine ersetzte Datei bekommt einen neuen Eintrag.

## Austauscharchitektur

```text
GameEvent / UI-Aktion
        |
SoundSystem (Settings, Feedback-Gate, iOS-Unlock)
        |
SoundModuleChain
   |                 |
SampledSoundModule  prozeduraler Fallback in SoundSystem
```

`src/audio/SoundModule.ts` definiert die logischen Ereignisse und den Provider-
Vertrag. `src/audio/SampledSoundModule.ts` laedt das Sample erst nach einem
laufenden AudioContext. Solange es fehlt oder noch dekodiert wird, liefert der
Provider `false`; der bestehende WebAudio-Pfad spielt sofort den Fallback.

Weitere Module koennen mit `registerSoundModule()` registriert und mit einer
Prioritaet vor den Sample-Provider gesetzt werden. Scenes importieren keine
Dateipfade. TON-, HAPTIK-, Reduced-Motion- und iOS-Unlock-Regeln bleiben im
`SoundSystem`.

## Abnahme

- fehlendes/gesperrtes Sample bricht keinen Run;
- doppeltes `initialize()` registriert keine doppelten Listener;
- `shutdown()` beendet Provider und EventBus-Listener;
- `npm run verify` bleibt gruen;
- weitere Packs werden erst nach Bundle-, Ladezeit- und Geraetepruefung
  hinzugefuegt.
