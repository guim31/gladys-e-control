// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys (with a located house), a fake
// E-Control API behind a fake `fetch`, a temporary /data and a manual clock,
// with the integration wired on top through registerHandlers. No timer runs
// unless `timers: true`: the tests call `app.tick()`. No test touches the
// network.
//
// The fixtures are real answers of 20/11/2026, the contact details of the
// stations removed: the searches around Stephansplatz in Vienna and around
// St. Anton am Arlberg (a village of Tyrol) for the three fuels, and the list
// of postal codes cut down to four. Any point west of 13° E answers like St.
// Anton, east of it like Vienna; outside Austria, an empty array, as the API.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { BASE_URL, UNITS_URL } from '../../src/econtrol.js';
import { Store } from '../../src/store.js';

// The integration logs its lifecycle; keep the test output readable.
process.env.LOG_LEVEL ??= 'silent';

export const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));

export const START = Date.UTC(2026, 10, 20, 21, 30, 0);
export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;

export const VIENNA = { latitude: 48.2085, longitude: 16.3721 };
export const ST_ANTON = { latitude: 47.1287, longitude: 10.264 };
export const PARIS = { latitude: 48.8566, longitude: 2.3522 };
export const house = (position) => ({
  id: 'house-1',
  name: 'Haus',
  selector: 'haus',
  ...position,
});

/** A manual clock. */
export function createClock(start = START) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

const inAustria = (lat, lon) => lat > 46.3 && lat < 49.1 && lon > 9.5 && lon < 17.2;

/**
 * The fake API. `answers` holds the searches by place and fuel code (edited by
 * the tests); `fail` replaces any answer when set. Every call is recorded.
 */
export function createFakeApi() {
  const api = {
    calls: [],
    answers: {
      vienna: {
        DIE: fixture('vienna-die.json'),
        SUP: fixture('vienna-sup.json'),
        GAS: fixture('vienna-gas.json'),
      },
      stanton: {
        DIE: fixture('stanton-die.json'),
        SUP: fixture('stanton-sup.json'),
        GAS: fixture('stanton-gas.json'),
      },
    },
    units: fixture('regions-units.json'),
    /** @type {null | ((url: string) => Response)} */
    fail: null,
    /** @type {typeof fetch} */
    fetch: async (url) => {
      const text = String(url);
      api.calls.push(text);
      if (api.fail) {
        return api.fail(text);
      }
      const json = (body) =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      if (text === UNITS_URL) {
        return json(api.units);
      }
      if (text.startsWith(`${BASE_URL}/search/gas-stations/by-address?`)) {
        const query = new URL(text).searchParams;
        const lat = Number(query.get('latitude'));
        const lon = Number(query.get('longitude'));
        if (query.get('includeClosed') !== 'false') {
          return new Response('{}', { status: 400 });
        }
        if (!inAustria(lat, lon)) {
          return json([]);
        }
        return json(api.answers[lon < 13 ? 'stanton' : 'vienna'][query.get('fuelType')]);
      }
      throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
    },
    count: () => api.calls.length,
    /** Change the price of the station at a rank of a search. */
    setPrice(place, code, rank, amount) {
      const priced = api.answers[place][code].filter((s) => s.prices.length > 0);
      priced[rank].prices[0].amount = amount;
    },
  };
  return api;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {Array} [options.houses]
 * @param {Array} [options.devices] devices already created in Gladys
 */
export async function createWorld({
  clock = createClock(),
  api = createFakeApi(),
  config = { language: 'fr', fuels: ['diesel', 'super', 'cng'] },
  houses = [house(VIENNA)],
  devices = [],
  connect = true,
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-e-control-')),
  timers = false,
} = {}) {
  const gladys = createFakeGladys({ config, devices, houses });
  const app = registerHandlers(gladys, {
    fetch: api.fetch,
    store: new Store(dataDir),
    now: clock.now,
    timers,
  });
  if (connect) {
    await gladys.connect();
  }
  return { gladys, fake: gladys.fake, api, app, clock, dataDir };
}

/** Add the discovered devices in Gladys, as the user would. */
export async function createAll(world) {
  for (const device of world.fake.discoveredDevices) {
    await world.fake.deviceCreated(device);
  }
}

/** The discovered devices of a configuration. */
export async function discoveredDevices(options) {
  const world = await createWorld(options);
  const devices = world.fake.discoveredDevices;
  await world.app.stop();
  return devices;
}
