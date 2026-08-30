// E2E-Test fuer DUELL2G ohne zwei echte Handys.
//
// Der Test oeffnet zwei voneinander isolierte Browser-Kontexte. Jeder Kontext
// hat damit eigenes localStorage, eigene Supabase-Client-Instanz und einen
// eigenen Realtime-WebSocket - genau die drei Dinge, die bei zwei Handys
// verschieden sind. Die Verbindung laeuft gegen das in `.env` konfigurierte
// Supabase, nicht gegen einen lokalen Fake.
//
// Die 90-Sekunden-Runde wird danach wie im bestehenden Playtest ueber direkte
// GameScene.update()-Aufrufe mit 60-Hz-Deltas simuliert. Die Spiel- und
// Kollisionslogik bleibt echt; nur Warten auf Wandzeit und Rendering werden
// aus dem kritischen Pfad genommen. Live-Broadcasts werden ueber den echten
// GameScene-Timer verschickt.

import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.DUEL2G_PORT ?? 5199);
const DEFAULT_URL = `http://127.0.0.1:${PORT}/`;
const SAVE_KEY = 'isihunt.save.v1';
const SCENE_TIMEOUT_MS = 30000;
const RUN_TIMEOUT_MS = 30000;
const RESULT_TIMEOUT_MS = 30000;
const MAX_ATTEMPTS = 3;
const MODULES = {
  challenge: '/src/systems/ChallengeSystem.ts',
  debug: '/src/systems/DebugSystem.ts',
  network: '/src/systems/NetworkDuelSystem.ts',
  save: '/src/systems/SaveSystem.ts',
};

const argv = process.argv.slice(2);
const watch = argv.includes('--watch');
const runsArg = argv.find((arg) => arg.startsWith('--runs='));
const runs = Math.max(1, Number(runsArg?.split('=')[1] ?? 1));
const positional = argv.filter((arg) => !arg.startsWith('--'));
const externalUrl = positional[0] && positional[0] !== '-' ? positional[0] : null;
const url = externalUrl ?? DEFAULT_URL;
const shotDir = resolve(positional[1] ?? 'playtest-shots/duel2g');

if (!Number.isFinite(runs)) throw new Error('--runs muss eine Zahl sein.');
mkdirSync(shotDir, { recursive: true });

function moduleUrl(path) {
  return new URL(path, url).href;
}

function makeSave(playerName) {
  return {
    version: 1,
    level: 30,
    xp: 0,
    talentPoints: 0,
    coins: 3000,
    talents: {},
    bestScore: 0,
    bestScoreRecordedAt: null,
    bestCombo: 0,
    totalScore: 0,
    totalRuns: 0,
    totalPlayTimeMs: 0,
    totalCoinsEarned: 0,
    coinsSpent: 0,
    lastLoginBonusKey: null,
    lastDailyKey: null,
    dailyBestScore: 0,
    totalDailyRuns: 0,
    pendingDailyKey: null,
    pendingDailyEventId: null,
    pendingDailyCoins: 0,
    pendingDailyScore: 0,
    collected: {},
    unlockedAchievements: [],
    lastWorldId: 'silberhain',
    ownedShipShapes: ['arrow'],
    ownedShipColors: ['world'],
    ownedShipAuras: ['none'],
    shipShape: 'arrow',
    shipColor: 'world',
    shipAura: 'none',
    newCosmeticIds: [],
    lastPurchasedCosmetic: null,
    soundEnabled: false,
    hapticsEnabled: false,
    playerName,
    cloudId: null,
  };
}

function shortError(error) {
  const line = String(error?.message ?? error)
    .split(/\r?\n/)[0]
    .trim();
  return line.length > 150 ? `${line.slice(0, 147)}...` : line;
}

async function waitForServer(targetUrl) {
  const deadline = Date.now() + SCENE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(targetUrl);
      if (response.ok) return;
    } catch {
      // Der Dev-Server braucht manchmal mehr als einen Versuch.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Dev-Server unter ${targetUrl} startete nicht.`);
}

async function waitForScene(page, key, timeout = SCENE_TIMEOUT_MS) {
  try {
    await page.waitForFunction((sceneKey) => window.isiHunt?.scene?.isActive(sceneKey), key, {
      timeout,
    });
  } catch (error) {
    const activeScenes = await page.evaluate(() =>
      window.isiHunt?.scene?.scenes
        ?.filter((scene) => scene.scene.isActive())
        .map((scene) => scene.scene.key),
    );
    throw new Error(
      `${shortError(error)} (erwartet: ${key}; aktiv: ${activeScenes?.join(', ') ?? 'unbekannt'})`,
    );
  }
}

async function waitForRunPhase(page, phase, timeout = RUN_TIMEOUT_MS) {
  await page.waitForFunction(
    (expected) => window.isiHunt?.scene?.getScene('Game')?.phase === expected,
    phase,
    { timeout },
  );
}

async function openPage(browser, playerName, device) {
  const context = await browser.newContext({ ...device });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

  await page.addInitScript(
    ({ key, save }) => {
      window.localStorage.setItem(key, JSON.stringify(save));
    },
    { key: SAVE_KEY, save: makeSave(playerName) },
  );
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.isiHunt?.scene), undefined, {
    timeout: SCENE_TIMEOUT_MS,
  });
  return { context, page, errors };
}

function collectInteractive(page, sceneKey) {
  return page.evaluate((key) => {
    const scene = window.isiHunt?.scene?.getScene(key);
    if (!scene) return [];

    const label = (object) => {
      let result = '';
      const walk = (node, depth) => {
        if (depth > 3 || result) return;
        for (const child of node.list ?? []) {
          if (child.type === 'Text' && child.text) {
            result = child.text.trim().slice(0, 32);
            return;
          }
          walk(child, depth + 1);
        }
      };
      walk(object, 0);
      return result || `(${object.type})`;
    };

    const result = [];
    const walk = (list, depth) => {
      if (depth > 5) return;
      for (const object of list ?? []) {
        if (object.input?.enabled && object.visible && object.input.hitArea) {
          let x = object.x ?? 0;
          let y = object.y ?? 0;
          let parent = object.parentContainer;
          while (parent) {
            x += parent.x;
            y += parent.y;
            parent = parent.parentContainer;
          }
          const hitArea = object.input.hitArea;
          result.push({
            label: label(object),
            x: Math.round(x),
            y: Math.round(y),
            width: Math.round(hitArea.width ?? 0),
            height: Math.round(hitArea.height ?? 0),
          });
        }
        if (object.list) walk(object.list, depth + 1);
      }
    };
    walk(scene.children.list, 0);
    return result;
  }, sceneKey);
}

async function clickGamePoint(page, x, y) {
  const point = await page.evaluate(
    ([gameX, gameY]) => {
      const game = window.isiHunt;
      const rect = game.canvas.getBoundingClientRect();
      return {
        x: rect.left + (gameX / game.scale.width) * rect.width,
        y: rect.top + (gameY / game.scale.height) * rect.height,
      };
    },
    [x, y],
  );
  // Phaser muss den Pointer zuerst ueber den Canvas bewegen. Ein sofortiger
  // mouse.click() kann auf emulierten Touch-Geraeten den pointerup-Zyklus
  // verschlucken, bevor das Button-Visual den Druckzustand verarbeitet.
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(100);
  await page.mouse.up();
}

async function clickButton(page, sceneKey, text) {
  const buttons = await collectInteractive(page, sceneKey);
  const button = buttons.find((entry) => entry.label.toUpperCase().includes(text));
  if (!button) {
    throw new Error(
      `${sceneKey}: Button "${text}" nicht gefunden (vorhanden: ${buttons.map((entry) => entry.label).join(', ')})`,
    );
  }
  await clickGamePoint(page, button.x, button.y);
}

async function enterDuel2G(page, playerName) {
  // Wenn MenuScene verfuegbar ist, wird der echte DUELL-Einstieg benutzt.
  // Bei einem konfigurierten Backend kann AuthSystem den Start zusaetzlich in
  // AccountScene fuehren; dann ist der direkte Aufruf derselbe Scene-Callback
  // und macht den Test unabhaengig von einem vorhandenen Login.
  await page.waitForFunction(
    () =>
      ['Menu', 'Account', 'DuelSelect', 'OnlineDuel'].some((key) =>
        window.isiHunt?.scene?.isActive(key),
      ),
    undefined,
    { timeout: SCENE_TIMEOUT_MS },
  );
  const startScreen = await page.evaluate(() => {
    const game = window.isiHunt;
    if (game.scene.isActive('OnlineDuel')) return 'OnlineDuel';
    if (game.scene.isActive('DuelSelect')) return 'DuelSelect';
    if (game.scene.isActive('Menu')) return 'Menu';
    if (game.scene.isActive('Account')) return 'Account';
    return null;
  });

  // Menu-Transitions koennen den ersten Pointerframe noch fuer die alte
  // Scene verarbeiten, obwohl der Scene-Key bereits aktiv ist.
  await page.waitForTimeout(250);

  if (startScreen === 'OnlineDuel') {
    await waitForScene(page, 'OnlineDuel');
  } else {
    const menuActive = startScreen === 'Menu';
    if (menuActive) {
      await clickButton(page, 'Menu', 'DUELL');
      await waitForScene(page, 'OnlineDuel');
    } else {
      await page.evaluate(() => {
        const game = window.isiHunt;
        const account = game.scene.getScene('Account');
        if (!account?.scene.isActive()) throw new Error('Kein stabiler Start-Screen aktiv.');
        account.scene.start('OnlineDuel');
      });
    }
    await waitForScene(page, 'OnlineDuel');
  }

  const duelButtons = await collectInteractive(page, 'OnlineDuel');
  if (!duelButtons.some((button) => button.label.toUpperCase().includes('VS BOT'))) {
    throw new Error('OnlineDuel: direkter VS-BOT-Button fehlt.');
  }
  if (
    duelButtons.some((button) => /RAUM|BEITRETEN|ONLINE-DUELL/.test(button.label.toUpperCase()))
  ) {
    throw new Error('OnlineDuel: alter Raumcode-/Zwischenbildschirm ist noch sichtbar.');
  }
  // Der normale Startscreen kann ein nicht angemeldetes lokales Profil
  // bewusst loeschen. Fuer den isolierten Test wird der Name danach ueber die
  // echte SaveSystem-API gesetzt, damit der Realtime-Test zwei Profile mit
  // unterschiedlichen Identitaeten simuliert.
  await page.evaluate(
    async ([urlToModule, name]) => {
      const save = await import(urlToModule);
      save.setOfflinePlayerName(name);
    },
    [moduleUrl(MODULES.save), playerName],
  );
}

async function readRoomCode(page) {
  await page.waitForFunction(
    () => window.isiHunt?.scene?.getScene('OnlineDuel')?.roomCode?.length === 6,
    undefined,
    { timeout: SCENE_TIMEOUT_MS },
  );
  return page.evaluate(() => window.isiHunt.scene.getScene('OnlineDuel').roomCode);
}

async function readChallengeState(page) {
  return page.evaluate(async (urlToModule) => {
    const challenge = await import(urlToModule);
    return challenge.getState();
  }, moduleUrl(MODULES.challenge));
}

async function readProtectedLogs(page) {
  return page.evaluate(async (urlToModule) => {
    const debug = await import(urlToModule);
    return debug.getProtectedLogBuffer();
  }, moduleUrl(MODULES.debug));
}

async function readRoomStatus(page, code) {
  return page.evaluate(
    async ([networkModule, roomCode, participantToken]) => {
      const network = await import(networkModule);
      return network.getRoomStatus(roomCode, participantToken);
    },
    [
      moduleUrl(MODULES.network),
      code,
      await page.evaluate(
        () => window.isiHunt?.scene?.getScene('OnlineDuel')?.participantToken ?? '',
      ),
    ],
  );
}

async function waitForComplete(page) {
  const deadline = Date.now() + RESULT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const state = await readChallengeState(page);
    if (state?.kind === 'duel-online' && state.rounds?.length === 2) return state;
    await page.waitForTimeout(250);
  }
  throw new Error('Ergebnisbildschirm wurde nicht vollstaendig.');
}

async function readClientSnapshot(page) {
  return page.evaluate(() => {
    const game = window.isiHunt;
    const online = game?.scene?.getScene('OnlineDuel');
    return {
      activeScenes: game?.scene?.scenes
        ?.filter((scene) => scene.scene.isActive())
        .map((scene) => scene.scene.key),
      roomCode: online?.roomCode ?? null,
      lobbyStatus: online?.statusText?.text ?? null,
      talentDraftStarted: online?.talentDraftStarted ?? false,
      talentDraftVisible: Boolean(online?.talentDraftView?.objects?.length),
      talentReadySubmitted: online?.talentReadySubmitted ?? false,
      gamePhase: game?.scene?.getScene('Game')?.phase ?? null,
    };
  });
}

async function simulateRun(page) {
  return page.evaluate(async () => {
    const game = window.isiHunt;
    const scene = game.scene.getScene('Game');
    if (!scene) throw new Error('GameScene fehlt.');
    if (scene.phase !== 'running') throw new Error(`GameScene ist ${scene.phase}, nicht running.`);
    const hud = game.scene.getScene('Hud');
    const opponentText = hud?.opponentLiveTexts ? [...hud.opponentLiveTexts.values()][0] : null;
    const hudLayout = {
      opponent: opponentText ? { x: opponentText.x, y: opponentText.y } : null,
      series: hud?.comboText
        ? { text: hud.comboText.text, x: hud.comboText.x, y: hud.comboText.y }
        : null,
      multiplier: hud?.multiplierText
        ? { text: hud.multiplierText.text, x: hud.multiplierText.x, y: hud.multiplierText.y }
        : null,
    };

    game.loop.sleep();

    const stepMs = 1000 / 60;
    const maxFrames = 60 * 120;
    let frames = 0;
    let firstLiveHud = null;
    let lastLiveHud = null;

    const readLiveHud = () => {
      const hud = game.scene.getScene('Hud');
      const text = hud?.opponentLiveTexts ? [...hud.opponentLiveTexts.values()][0] : null;
      if (!text || text.alpha <= 0 || !text.text) return null;
      return {
        text: text.text,
        alpha: text.alpha,
        opponentScore: hud.opponentScores ? ([...hud.opponentScores.values()][0] ?? null) : null,
        activity: hud.opponentActivities ? ([...hud.opponentActivities.values()][0] ?? null) : null,
      };
    };

    const captureLiveHud = () => {
      const current = readLiveHud();
      if (!current) return;
      lastLiveHud = current;
      if (!firstLiveHud && current.activity === 'playing') firstLiveHud = current;
    };

    try {
      while (scene.phase === 'running' && frames < maxFrames) {
        const collectibles = (scene.collectibles ?? []).filter(
          (collectible) => collectible?.active && !collectible.isCollected,
        );
        if (collectibles.length > 0 && scene.player) {
          let target = collectibles[0];
          let distance = Infinity;
          for (const collectible of collectibles) {
            const nextDistance =
              (collectible.x - scene.player.x) ** 2 + (collectible.y - scene.player.y) ** 2;
            if (nextDistance < distance) {
              distance = nextDistance;
              target = collectible;
            }
          }
          const pointer = scene.input.activePointer;
          pointer.isDown = true;
          pointer.worldX = target.x;
          pointer.worldY = target.y;
        }

        // Phaser aktualisiert die Scene-Uhren normalerweise im Game-Loop vor
        // update(). Der Loop ist fuer den schnellen Playtest schlafen gelegt;
        // hier wird deshalb genau diese Uhr weitergeschoben. Dadurch feuert
        // auch der echte GameScene-Live-Timer (400 ms) und nicht ein Testsender.
        scene.time.preUpdate();
        scene.time.update(scene.time.now + stepMs, stepMs);
        scene.update(frames * stepMs, stepMs);
        captureLiveHud();

        frames += 1;
        // Realtime-Callbacks und WebSocket-Auslieferung brauchen echte
        // Event-Loop-Gelegenheiten; ohne diese waere die Simulation zwar
        // korrekt, der Integrationstest wuerde aber nur den Sender testen.
        if (frames % 30 === 0) {
          await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
          captureLiveHud();
        }
      }

      if (scene.phase !== 'ended') {
        throw new Error(`Simulation erreichte nach ${frames} Frames kein Ende.`);
      }

      // Das letzte Broadcast-Paket kann nach dem Simulationsschritt noch in
      // der WebSocket-Warteschlange liegen. Die HUD-Szene bleibt bis zum
      // normalen 450-ms-Ausklang erhalten; diese kurze Schleife erlaubt dem
      // Empfaenger, den echten EventBus->HudScene-Weg zu verarbeiten.
      const liveDeadline = Date.now() + 1000;
      while (!firstLiveHud && Date.now() < liveDeadline) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
        captureLiveHud();
      }

      return {
        score: scene.scoring.currentScore,
        totalCollected: scene.scoring.totalCollected,
        frames,
        hudLayout,
        firstLiveHud,
        lastLiveHud,
      };
    } finally {
      game.loop.wake();
    }
  });
}

function assertCheck(label, condition, detail, failures) {
  if (condition) {
    console.log(`  OK   ${label}${detail ? ` - ${detail}` : ''}`);
  } else {
    const message = `${label}${detail ? ` - ${detail}` : ''}`;
    failures.push(message);
    console.log(`  FAIL ${message}`);
  }
}

function toComparableRound(round) {
  return {
    score: round.score,
    bestCombo: round.bestCombo,
    totalCollected: round.totalCollected,
  };
}

async function runOne(browser, runNumber, failures) {
  console.log(`\n=== DUELL2G-Lauf ${runNumber}/${runs} ===`);
  const host = await openPage(browser, `DuelHost${runNumber}`, { ...devices['iPhone 13'] });
  const guest = await openPage(browser, `DuelGuest${runNumber}`, { ...devices['Pixel 7'] });
  let stage = 'Initialisierung';

  try {
    stage = 'DUELL2G-Screen oeffnen';
    // Die beiden Browser bleiben isoliert; der Einstieg selbst wird jedoch
    // nacheinander aufgebaut, damit Vite/Phaser beim ersten Boot nicht zwei
    // Canvas-Transitions gleichzeitig verarbeitet.
    await enterDuel2G(host.page, `DuelHost${runNumber}`);
    await enterDuel2G(guest.page, `DuelGuest${runNumber}`);
    assertCheck('DUELL2G-Screen auf beiden Clients', true, 'iPhone + Pixel-Kontext', failures);

    stage = 'Raum erzeugen';
    await host.page.evaluate(() => window.isiHunt.scene.getScene('OnlineDuel').createRoom());
    const code = await readRoomCode(host.page);
    assertCheck('Raumcode erzeugt', /^[0-9A-HJKMNP-Z]{6}$/.test(code), code, failures);

    stage = 'Gast beitreten lassen';
    await guest.page.evaluate(
      (roomCode) => window.isiHunt.scene.getScene('OnlineDuel').joinRoom(roomCode),
      code,
    );
    stage = 'Lobby vollstaendig synchronisieren';
    await host.page.waitForFunction(
      () => window.isiHunt?.scene?.getScene('OnlineDuel')?.roomPlayerCount >= 2,
      undefined,
      { timeout: RUN_TIMEOUT_MS },
    );
    await guest.page.waitForFunction(
      () => window.isiHunt?.scene?.getScene('OnlineDuel')?.roomPlayerCount >= 2,
      undefined,
      { timeout: RUN_TIMEOUT_MS },
    );
    assertCheck('Lobby mit zwei Spielern', true, 'Host + Gast', failures);

    stage = 'Host startet Lobby';
    await clickButton(host.page, 'OnlineDuel', 'DUELL STARTEN');
    stage = 'Talentauswahl auf beiden Clients oeffnen';
    try {
      await Promise.all([
        host.page.waitForFunction(
          () => window.isiHunt?.scene?.getScene('OnlineDuel')?.talentDraftView?.objects?.length > 0,
          undefined,
          { timeout: RUN_TIMEOUT_MS },
        ),
        guest.page.waitForFunction(
          () => window.isiHunt?.scene?.getScene('OnlineDuel')?.talentDraftView?.objects?.length > 0,
          undefined,
          { timeout: RUN_TIMEOUT_MS },
        ),
      ]);
    } catch (error) {
      const [hostSnapshot, guestSnapshot] = await Promise.all([
        readClientSnapshot(host.page),
        readClientSnapshot(guest.page),
      ]);
      const [hostLogs, guestLogs] = await Promise.all([
        readProtectedLogs(host.page),
        readProtectedLogs(guest.page),
      ]);
      console.log(`  Diagnose Talentphase host=${JSON.stringify(hostSnapshot)}`);
      console.log(`  Diagnose Talentphase guest=${JSON.stringify(guestSnapshot)}`);
      console.log(`  Host-Debug=${JSON.stringify(hostLogs.slice(-12))}`);
      console.log(`  Guest-Debug=${JSON.stringify(guestLogs.slice(-12))}`);
      throw error;
    }
    console.log('  OK   Talentauswahl auf beiden Clients sichtbar');
    stage = 'Talent-Build bestaetigen';
    await Promise.all([
      clickButton(host.page, 'OnlineDuel', 'TALENT-BUILD'),
      clickButton(guest.page, 'OnlineDuel', 'TALENT-BUILD'),
    ]);
    stage = 'Beide Clients in GameScene bringen';
    try {
      await Promise.all([
        waitForScene(host.page, 'Game', RUN_TIMEOUT_MS),
        waitForScene(guest.page, 'Game', RUN_TIMEOUT_MS),
      ]);
    } catch (error) {
      const [hostSnapshot, guestSnapshot] = await Promise.all([
        readClientSnapshot(host.page),
        readClientSnapshot(guest.page),
      ]);
      const [hostLogs, guestLogs] = await Promise.all([
        readProtectedLogs(host.page),
        readProtectedLogs(guest.page),
      ]);
      console.log(`  Diagnose host=${JSON.stringify(hostSnapshot)}`);
      console.log(`  Diagnose guest=${JSON.stringify(guestSnapshot)}`);
      console.log(`  Host-Debug=${JSON.stringify(hostLogs)}`);
      console.log(`  Guest-Debug=${JSON.stringify(guestLogs)}`);
      console.log(`  Host-Console=${JSON.stringify(host.errors)}`);
      console.log(`  Guest-Console=${JSON.stringify(guest.errors)}`);
      throw new Error(
        `${shortError(error)} | host=${JSON.stringify(hostSnapshot)} guest=${JSON.stringify(guestSnapshot)}`,
      );
    }
    stage = 'Beide Runs starten';
    await Promise.all([
      waitForRunPhase(host.page, 'running'),
      waitForRunPhase(guest.page, 'running'),
    ]);

    stage = 'Seed und Spielerposition pruefen';
    const [hostBefore, guestBefore] = await Promise.all([
      readChallengeState(host.page),
      readChallengeState(guest.page),
    ]);
    assertCheck(
      'Gleicher Seed auf beiden Clients',
      hostBefore?.seed === guestBefore?.seed,
      `${hostBefore?.seed} / ${guestBefore?.seed}`,
      failures,
    );
    assertCheck(
      'Spielerpositionen sind verschieden',
      hostBefore?.online?.localPlayerIndex === 0 && guestBefore?.online?.localPlayerIndex === 1,
      `host=${hostBefore?.online?.localPlayerIndex}, guest=${guestBefore?.online?.localPlayerIndex}`,
      failures,
    );
    await Promise.all([
      host.page.waitForFunction(
        async ([moduleUrl, expected]) => {
          const challenge = await import(moduleUrl);
          const names = challenge.getState()?.online?.playerNames;
          return names?.[0] === expected.host && names?.[1] === expected.guest;
        },
        [
          moduleUrl(MODULES.challenge),
          { host: `DuelHost${runNumber}`, guest: `DuelGuest${runNumber}` },
        ],
        { timeout: RUN_TIMEOUT_MS },
      ),
      guest.page.waitForFunction(
        async ([moduleUrl, expected]) => {
          const challenge = await import(moduleUrl);
          const names = challenge.getState()?.online?.playerNames;
          return names?.[0] === expected.host && names?.[1] === expected.guest;
        },
        [
          moduleUrl(MODULES.challenge),
          { host: `DuelHost${runNumber}`, guest: `DuelGuest${runNumber}` },
        ],
        { timeout: RUN_TIMEOUT_MS },
      ),
    ]);
    const [hostNamedState, guestNamedState] = await Promise.all([
      readChallengeState(host.page),
      readChallengeState(guest.page),
    ]);
    const hostNames = hostNamedState?.online?.playerNames;
    const guestNames = guestNamedState?.online?.playerNames;
    assertCheck(
      'Spielernamen werden korrekt synchronisiert',
      hostNames?.[0] === `DuelHost${runNumber}` &&
        hostNames?.[1] === `DuelGuest${runNumber}` &&
        guestNames?.[0] === `DuelHost${runNumber}` &&
        guestNames?.[1] === `DuelGuest${runNumber}`,
      `host=${JSON.stringify(hostNames)}, guest=${JSON.stringify(guestNames)}`,
      failures,
    );

    stage = 'Beide GameScenes simulieren';
    const [hostRun, guestRun] = await Promise.all([
      simulateRun(host.page),
      simulateRun(guest.page),
    ]);
    assertCheck(
      'Beide GameScenes enden mit Punkten',
      hostRun.score > 0 && guestRun.score > 0,
      `host=${hostRun.score}, guest=${guestRun.score}`,
      failures,
    );
    const hudLayoutWorks = (run) =>
      run.hudLayout?.opponent?.x < 300 &&
      run.hudLayout?.series?.x > 500 &&
      run.hudLayout?.multiplier?.x > 500 &&
      run.hudLayout?.series?.text.startsWith('SERIE ') &&
      run.hudLayout?.multiplier?.text.length > 1;
    assertCheck(
      'Serie und Multiplikator liegen groesser rechts oben',
      hudLayoutWorks(hostRun) && hudLayoutWorks(guestRun),
      `host=${JSON.stringify(hostRun.hudLayout)}, guest=${JSON.stringify(guestRun.hudLayout)}`,
      failures,
    );
    const liveHudWorks = (run, expectedOpponent) =>
      run.firstLiveHud?.activity === 'playing' &&
      run.firstLiveHud.alpha > 0 &&
      run.firstLiveHud.text.startsWith(`${expectedOpponent} `) &&
      Number.isFinite(run.firstLiveHud.opponentScore);
    assertCheck(
      'Live-Gegnerpunkte im HUD sichtbar',
      liveHudWorks(hostRun, `DuelGuest${runNumber}`) &&
        liveHudWorks(guestRun, `DuelHost${runNumber}`),
      `host=${JSON.stringify(hostRun.firstLiveHud)}, guest=${JSON.stringify(guestRun.firstLiveHud)}`,
      failures,
    );
    const liveHudUpdates = (run, expectedOpponent) =>
      liveHudWorks(run, expectedOpponent) &&
      run.lastLiveHud?.opponentScore > 0 &&
      run.lastLiveHud.opponentScore >= run.firstLiveHud.opponentScore;
    assertCheck(
      'Live-Gegnerpunkte aktualisieren sich',
      liveHudUpdates(hostRun, `DuelGuest${runNumber}`) &&
        liveHudUpdates(guestRun, `DuelHost${runNumber}`),
      `host=${JSON.stringify(hostRun.lastLiveHud)}, guest=${JSON.stringify(guestRun.lastLiveHud)}`,
      failures,
    );
    assertCheck(
      'Kein falscher Verbindungsverlust nach Gegner-Ende',
      hostRun.lastLiveHud?.activity !== 'gone' && guestRun.lastLiveHud?.activity !== 'gone',
      `host=${JSON.stringify(hostRun.lastLiveHud)}, guest=${JSON.stringify(guestRun.lastLiveHud)}`,
      failures,
    );

    stage = 'Beide Ergebnisbildschirme abwarten';
    const [hostState, guestState] = await Promise.all([
      waitForComplete(host.page),
      waitForComplete(guest.page),
    ]);
    assertCheck(
      'Beide Ergebnisbildschirme vervollstaendigen sich',
      hostState.rounds.length === 2 && guestState.rounds.length === 2,
      `host=${hostState.rounds.length}, guest=${guestState.rounds.length}`,
      failures,
    );
    assertCheck(
      'Ergebnisreihenfolge bleibt Spieler 1/2',
      hostState.rounds[0]?.score === hostRun.score &&
        guestState.rounds[1]?.score === guestRun.score,
      `R1=${hostState.rounds[0]?.score}, R2=${guestState.rounds[1]?.score}`,
      failures,
    );
    assertCheck(
      'Beide Clients sehen dieselben beiden Ergebnisse',
      JSON.stringify(hostState.rounds.map(toComparableRound)) ===
        JSON.stringify(guestState.rounds.map(toComparableRound)),
      JSON.stringify(hostState.rounds),
      failures,
    );

    stage = 'Realtime-Diagnose lesen';
    const [hostLogs, guestLogs] = await Promise.all([
      readProtectedLogs(host.page),
      readProtectedLogs(guest.page),
    ]);
    const hasLog = (logs, label) => logs.some((entry) => entry.label === label);
    assertCheck(
      'Realtime-Kanal auf beiden Clients abonniert',
      hasLog(hostLogs, 'duel:kanalstatus') && hasLog(guestLogs, 'duel:kanalstatus'),
      'duel:kanalstatus vorhanden',
      failures,
    );
    assertCheck(
      'Presence auf beiden Clients getrackt',
      hasLog(hostLogs, 'duel:presence-track') && hasLog(guestLogs, 'duel:presence-track'),
      'duel:presence-track vorhanden',
      failures,
    );
    assertCheck(
      'Live-Stand des Gegners empfangen',
      hasLog(hostLogs, 'duel:live-empfangen') && hasLog(guestLogs, 'duel:live-empfangen'),
      'duel:live-empfangen vorhanden',
      failures,
    );
    assertCheck(
      'Kein falscher Presence-Abbruch beim Scene-Wechsel',
      !hasLog(hostLogs, 'duel:presence-weg') && !hasLog(guestLogs, 'duel:presence-weg'),
      'duel:presence-weg fehlt',
      failures,
    );

    stage = 'Persistentes Ergebnis pruefen';
    const roomStatus = await readRoomStatus(host.page, code);
    const persisted =
      roomStatus.ok && roomStatus.value?.hostResult && roomStatus.value?.guestResult;
    assertCheck(
      'Rundenergebnisse liegen persistent im Raum',
      Boolean(persisted) &&
        roomStatus.value.hostResult.score === hostRun.score &&
        roomStatus.value.guestResult.score === guestRun.score,
      persisted ? JSON.stringify(roomStatus.value) : JSON.stringify(roomStatus),
      failures,
    );
    assertCheck(
      'Keine Browser-/Runtime-Fehler',
      host.errors.length === 0 && guest.errors.length === 0,
      `host=${JSON.stringify(host.errors)}, guest=${JSON.stringify(guest.errors)}`,
      failures,
    );

    await Promise.all([
      host.page.screenshot({ path: resolve(shotDir, `run-${runNumber}-host-result.png`) }),
      guest.page.screenshot({ path: resolve(shotDir, `run-${runNumber}-guest-result.png`) }),
    ]);
  } catch (error) {
    throw new Error(`${stage}: ${shortError(error)}`);
  } finally {
    await Promise.all([host.context.close(), guest.context.close()]);
  }
}

async function runWithRetry(browser, runNumber, failures) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const attemptFailures = [];
    try {
      await runOne(browser, runNumber, attemptFailures);
      if (attemptFailures.length === 0) return;
      throw new Error(attemptFailures.join(' | '));
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS) break;
      console.log(
        `  Wiederholung ${attempt + 1}/${MAX_ATTEMPTS} nach fehlgeschlagenem Versuch: ${shortError(error)}`,
      );
    }
  }

  failures.push(`Lauf ${runNumber}: ${shortError(lastError)}`);
  console.log(`  FAIL Lauf ${runNumber}: ${shortError(lastError)}`);
}

let server = null;
let browser = null;
const failures = [];

try {
  if (!externalUrl) {
    server = spawn(
      process.execPath,
      [
        resolve('node_modules', 'vite', 'bin', 'vite.js'),
        '--host',
        '127.0.0.1',
        '--port',
        String(PORT),
        '--strictPort',
      ],
      { stdio: 'ignore' },
    );
    await waitForServer(url);
  }

  browser = await chromium.launch({ headless: !watch, slowMo: watch ? 50 : 0 });
  console.log(`DUELL2G-Test: ${runs} Lauf/Läufe gegen ${url}`);
  console.log('Zwei isolierte Browser-Kontexte, echte Supabase-RPCs und Realtime.');

  for (let runNumber = 1; runNumber <= runs; runNumber += 1) {
    await runWithRetry(browser, runNumber, failures);
  }
} finally {
  await browser?.close();
  server?.kill();
}

console.log(`\nScreenshots: ${shotDir}`);
if (failures.length > 0) {
  console.log('\nFehlgeschlagen:');
  for (const failure of failures) console.log(` - ${failure}`);
  process.exitCode = 1;
} else {
  console.log('\nDUELL2G-Test gruen.');
}
