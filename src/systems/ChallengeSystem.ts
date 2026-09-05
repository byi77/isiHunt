/**
 * Zustand eines laufenden Duells.
 *
 * Reine Logik ohne Phaser und ohne Duell-Persistenz. Ein Duell lebt nur,
 * solange die Seite offen ist - bewusst: Spielerduelle sind ein gemeinsamer
 * Vergleich am Geraet. Nur der einmalige Bot-Siegbonus wird in den
 * Spielstand geschrieben (Begruendung in config/challenge.ts).
 *
 * Warum ein Modul-Singleton und kein Scene-Feld: Das Duell ueberspannt vier
 * Scene-Wechsel (Einfuehrung -> Runde 1 -> Uebergabe -> Runde 2 -> Ergebnis).
 * Scene-Zustand ueberlebt `scene.start()` nicht, dieser Zustand muss das aber.
 */

import {
  CHALLENGE_BOT_DEFAULT_DIFFICULTY,
  CHALLENGE_BOT_DIFFICULTY_RATIOS,
  CHALLENGE_BOT_NOISE_MODULO,
  CHALLENGE_BOT_NOISE_OFFSET,
  CHALLENGE_BOT_NOISE_SCALE,
  CHALLENGE_DEFAULT_PLAYER_COUNT,
  CHALLENGE_MAX_PLAYER_COUNT,
  CHALLENGE_MIN_PLAYER_COUNT,
  CHALLENGE_PLAYER_COUNT,
  DUEL_TALENT_POINT_BUDGET,
} from '@/config/challenge';
import {
  BOT_VICTORY_BONUS_COINS,
  BOT_VICTORY_BONUS_XP,
  DAILY_COMPLETION_BONUS_COINS,
  DAILY_COMPLETION_BONUS_XP,
  DAILY_SCORE_BONUS_COINS,
  DAILY_SCORE_BONUS_MAX_TIERS,
  DAILY_SCORE_BONUS_STEP,
  DAILY_SCORE_BONUS_XP,
} from '@/config/GameConfig';
import { DAILY_KEY_TOLERANCE_MS } from '@/config/backend';
import { sanitizePlayerName } from '@/config/playerName';
import type { TalentRanks } from '@/config/talents';
import * as ProgressionSystem from '@/systems/ProgressionSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import { changeTalentRank, normalizeTalentRanks } from '@/systems/TalentAllocationSystem';
import type {
  BotDifficulty,
  ChallengeKind,
  ChallengeRound,
  ChallengeState,
  OnlineDuelInfo,
  RunStats,
} from '@/types';

let state: ChallengeState | null = null;

type OnlinePlayerNames = (string | null)[];
export type DuelTalentDrafts = TalentRanks[];

function normalizePlayerCount(value: number | undefined): number {
  const requested = Number.isFinite(value) ? Math.floor(value!) : CHALLENGE_DEFAULT_PLAYER_COUNT;
  return Math.min(CHALLENGE_MAX_PLAYER_COUNT, Math.max(CHALLENGE_MIN_PLAYER_COUNT, requested));
}

function normalizeOnlinePlayerIndex(value: number): number {
  return Number.isInteger(value) && value >= 0 && value < CHALLENGE_MAX_PLAYER_COUNT ? value : 0;
}

function copyDuelTalentDrafts(
  drafts?: DuelTalentDrafts,
  playerCount = CHALLENGE_DEFAULT_PLAYER_COUNT,
): DuelTalentDrafts {
  const count = normalizePlayerCount(playerCount);
  return Array.from({ length: count }, (_, index) =>
    normalizeTalentRanks(drafts?.[index] ?? {}, DUEL_TALENT_POINT_BUDGET),
  );
}

function cleanOnlinePlayerName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const clean = sanitizePlayerName(raw);
  return clean || null;
}

/**
 * Erzeugt einen Seed fuer die Relikt-Abfolge.
 *
 * Zeitanteil sorgt fuer Eindeutigkeit ueber Sitzungen, Zufallsanteil dafuer,
 * dass zwei schnell hintereinander gestartete Duelle nicht dieselbe Jagd
 * bekommen. Kryptografische Guete ist nicht noetig - der Seed ist kein
 * Geheimnis, sondern nur eine gemeinsame Ausgangslage.
 */
function createSeed(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Formatiert ein lokales Kalenderdatum als stabilen Tageslauf-Schlüssel. */
export function dailyKeyForDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function dailyKeyForToday(date = new Date()): string {
  return dailyKeyForDate(date);
}

/**
 * Spiegelt das serverseitige Fenster aus `phase_2_13_daily_key_window.sql`.
 *
 * Der Schlüssel selbst bleibt lokale Gerätezeit, damit der angezeigte
 * Tageslauf zum Kalender des Spielers passt. Der Server verwendet UTC und
 * akzeptiert den Vortag, heute und den Folgetag. Diese Client-Prüfung erspart
 * nur aussichtslose RPC-Aufrufe für alte Offline-Einträge; der Server bleibt
 * die verbindliche Instanz.
 */
export function isDailyKeyWithinClientWindow(dailyKey: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dailyKey)) return false;

  const parsed = Date.parse(`${dailyKey}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return false;

  const parsedDate = new Date(parsed);
  const canonical = `${parsedDate.getUTCFullYear()}-${String(parsedDate.getUTCMonth() + 1).padStart(2, '0')}-${String(parsedDate.getUTCDate()).padStart(2, '0')}`;
  if (canonical !== dailyKey) return false;

  const today = Date.parse(`${dailyKeyForToday(now)}T00:00:00Z`);
  return Math.abs(today - parsed) <= DAILY_KEY_TOLERANCE_MS;
}

function dailySeed(worldId: string, key: string): string {
  return `daily-${key}-${worldId}`;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function botRound(
  player: RunStats,
  seed: string,
  difficulty: BotDifficulty,
): ChallengeState['rounds'][number] {
  const noise =
    ((hashSeed(`${seed}-${difficulty}`) % CHALLENGE_BOT_NOISE_MODULO) -
      CHALLENGE_BOT_NOISE_OFFSET) /
    CHALLENGE_BOT_NOISE_SCALE;
  const factor = CHALLENGE_BOT_DIFFICULTY_RATIOS[difficulty] + noise;
  return {
    score: Math.max(0, Math.round(player.score * factor)),
    bestCombo: Math.max(0, Math.round(player.bestCombo * factor)),
    totalCollected: Math.max(0, Math.round(player.totalCollected * factor)),
  };
}

/** Startet ein neues Duell in der angegebenen Welt. */
export function start(
  worldId: string,
  suggestedDraftsOrPlayerCount?: DuelTalentDrafts | number,
  playerCount = CHALLENGE_DEFAULT_PLAYER_COUNT,
): ChallengeState {
  const suggestedDrafts =
    typeof suggestedDraftsOrPlayerCount === 'number' ? undefined : suggestedDraftsOrPlayerCount;
  const requestedPlayerCount =
    typeof suggestedDraftsOrPlayerCount === 'number' ? suggestedDraftsOrPlayerCount : playerCount;
  const normalizedPlayerCount = normalizePlayerCount(requestedPlayerCount);
  state = {
    seed: createSeed(),
    worldId,
    rounds: [],
    kind: 'duel',
    playerCount: normalizedPlayerCount,
    duelTalentDrafts: copyDuelTalentDrafts(suggestedDrafts, normalizedPlayerCount),
  };
  return state;
}

export function startDaily(worldId: string): ChallengeState {
  const key = dailyKeyForToday();
  state = {
    seed: dailySeed(worldId, key),
    worldId,
    rounds: [],
    kind: 'daily',
    dailyKey: key,
    dailyCompleted: SaveSystem.load().lastDailyKey === key,
  };
  return state;
}

export interface DailyReward {
  coins: number;
  xp: number;
  performanceTier: number;
}

export function completeDaily(stats: RunStats, eventId: string | null = null): DailyReward | null {
  if (!state || state.kind !== 'daily' || !state.dailyKey) return null;
  const key = state.dailyKey;
  if (SaveSystem.load().lastDailyKey === key) {
    state.dailyCompleted = true;
    return null;
  }

  const performanceTier = Math.min(
    DAILY_SCORE_BONUS_MAX_TIERS,
    Math.floor(Math.max(0, stats.score) / DAILY_SCORE_BONUS_STEP),
  );
  const reward: DailyReward = {
    coins: DAILY_COMPLETION_BONUS_COINS + performanceTier * DAILY_SCORE_BONUS_COINS,
    xp: DAILY_COMPLETION_BONUS_XP + performanceTier * DAILY_SCORE_BONUS_XP,
    performanceTier,
  };
  const progression = ProgressionSystem.applyDailyBonus(reward.coins, reward.xp);
  SaveSystem.update((data) => {
    data.lastDailyKey = key;
    data.dailyBestScore = Math.max(data.dailyBestScore, stats.score);
    data.totalDailyRuns += 1;
    // Ohne angemeldetes Profil gibt es kein Cloud-Ereignis, an das der
    // serverseitige Bonus sicher gebunden werden kann. Der lokale Spielstand
    // enthaelt die Belohnung bereits; eine Cloud-Nachholung wird erst fuer
    // eingeloggte Runs mit Event-ID vorgemerkt.
    data.pendingDailyKey = eventId ? key : null;
    data.pendingDailyEventId = eventId;
    data.pendingDailyCoins = eventId ? progression.coinsGained : 0;
    data.pendingDailyScore = eventId ? stats.score : 0;
  });
  state.dailyCompleted = true;
  state.dailyRewardCoins = progression.coinsGained;
  state.dailyRewardXp = reward.xp;
  state.dailyPerformanceTier = reward.performanceTier;
  return reward;
}

export function startBot(
  worldId: string,
  difficulty: BotDifficulty = CHALLENGE_BOT_DEFAULT_DIFFICULTY,
  suggestedDrafts?: DuelTalentDrafts,
  botMatchId?: string,
): ChallengeState {
  state = {
    seed: createSeed(),
    worldId,
    rounds: [],
    kind: 'bot',
    botDifficulty: difficulty,
    botMatchId,
    playerCount: CHALLENGE_DEFAULT_PLAYER_COUNT,
    duelTalentDrafts: copyDuelTalentDrafts(suggestedDrafts, CHALLENGE_DEFAULT_PLAYER_COUNT),
  };
  return state;
}

/**
 * Startet ein Netzwerk-Duell mit bereits bekanntem Seed und Raum-Code.
 *
 * Anders als `start()`/`startBot()` erzeugt diese Funktion keinen eigenen
 * Seed - der kommt vom Raum (Gastgeber erzeugt ihn serverseitig, Gast erhaelt
 * ihn beim Beitritt per RPC), damit beide Geraete garantiert dieselbe
 * Relikt-Abfolge sehen.
 */
export function startOnline(
  worldId: string,
  seed: string,
  roomCode: string,
  localPlayerIndex: number,
  participantToken = '',
  suggestedDrafts?: DuelTalentDrafts,
  playerCount = CHALLENGE_DEFAULT_PLAYER_COUNT,
): ChallengeState {
  const normalizedPlayerIndex = normalizeOnlinePlayerIndex(localPlayerIndex);
  const normalizedPlayerCount = normalizePlayerCount(playerCount);
  const playerNames: OnlinePlayerNames = Array.from(
    { length: CHALLENGE_MAX_PLAYER_COUNT },
    () => null,
  );
  playerNames[normalizedPlayerIndex] = cleanOnlinePlayerName(SaveSystem.load().playerName);

  const online: OnlineDuelInfo = {
    roomCode,
    participantToken,
    localPlayerIndex: normalizedPlayerIndex,
    playerNames,
    clockOffsetMs: 0,
    startAtServerMs: null,
  };
  state = {
    seed,
    worldId,
    rounds: [],
    kind: 'duel-online',
    online,
    duelMatchNumber: 1,
    playerCount: normalizedPlayerCount,
    duelTalentDrafts: copyDuelTalentDrafts(suggestedDrafts, normalizedPlayerCount),
    onlineRounds: Array.from({ length: normalizedPlayerCount }, () => null),
  };
  return state;
}

/** Liefert den temporaeren Build eines Spielers als defensive Kopie. */
export function duelTalentDraftFor(index: number): TalentRanks {
  const draft = state?.duelTalentDrafts?.[index];
  return normalizeTalentRanks(draft ?? {}, DUEL_TALENT_POINT_BUDGET);
}

/** Speichert einen temporaeren Build, ohne den persistenten Spielstand anzufassen. */
export function setDuelTalentDraft(index: number, ranks: TalentRanks): TalentRanks {
  if (!state) return normalizeTalentRanks(ranks, DUEL_TALENT_POINT_BUDGET);
  const drafts = copyDuelTalentDrafts(
    state.duelTalentDrafts,
    state.playerCount ??
      (state.kind === 'duel-online' ? CHALLENGE_PLAYER_COUNT : CHALLENGE_DEFAULT_PLAYER_COUNT),
  );
  if (index < 0 || index >= drafts.length)
    return normalizeTalentRanks(ranks, DUEL_TALENT_POINT_BUDGET);
  drafts[index] = normalizeTalentRanks(ranks, DUEL_TALENT_POINT_BUDGET);
  state.duelTalentDrafts = drafts;
  return { ...drafts[index] };
}

/** Aendert einen Rang im aktuellen temporaeren Build. */
export function changeDuelTalentRank(
  index: number,
  talentId: Parameters<typeof changeTalentRank>[1],
  delta: -1 | 1,
  budget: number,
): TalentRanks | null {
  const next = changeTalentRank(duelTalentDraftFor(index), talentId, delta, budget);
  if (!next) return null;
  return setDuelTalentDraft(index, next);
}

/** Aktualisiert den Online-Zustand nach einem serverseitig gestarteten Rematch. */
export function resetOnlineMatch(
  seed: string,
  matchNumber: number,
  suggestedDrafts?: DuelTalentDrafts,
): ChallengeState | null {
  if (!state || state.kind !== 'duel-online') return null;
  const currentState = state;
  currentState.seed = seed;
  currentState.rounds = [];
  currentState.onlineRounds = Array.from(
    { length: currentState.playerCount ?? CHALLENGE_DEFAULT_PLAYER_COUNT },
    (_, index) => currentState.onlineRounds?.[index] ?? null,
  );
  currentState.duelMatchNumber = matchNumber;
  currentState.duelTalentDrafts = copyDuelTalentDrafts(
    suggestedDrafts ?? currentState.duelTalentDrafts,
    currentState.playerCount ?? CHALLENGE_DEFAULT_PLAYER_COUNT,
  );
  currentState.online = currentState.online
    ? { ...currentState.online, startAtServerMs: null }
    : currentState.online;
  return currentState;
}

/** Aktualisiert Uhr-Offset/Startzeit eines laufenden Netzwerk-Duells. */
export function updateOnlineSync(clockOffsetMs: number, startAtServerMs: number | null): void {
  if (!state?.online) return;
  state.online = { ...state.online, clockOffsetMs, startAtServerMs };
}

/** Aktualisiert die tatsaechliche Anzahl beigetretener Online-Spieler. */
export function updateOnlinePlayerCount(count: number): void {
  if (!state?.online) return;
  const currentState = state;
  const normalized = normalizePlayerCount(count);
  currentState.playerCount = normalized;
  currentState.duelTalentDrafts = copyDuelTalentDrafts(currentState.duelTalentDrafts, normalized);
  currentState.onlineRounds = Array.from(
    { length: normalized },
    (_, index) => currentState.onlineRounds?.[index] ?? null,
  );
}

/** Uebernimmt die Namen, die der Realtime-Kanal per Presence bekannt macht. */
export function updateOnlinePlayerNames(
  names: readonly (string | null)[],
  replaceExisting = false,
): void {
  if (!state?.online) return;
  const currentState = state;
  const online = currentState.online;
  if (!online) return;

  const playerNames: OnlinePlayerNames = Array.from(
    { length: CHALLENGE_MAX_PLAYER_COUNT },
    (_, index) => (replaceExisting ? null : (online.playerNames?.[index] ?? null)),
  );
  for (let index = 0; index < CHALLENGE_MAX_PLAYER_COUNT; index += 1) {
    const name = cleanOnlinePlayerName(names[index]);
    if (name) playerNames[index] = name;
  }

  currentState.online = { ...online, playerNames };
}

/** Neues lokales Duell mit frischem Seed; Online-Rematches laufen ueber den Raum-RPC. */
export function rematch(): ChallengeState {
  if (state?.kind === 'daily') return startDaily(state.worldId);
  if (state?.kind === 'bot') {
    return startBot(
      state.worldId,
      state.botDifficulty ?? CHALLENGE_BOT_DEFAULT_DIFFICULTY,
      state.duelTalentDrafts,
      state.botMatchId,
    );
  }
  if (state?.kind === 'duel-online') {
    return state;
  }
  return start(
    state?.worldId ?? '',
    state?.duelTalentDrafts,
    state?.playerCount ?? CHALLENGE_DEFAULT_PLAYER_COUNT,
  );
}

export function getState(): ChallengeState | null {
  return state;
}

/** Beendet das Duell und gibt den Speicher frei. */
export function clear(): void {
  state = null;
}

/**
 * Index des Spielers, der als naechstes dran ist (0-basiert).
 *
 * Bei `duel-online` spielen beide Geraete gleichzeitig statt nacheinander -
 * "als naechstes dran" ist dort bedeutungslos. Stattdessen liefert diese
 * Funktion den `localPlayerIndex` des eigenen Geraets, damit GameScene ohne
 * Sonderfall denselben Aufruf nutzen kann.
 */
export function currentPlayerIndex(): number {
  if (state?.kind === 'duel-online') return state.online?.localPlayerIndex ?? 0;
  return state?.kind === 'bot' ? 0 : state ? state.rounds.length : 0;
}

/**
 * Traegt das Ergebnis des gerade beendeten Durchgangs ein.
 *
 * Bei `duel-online` **nicht** verwenden - dort kommen beide Ergebnisse
 * unabhaengig voneinander (eigenes lokal, Gegner ueber Netzwerk) und muessen
 * an einer festen Position landen, nicht per Ankunftsreihenfolge. Siehe
 * `submitOnlineRound()`.
 */
export function submitRound(stats: RunStats): void {
  if (!state || state.kind === 'duel-online' || isComplete()) return;

  state.rounds.push({
    score: stats.score,
    bestCombo: stats.bestCombo,
    totalCollected: stats.totalCollected,
  });

  if (state.kind === 'bot') {
    state.rounds.push(botRound(stats, state.seed, state.botDifficulty ?? 'normal'));
  }
}

export interface BotVictoryReward {
  coins: number;
  xp: number;
  /**
   * Kennung dieses Bot-Duells fuer die serverseitige Gutschrift.
   *
   * Der Server erkennt ueber sie einen wiederholten Aufruf als denselben Sieg
   * und bucht nicht doppelt (AUDIT_2026-09-05, Befund 6).
   */
  matchId?: string;
}

/** Gutschrift des Bot-Siegbonus, exakt einmal pro abgeschlossenem Duell. */
export function awardBotVictory(): BotVictoryReward | null {
  if (!state || state.kind !== 'bot') return null;
  if (state.botVictoryReward) return { ...state.botVictoryReward };
  if (winnerIndex() !== 0) return null;

  const progression = ProgressionSystem.applyBotVictoryBonus(
    BOT_VICTORY_BONUS_COINS,
    BOT_VICTORY_BONUS_XP,
  );
  state.botVictoryReward = {
    coins: progression.coinsGained,
    xp: progression.xpGained,
    ...(state.botMatchId ? { matchId: state.botMatchId } : {}),
  };
  return { ...state.botVictoryReward };
}

/**
 * Traegt ein Netzwerk-Duell-Ergebnis an einer festen Spielerposition ein.
 *
 * Anders als `submitRound()` (Ankunftsreihenfolge = Spielerreihenfolge, gilt
 * fuer das lokale Duell mit fester Uebergabe) treffen beim Netzwerk-Duell
 * beide Ergebnisse unabhaengig voneinander ein - das eigene sofort nach dem
 * lokalen Rundenende, das des Gegners sobald sein Broadcast eintrifft,
 * moeglicherweise zuerst. Ohne feste Positionszuordnung wuerde `winnerIndex()`
 * je nach Netzwerktiming den falschen Spieler als "Spieler 1"/"Spieler 2"
 * ausweisen.
 */
export function submitOnlineRound(index: number, round: ChallengeRound): void {
  if (!state || state.kind !== 'duel-online') return;
  const currentState = state;

  const playerCount = currentState.playerCount ?? CHALLENGE_DEFAULT_PLAYER_COUNT;
  if (!Number.isInteger(index) || index < 0 || index >= playerCount) return;
  const onlineRounds: (ChallengeRound | null)[] = Array.from(
    { length: playerCount },
    (_, playerIndex) => currentState.onlineRounds?.[playerIndex] ?? null,
  );
  onlineRounds[index] = round;
  currentState.onlineRounds = onlineRounds;

  // `rounds` erst befuellen, wenn beide Positionen feststehen - vorher
  // wuerden winnerIndex()/scoreToBeat() mit nur einem Ergebnis rechnen, das
  // je nach Netzwerktiming das des Gastgebers oder des Gasts sein koennte.
  if (onlineRounds.every((round) => round !== null)) {
    currentState.rounds = onlineRounds.filter((round): round is ChallengeRound => round !== null);
  }
}

export function isComplete(): boolean {
  if (!state) return false;
  if (state.kind === 'duel-online') {
    return state.rounds.length === (state.playerCount ?? CHALLENGE_DEFAULT_PLAYER_COUNT);
  }
  return (
    state.rounds.length >=
    (state.kind === 'duel' ? (state.playerCount ?? CHALLENGE_DEFAULT_PLAYER_COUNT) : 1)
  );
}

export function kind(): ChallengeKind {
  return state?.kind ?? 'duel';
}

export function playerLabel(index: number): string {
  if (state?.kind === 'duel-online') {
    const name = state.online?.playerNames?.[index];
    if (name) return name;
  }
  if (state?.kind === 'bot' && index === 1) return 'Bot';
  if (state?.kind === 'daily') return 'Tageslauf';
  return `Spieler ${index + 1}`;
}

/**
 * Punktzahl, die der aktuelle Spieler schlagen muss - `null`, wenn er der
 * erste ist. Das HUD zeigt sie waehrend des zweiten Durchgangs an.
 */
export function scoreToBeat(): number | null {
  if (!state || state.rounds.length === 0) return null;
  return Math.max(...state.rounds.map((round) => round.score));
}

/** Index des Siegers, oder `null` bei Gleichstand oder unfertigem Duell. */
export function winnerIndex(): number | null {
  if (!state || !isComplete()) return null;

  let bestIndex = 0;
  let tied = false;

  state.rounds.forEach((round, index) => {
    const best = state?.rounds[bestIndex];
    if (!best) return;

    if (round.score > best.score) {
      bestIndex = index;
      tied = false;
    } else if (index !== bestIndex && round.score === best.score) {
      tied = true;
    }
  });

  return tied ? null : bestIndex;
}
