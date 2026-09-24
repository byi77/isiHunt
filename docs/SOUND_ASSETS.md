# Sound-Assets und Audio-Lizenzen

**Stand:** 2026-09-24

Alle Klaenge sind vorgerenderte WAV-Dateien (22,05 kHz, mono, 16 Bit) unter
`public/assets/audio/`. Die Effekte sind im Projekt selbst synthetisiert, die
Countdown-Stimme stammt aus einem CC0-Datensatz. Es gibt keine Fremdlizenz mit
Auflagen. Warum Dateien statt Laufzeit-Synthese: ADR-0029.

## Lizenzregeln

- [OpenGameArt-Lizenz-FAQ](https://opengameart.org/node/5571): Die konkrete
  Datei und ihre Lizenz werden pro Asset geprueft.
- [Kenney Support](https://kenney.nl/support): Offizielle Kenney-Assetseiten
  sind Public Domain/CC0, Attribution ist nicht erforderlich.
- [Freesound FAQ](https://freesound.org/help/faq/): CC0 ist bevorzugt; CC-BY
  braucht Attribution, CC-BY-NC wird fuer isiHunt ausgeschlossen.

Kostenlos, royalty-free oder eine Pack-Seite ohne konkrete Dateilizenz reicht
nicht als Freigabe. Jeder Eintrag braucht Quelle, Lizenz, Datum und SHA-256.

## Quellen

**Effekte (`sfx-*.wav`)** - selbst synthetisiert mit `scripts/render-sfx.mjs`
(FM-Glocken, gefiltertes Rauschen, Pads, Hall). Keine Fremdquelle, keine
Lizenzfrage. Das Skript ist deterministisch: ein erneuter Lauf erzeugt
byte-gleiche Dateien (geprueft 2026-09-24). Aendern heisst: Skript aendern,
neu rendern, Hashes unten nachtragen.

**Stimme (`voice-*.wav`)** - [Piper](https://github.com/rhasspy/piper)
(Release 2023.11.14-2, Windows) mit dem Modell
`de_DE-thorsten_emotional-medium`, Sprecher `neutral` (Id 4),
`--length_scale 0.85`, ohne Nachbearbeitung ausser Zuschnitt. Die Stimme
beruht auf dem [Thorsten-Voice-Datensatz](https://www.openslr.org/110/),
Lizenz **CC0**, keine Attribution erforderlich. Erzeugt 2026-09-24:

```bash
node scripts/render-sfx.mjs --voice <ordner mit piper/piper.exe und dem .onnx-Modell>
```

Verworfene Stimmquellen und Gruende (Recherche 2026-09-24): ElevenLabs
kommerziell erst ab Starter-Tarif; Kokoro-82M ohne Deutsch; Pixabay-Lizenz
nicht CC0; Windows-SAPI-Stimmen hoerbar roboterhaft. Bleibt der Wunsch nach
mehr "Hype", ist ElevenLabs der naechste Kandidat - dann mit neuem Eintrag.

## Inventar

| Datei                       | Ereignis                            | SHA-256                                                            |
| --------------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| `sfx-ui-tap.wav`            | Knopf                               | `4A95E0C5B865A97CDBFDC9340A4DED37619A750FCF6959817CEC3898A7267A6F` |
| `sfx-ui-back.wav`           | Zurueck-Knopf                       | `7EB5D6A24E91823E55076F45A99EEB3D64B4AF46501B9C2A483D243A987FF779` |
| `sfx-toggle-on.wav`         | Umschalter an, Ton eingeschaltet    | `6C64E911ECDFE3B29BF5A90A477EEA2FEB0250492546AA839AC9031A4BD5F2B3` |
| `sfx-toggle-off.wav`        | Umschalter aus                      | `8D750F30100B52A16FF9F0B6A56BF30DBC9BD7F4273D5907C02EF2505D634D69` |
| `sfx-world-whoosh.wav`      | Weltwechsel (Rauschen)              | `4CAF57990BB110AE00004C5273B8084C73EB04DD21E84A0F1FD2C4575E7A8581` |
| `sfx-world-bell.wav`        | Weltwechsel (Glocke, je Welt hoch)  | `AE8C9BB84C4C2994FD7C68748B27249D13696A0FBECD82B80D64229E3F642BA4` |
| `sfx-collect-poor.wav`      | Fang grau                           | `B3887AA5226816372E433DA4B00E2AD0D7CB2DD4125F2F3812A3EE16210C6C73` |
| `sfx-collect-common.wav`    | Fang gewoehnlich                    | `BAF9EF83B29FB77AD1BFC7005745EF232703BFA236F0E6F3A6F33FFCFFA7782C` |
| `sfx-collect-uncommon.wav`  | Fang ungewoehnlich                  | `DC44B3297D1B1C04EA5520CEDD081D056D1BD9D4A9093D65E218F4B2EC7EE319` |
| `sfx-collect-rare.wav`      | Fang selten                         | `1690C2D66D54F6BD9166D51C0697EF68854B0A54C94BD7054830435AC41357C7` |
| `sfx-collect-epic.wav`      | Fang episch                         | `A1EF542A84ABFE0BA6D4BF501B14C68DC5126B21BD57D28098125938363BE15D` |
| `sfx-collect-legendary.wav` | Fang legendaer                      | `6E2BD5BCEA5E4067FBFA8FF357883417F47AFFC5826B5A4F026BF37D19A3CE53` |
| `sfx-combo-1.wav`           | Combo-Stufe 1                       | `739E71934816E792A3FC63D8390D7F29906AF0322C76368360A51B51C1CDF132` |
| `sfx-combo-2.wav`           | Combo-Stufe 2                       | `3E79017C3F84C697A824A9E3DAAEEF0BCCE6156FC68E1F51C156DBC7B0E3C7FE` |
| `sfx-combo-3.wav`           | Combo-Stufe 3                       | `B093E4F2C2226C479CE7393D67F4193286D9B4EF265CDECB45A911644DEA0BBC` |
| `sfx-combo-4.wav`           | Combo-Stufe 4                       | `1B34FB93A86FF549247C61BE8AB317C73AA8A9CCDC9ED1E2D19CC219CB0BBE7A` |
| `sfx-combo-5.wav`           | Combo-Stufe 5 und hoeher            | `B5B6742E070DB2C306EC46EF8F0F8A1021DDF92E947444491D28367D2C2BF1DD` |
| `sfx-obstacle-brake.wav`    | Hindernis Bremse                    | `8C821EAFBB3E3FFCD784A9240A0B2DDEC19395FD87E87BCBBBEA0A8EF36F51B1` |
| `sfx-obstacle-penalty.wav`  | Hindernis Strafe                    | `3FF9960D10C000ED84B57FE045F33DFB6C2BDD285D809295F3BBC29F93044ABF` |
| `sfx-run-end-levelup.wav`   | Run-Ende mit Levelaufstieg          | `60CC0DCEB5643F6D51B24311DA3D6E383918A8F47CD15465348BD053DDC62113` |
| `sfx-run-end.wav`           | Run-Ende ohne Levelaufstieg         | `8CE8F75D1F04CE43EC601FE19D20B8726FA9F76CC565633BDF21BF194C5006B4` |
| `sfx-missed.wav`            | Relikt verblasst (nur ab selten)    | `A8CDEFA04BFD2D5A47462959B0BBD7208580772584F2A150F4CBAC6A905995C0` |
| `sfx-pause.wav`             | Pause (nur per Knopf)               | `C75924F690106F515A9F9EC2F33543C0186D10657BF262D362FD3C3B3045A816` |
| `sfx-resume.wav`            | Weiter                              | `0C70D3AE73934F047811EA2EDF2C0D1A8FA3806ECDD3E80A8EF201AE3D776978` |
| `sfx-opponent-left.wav`     | Online-Gegner getrennt              | `53D75FD32148F66FC72D12B1CAF10D165F29BCDE58E0F7BCBA2F44A7A7CE7CCF` |
| `sfx-achievement.wav`       | Erfolg freigeschaltet (nach Run)    | `49DFF9CD0DF9C40C9BD56B9671D4D06C8ECA5FF3B73165FCB563447CABB5ADDB` |
| `voice-3.wav`               | Countdown "Drei!"                   | `083B1239CB6D14307B98335C5E808881A254E6A63CA05355849135C6649B91F8` |
| `voice-2.wav`               | Countdown "Zwei!"                   | `7015EFCC4ADB9CD18B46C87E3D3820FDB090A74150E778BA10CC3FD1C1163543` |
| `voice-1.wav`               | Countdown "Eins!"                   | `9CA2686B5DD46BDD34EA55BD5536D5177091F650040D4418FEFB72A8C795E1A4` |
| `voice-go.wav`              | Countdown "Los geht's!"             | `E1F6B6D2A4AC449D0401D8CB6855BB696BC68E4E923830F3AD0A0DD12D407FBE` |

Gesamtgroesse rund 1,07 MB; der Service Worker cached sie vorab mit.

Entfernt 2026-09-24: `cc0-ui-click.wav` (OpenGameArt "Click", qubodup, CC0,
SHA-256 `9E8DBBD4…912E`) - ersetzt durch `sfx-ui-tap.wav`.

## Architektur

```text
GameEvent / UI-Aktion
        |
SoundSystem (Settings, Feedback-Gate, Haptik, iOS-Unlock, Summenbus)
        |
SoundModuleChain
   |                     |
SampleBank           prozeduraler Fallback in SoundSystem
(config/audio.ts)    (fruehere Oszillator-Toene)
        |
Summenbus: Lautstaerke -> Kompressor -> Ausgang
```

`src/audio/SoundModule.ts` definiert die logischen Ereignisse und den Provider-
Vertrag. `src/audio/SampleBank.ts` bildet Ereignisse auf Dateien ab
(`resolveSamples`, reine Rechnung) und laedt alle Klaenge nach dem ersten
Entsperren vor. Solange eine Datei fehlt oder noch dekodiert, liefert die Bank
`false`; SoundSystem spielt dann den alten Oszillator-Ton. Countdown-Zahlen,
verpasste Relikte, Pause, Weiter, Gegner getrennt und Erfolge haben keinen
prozeduralen Ersatz und bleiben in dieser Zeit still.

Lautstaerke, Tonhoehen-Streuung und Verzoegerung je Klang stehen in
`src/config/audio.ts`. Scenes importieren keine Dateipfade.

## Abnahme

- fehlender oder gesperrter Klang bricht keinen Run (Fallback bzw. Stille);
- jede in `config/audio.ts` genannte Datei existiert (`SampleBank.test.ts`);
- doppeltes `initialize()` registriert keine doppelten Listener;
- `shutdown()` beendet Provider und EventBus-Listener;
- Lautstaerken und Wirkung der bass-lastigen Klaenge (Legendaer, Fanfare) auf
  dem Handy-Lautsprecher: **offen, Abhoeren auf dem Geraet steht aus**.
