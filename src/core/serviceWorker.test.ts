/**
 * Regressionstests zu AUDIT_2026-09-05, Befund 7 und 10.
 *
 * Der Service Worker war bis dahin komplett ungetestet - er laeuft weder im
 * Browser-Playtest (dort zaehlt die Seite, nicht der Worker) noch in einer
 * Scene. Beide Fehler blieben deshalb unbemerkt, obwohl sie im Quelltext
 * direkt nebeneinander stehen.
 *
 * Getestet wird die ausgelieferte Vorlage `scripts/sw-template.txt`, mit
 * denselben Platzhalterwerten, die `vite.config.ts` beim Build einsetzt. Der
 * Worker laeuft dazu in einem `vm`-Kontext mit nachgebauten `caches`, `fetch`
 * und `self` - ohne Browser, aber gegen den echten Quelltext.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGIN = 'https://isihunt.test';

interface WorkerHarness {
  fetchHandler: (event: {
    request: Request;
    respondWith: (response: Promise<Response>) => void;
  }) => void;
  cacheEntries: Map<string, Response>;
  networkCalls: () => number;
  setNetwork: (handler: () => Response) => void;
}

function loadWorker(precacheUrls: string[] = []): WorkerHarness {
  const source = readFileSync(resolve(__dirname, '../../scripts/sw-template.txt'), 'utf8')
    .replace('__ISIHUNT_CACHE_NAME__', JSON.stringify('isihunt-app-shell-test'))
    .replace('__ISIHUNT_PRECACHE_URLS__', JSON.stringify(precacheUrls));

  const handlers = new Map<string, (event: unknown) => void>();
  const cacheEntries = new Map<string, Response>();
  let networkCalls = 0;
  let network = () => new Response('vom Netz', { status: 200 });

  const context = createContext({
    URL,
    Request,
    Response,
    self: {
      location: new URL(`${ORIGIN}/sw.js`),
      addEventListener: (type: string, handler: (event: unknown) => void) =>
        handlers.set(type, handler),
      skipWaiting: () => undefined,
      clients: { claim: () => undefined },
    },
    caches: {
      match: (url: string | URL) =>
        Promise.resolve(cacheEntries.get(typeof url === 'string' ? url : url.toString())?.clone()),
      open: () =>
        Promise.resolve({
          put: (request: Request, response: Response) => {
            cacheEntries.set(request.url, response);
            return Promise.resolve();
          },
          addAll: () => Promise.resolve(),
        }),
      keys: () => Promise.resolve([]),
      delete: () => Promise.resolve(true),
    },
    fetch: () => {
      networkCalls += 1;
      return Promise.resolve(network());
    },
  });

  runInContext(source, context);

  return {
    fetchHandler: handlers.get('fetch') as WorkerHarness['fetchHandler'],
    cacheEntries,
    networkCalls: () => networkCalls,
    setNetwork: (handler) => {
      network = handler;
    },
  };
}

/**
 * Navigationsanfrage als schlichtes Objekt.
 *
 * `new Request(url, { mode: 'navigate' })` ist im Konstruktor verboten - im
 * Browser setzt nur die Navigation selbst diesen Modus. Der Worker liest
 * ohnehin nur `method`, `url` und `mode`.
 */
function navigationRequest(url: string): Request {
  return { method: 'GET', url, mode: 'navigate' } as unknown as Request;
}

/** Ruft den Fetch-Handler auf und liefert die Antwort, die er einsetzt. */
async function handle(worker: WorkerHarness, request: Request): Promise<Response> {
  let responded!: Promise<Response>;
  worker.fetchHandler({ request, respondWith: (response) => (responded = response) });
  const result = await responded;
  // Der Handler schreibt den Cache in einem eigenen, nicht abgewarteten
  // Promise - ein Tick reicht, damit er fertig ist.
  await Promise.resolve();
  await Promise.resolve();
  return result;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('AUDIT_2026-09-05 Befund 7: Updatepruefung', () => {
  it('beantwortet version.json nie aus dem Cache', async () => {
    const worker = loadWorker();
    // Selbst wenn ein alter Eintrag existiert - etwa aus einer frueheren
    // Version, die die Datei noch vorgehalten hat.
    worker.cacheEntries.set(`${ORIGIN}/version.json`, new Response('{"version":"alt"}'));
    worker.setNetwork(() => new Response('{"version":"neu"}', { status: 200 }));

    const response = await handle(worker, new Request(`${ORIGIN}/version.json?_=123`));

    expect(await response.text()).toBe('{"version":"neu"}');
    expect(worker.networkCalls()).toBe(1);
  });

  it('beantwortet andere Dateien weiterhin aus dem Cache', async () => {
    // Gegenprobe: die Ausnahme gilt nur dem Versionsmanifest, sonst waere
    // der Offline-Start kaputt.
    const worker = loadWorker();
    worker.cacheEntries.set(`${ORIGIN}/assets/app.js`, new Response('aus dem Cache'));

    const response = await handle(worker, new Request(`${ORIGIN}/assets/app.js`));

    expect(await response.text()).toBe('aus dem Cache');
    expect(worker.networkCalls()).toBe(0);
  });
});

describe('AUDIT_2026-09-05 Befund 10: Fehlerseite als App-Shell', () => {
  it('ersetzt die App-Shell nicht durch eine HTTP-503-Antwort', async () => {
    const worker = loadWorker();
    worker.cacheEntries.set(`${ORIGIN}/`, new Response('funktionierende App'));
    worker.setNetwork(() => new Response('Service Unavailable', { status: 503 }));

    await handle(worker, navigationRequest(`${ORIGIN}/`));

    // Ein 503 ist fuer `fetch` kein Fehler - ohne die ok-Pruefung landete er
    // im Cache und der naechste Offline-Start zeigte ihn statt der App.
    expect(await worker.cacheEntries.get(`${ORIGIN}/`)!.clone().text()).toBe('funktionierende App');
  });

  it('liefert bei einem Serverfehler die letzte funktionierende Shell aus', async () => {
    const worker = loadWorker();
    worker.cacheEntries.set(`${ORIGIN}/`, new Response('funktionierende App'));
    worker.setNetwork(() => new Response('Service Unavailable', { status: 503 }));

    const response = await handle(worker, navigationRequest(`${ORIGIN}/`));

    expect(await response.text()).toBe('funktionierende App');
  });

  it('speichert eine erfolgreiche Navigation weiterhin als App-Shell', async () => {
    // Gegenprobe: der Normalfall muss unveraendert funktionieren.
    const worker = loadWorker();
    worker.cacheEntries.set(`${ORIGIN}/`, new Response('alte App'));
    worker.setNetwork(() => new Response('neue App', { status: 200 }));

    const response = await handle(worker, navigationRequest(`${ORIGIN}/`));

    expect(await response.text()).toBe('neue App');
    expect(await worker.cacheEntries.get(`${ORIGIN}/`)!.clone().text()).toBe('neue App');
  });
});
