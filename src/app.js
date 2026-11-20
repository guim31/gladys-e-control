// -----------------------------------------------------------------------------
// The integration, wired on a Gladys client (the real one in index.js, the
// SDK's fake Gladys in the tests).
//
// Search point: an Austrian postal code of the configuration (its position
// from the E-Control list of postal codes, read once), else the first located
// house of Gladys (getHouses(), manifest `location: true`).
//
// Refresh: no core polling (should_poll false); the container ticks every
// 5 minutes on its own timer and asks E-Control every 30 minutes (one request
// per fuel followed), 15 minutes after a failure, at once when the point or
// the fuels change. Every tick publishes the states that changed, each value
// sent again at least every 12 hours (heartbeat). A lower cheapest price fires
// the "Fuel price drop" trigger.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import { CHEAPEST, buildCheapestDevice, cheapestIds, cheapestStates } from './devices.js';
import { SourceError, loadPostalCodes, searchStations } from './econtrol.js';
import { MESSAGES, TEXT, fuelName, pick } from './i18n.js';
import { createIssueLog } from './issues.js';
import { Store } from './store.js';
import { WIDGET_KEY, buildWidgetContent, normalizeSettings } from './widgets.js';

const logger = createLogger({ name: 'e-control' });

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
export const TICK_MS = 5 * MINUTE_MS;
export const REFRESH_MS = 30 * MINUTE_MS;
export const FAILURE_RETRY_MS = 15 * MINUTE_MS;
export const HEARTBEAT_MS = 12 * HOUR_MS;
/** The house of Gladys is read again every hour (no update event). */
export const LOCATE_MS = HOUR_MS;

export const ACTION_KEY = 'test_source';
export const PRICE_DROP = 'price_drop';
export const TRIGGER_KEYS = [PRICE_DROP];

/** A failed action: Gladys shows the thrown message in red, in the user's language. */
export class ActionFailure extends Error {
  constructor(text) {
    super(text.en);
    this.message = text;
  }
}

/**
 * @param {object} gladys GladysIntegration, or the SDK's fake Gladys
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch]
 * @param {Store} [options.store]
 * @param {() => number} [options.now]
 * @param {boolean} [options.timers] run the timer
 */
export function registerHandlers(
  gladys,
  {
    fetch: fetchImpl = globalThis.fetch,
    store = new Store(),
    now = () => Date.now(),
    timers = true,
  } = {},
) {
  let config = normalizeConfig(gladys.config ?? {});
  /** The first located house: { lat, lon } or null. */
  let home = null;
  let located = false;
  let locatedAt = -Infinity;
  /** The postal codes of E-Control, read once: Map or null. */
  let postalCodes = null;
  /** What /data keeps: the last cheapest price per fuel (the trigger), and its point. */
  let persisted = { place: null, prices: {} };
  /** The last read: { key, results: { fuel: stations[] }, readAt }. */
  let snapshot = null;
  let attemptAt = -Infinity;
  let failure = null;
  let lastStatus = null;
  let timer = null;
  let stopped = false;
  let ticking = null;

  const readIssues = createIssueLog(logger);
  const gladysIssues = createIssueLog(logger);

  const ready = store.load().then((data) => {
    persisted = {
      place: typeof data.place === 'string' ? data.place : null,
      prices: data.prices && typeof data.prices === 'object' ? data.prices : {},
    };
  });

  // --- The search point -------------------------------------------------------

  /**
   * The point searched around: { lat, lon, place } (place null for the
   * house), or { missing: 'noPlace' | 'unknownPostalCode' | 'failing' }.
   */
  function point() {
    if (config.postalCode) {
      if (!postalCodes) {
        return { missing: 'failing' };
      }
      const found = postalCodes.get(config.postalCode);
      return found
        ? { lat: found.lat, lon: found.lon, place: `${config.postalCode} ${found.place}` }
        : { missing: 'unknownPostalCode' };
    }
    return home ? { ...home, place: null } : { missing: 'noPlace' };
  }

  const readKeyOf = (target) => JSON.stringify([target.lat, target.lon, config.fuels]);
  const placeKeyOf = (target) => JSON.stringify([target.lat, target.lon]);

  const current = () => {
    const target = point();
    return !target.missing && snapshot?.key === readKeyOf(target) ? snapshot : null;
  };

  /** The postal codes, read when one is configured and not yet known. */
  async function ensurePostalCodes() {
    if (!config.postalCode || postalCodes) {
      return true;
    }
    try {
      postalCodes = await loadPostalCodes(fetchImpl);
      logger.debug(`${postalCodes.size} postal codes read`);
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  }

  function fail(err) {
    const error = err instanceof SourceError ? err : new SourceError(err.message);
    failure = { retryAt: attemptAt + FAILURE_RETRY_MS, error };
    readIssues.fail('read', `The E-Control fuel prices cannot be read: ${error.message}`);
  }

  function nextReadAt() {
    if (failure) {
      return failure.retryAt;
    }
    const target = point();
    if (target.missing) {
      return config.postalCode && !postalCodes ? now() : Infinity;
    }
    if (snapshot?.key !== readKeyOf(target)) {
      return now();
    }
    return attemptAt + REFRESH_MS;
  }

  // --- Reading the API --------------------------------------------------------

  /** @returns {Promise<boolean>} new prices were read */
  async function refresh() {
    attemptAt = now();
    if (!(await ensurePostalCodes())) {
      return false;
    }
    const target = point();
    if (target.missing) {
      failure = null;
      return false;
    }
    const key = readKeyOf(target);
    const results = {};
    try {
      // One fuel after the other: three light requests, never a burst.
      for (const fuel of config.fuels) {
        results[fuel] = await searchStations(fetchImpl, target, fuel);
      }
    } catch (err) {
      fail(err);
      return false;
    }
    // The configuration changed during the read: the forced tick of the new
    // one reads again.
    if (readKeyOf(point()) !== key) {
      return false;
    }
    failure = null;
    readIssues.ok('read', 'The E-Control fuel prices answer again');
    if (snapshot?.key !== key) {
      const counts = config.fuels.map((fuel) => `${fuel} ${results[fuel].length}`).join(', ');
      logger.info(`E-Control read ${target.place ?? 'around the house'}: ${counts} station(s)`);
    }
    snapshot = { key, place: placeKeyOf(target), results, readAt: now() };
    return true;
  }

  // --- Discovery --------------------------------------------------------------

  async function publishDiscovery() {
    const devices = point().missing ? [] : [buildCheapestDevice(gladys, config)];
    try {
      await gladys.publishDiscoveredDevices(devices);
      gladysIssues.ok('discovery', 'Discovered device accepted by Gladys again');
    } catch (err) {
      gladysIssues.fail('discovery', `Discovered device not accepted by Gladys: ${err.message}`);
    }
  }

  // --- States and the trigger -------------------------------------------------

  const cheapestAdded = () =>
    (gladys.devices ?? []).some((device) => device.external_id === cheapestIds(gladys).device);

  /**
   * A lower cheapest price than the last one seen, for a device added in
   * Gladys: one event per fuel. The first price seen is only remembered, and
   * so is the first one at another search point.
   */
  function drops() {
    const read = current();
    if (!read || !cheapestAdded()) {
      return [];
    }
    const comparable = persisted.place === read.place;
    const events = [];
    const prices = {};
    for (const fuel of config.fuels) {
      const best = read.results[fuel]?.[0];
      if (!best) {
        continue;
      }
      prices[fuel] = best.price;
      const previous = comparable ? persisted.prices[fuel] : undefined;
      if (typeof previous === 'number' && best.price < previous - 1e-9) {
        events.push({
          fuel,
          fuel_name: fuelName(fuel, config.language),
          station: best.name,
          price: best.price,
          previous_price: previous,
          drop: Math.round((previous - best.price) * 1000) / 1000,
        });
      }
    }
    // A fuel without a station this time keeps its last price.
    const merged = comparable ? { ...persisted.prices, ...prices } : prices;
    if (!comparable || JSON.stringify(merged) !== JSON.stringify(persisted.prices)) {
      persisted = { place: read.place, prices: merged };
      store.save(persisted);
    }
    return events;
  }

  /** Remembered even when Gladys refuses the event: never fired in a loop. */
  async function sendEvents(events) {
    for (const event of events) {
      try {
        await gladys.publishSceneEvent(PRICE_DROP, event);
        logger.debug(`Trigger ${PRICE_DROP}: ${JSON.stringify(event)}`);
      } catch (err) {
        gladysIssues.fail(
          'scene-event',
          `Trigger ${PRICE_DROP} not sent to Gladys: ${err.message}`,
        );
      }
    }
  }

  async function publishStates() {
    const read = current();
    // During an outage, the last prices are not sent again as fresh ones
    // (the heartbeat would keep them alive): the status says it instead.
    if (!read || failure || !cheapestAdded()) {
      return;
    }
    const states = cheapestStates(gladys, config, read.results);
    if (states.length === 0) {
      return;
    }
    try {
      const { count } = await gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
      if (count > 0) {
        logger.debug(`${count} state(s) published`);
      }
      gladysIssues.ok('states', 'States accepted by Gladys again');
    } catch (err) {
      gladysIssues.fail('states', `States not accepted by Gladys: ${err.message}`);
    }
  }

  const status = () => {
    if (failure) {
      return 'failing';
    }
    const target = point();
    if (target.missing) {
      return target.missing === 'failing' ? 'waiting' : target.missing;
    }
    return current() ? 'ok' : 'waiting';
  };

  /** The application status of the Configuration screen, sent on change only. */
  async function reportStatus() {
    const message = {
      failing: TEXT.unreachable,
      noPlace: TEXT.noPlace,
      unknownPostalCode: TEXT.unknownPostalCode,
    }[status()];
    const value = message ? { connected: false, message } : { connected: true };
    const key = JSON.stringify(value);
    if (key === lastStatus) {
      return;
    }
    try {
      // The four languages: the core 5.2+ refuses a plain string.
      await gladys.setConnectionStatus(value.connected, value.message);
      lastStatus = key;
    } catch (err) {
      logger.debug(`Connection status not sent: ${err.message}`);
    }
  }

  // --- The tick ---------------------------------------------------------------

  /**
   * Read the API when due, publish what changed. One tick at a time: a second
   * caller waits for the one in progress.
   * @param {object} [options]
   * @param {boolean} [options.force] read now
   */
  async function tick({ force = false } = {}) {
    while (force && ticking) {
      await ticking.catch(() => {});
    }
    if (ticking) {
      return ticking;
    }
    ticking = (async () => {
      if (gladys.connected === false) {
        logger.debug('Gladys unreachable: tick skipped');
        return;
      }
      // The house may have been located or moved in Gladys since.
      if (now() - locatedAt >= LOCATE_MS) {
        const before = JSON.stringify(point());
        await locate();
        if (JSON.stringify(point()) !== before) {
          await publishDiscovery();
        }
      }
      let read = false;
      if (force || now() >= nextReadAt()) {
        const missingBefore = Boolean(point().missing);
        read = await refresh();
        // The postal codes just arrived: the device can be discovered now.
        if (missingBefore && !point().missing) {
          await publishDiscovery();
        }
      }
      await publishStates();
      if (read) {
        await sendEvents(drops());
        gladys.requestWidgetRefresh(WIDGET_KEY);
      }
      await reportStatus();
    })().finally(() => {
      ticking = null;
    });
    return ticking;
  }

  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!timers || stopped) {
      return;
    }
    timer = setTimeout(async () => {
      timer = null;
      try {
        await tick();
      } catch (err) {
        logger.error(`Refresh failed (${err.message})`);
      } finally {
        schedule();
      }
    }, TICK_MS);
  }

  /** The first located house of Gladys; a change is logged once. */
  async function locate() {
    locatedAt = now();
    let found;
    try {
      const house = (await gladys.getHouses()).find(
        (h) => typeof h.latitude === 'number' && typeof h.longitude === 'number',
      );
      found = house ? { lat: house.latitude, lon: house.longitude } : null;
      gladysIssues.ok('houses', 'Houses of Gladys readable again');
    } catch (err) {
      gladysIssues.fail('houses', `Houses of Gladys not readable (${err.message})`);
      return;
    }
    if (!located || JSON.stringify(found) !== JSON.stringify(home)) {
      logger.info(found ? 'House located in Gladys' : 'No located house in Gladys');
    }
    located = true;
    home = found;
  }

  /** (Re)start: locate the house, read, publish the device, then tick. */
  async function start() {
    await ready;
    stopped = false;
    lastStatus = null;
    failure = null;
    await locate();
    schedule();
    // Not forced: a reconnection to Gladys keeps the prices of less than 30
    // minutes ago; a new point or new fuels are read at once (nextReadAt),
    // after the read in progress, which belongs to the previous configuration.
    await ticking?.catch(() => {});
    await tick();
    await publishDiscovery();
  }

  // --- Handlers ---------------------------------------------------------------

  gladys.onScanRequest(async () => {
    await locate();
    await tick({ force: true });
    await publishDiscovery();
  });

  // The device just added: its states again now (the core dropped the ones it
  // received before the feature existed), and its first prices remembered.
  const onDeviceAdded = async () => {
    await ticking?.catch(() => {});
    await publishStates();
    await sendEvents(drops());
    gladys.requestWidgetRefresh(WIDGET_KEY);
  };
  gladys.onDeviceCreated(onDeviceAdded);
  gladys.onDeviceUpdated(onDeviceAdded);
  gladys.onDeviceDeleted(() => gladys.requestWidgetRefresh(WIDGET_KEY));

  gladys.onAction(ACTION_KEY, async () => {
    logger.info('Action: test the E-Control price service');
    await locate();
    failure = null;
    await tick({ force: true });
    const state = status();
    if (state !== 'ok') {
      throw new ActionFailure(
        {
          failing: TEXT.unreachable,
          noPlace: TEXT.noPlace,
          unknownPostalCode: TEXT.unknownPostalCode,
          waiting: TEXT.unreachable,
        }[state],
      );
    }
    const read = current();
    if (Object.values(read.results).every((stations) => stations.length === 0)) {
      throw new ActionFailure(TEXT.noStation);
    }
    return pick(MESSAGES.testOk({ place: point().place, results: read.results }), config.language);
  });

  gladys.onWidgetGet(WIDGET_KEY, async ({ settings, language }) => {
    const normalized = normalizeSettings(settings);
    const read = current();
    const target = point();
    return buildWidgetContent({
      fuel: normalized.fuel,
      fuels: config.fuels,
      results: read?.results ?? {},
      showList: normalized.showList,
      status: status(),
      place: target.missing ? null : target.place,
      readAt: read?.readAt ?? null,
      language,
    });
  });

  gladys.onConfigUpdated(async (raw) => {
    config = normalizeConfig(raw);
    logger.info('New configuration received');
    await start();
  });

  gladys.on('connected', async () => {
    try {
      config = normalizeConfig(await gladys.getConfig());
      await start();
    } catch (err) {
      logger.error(`Post-connection initialization failed: ${err.message}`);
      await gladys.setConnectionStatus(false, TEXT.initFailed).catch(() => {});
    }
  });

  return {
    ready,
    tick,
    nextReadAt,
    /** For the tests: what the integration holds. */
    get snapshot() {
      return snapshot;
    },
    get prices() {
      return persisted.prices;
    },
    get home() {
      return home;
    },
    /** Stop the timer and wait for the last write under /data. */
    async stop() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
      await ticking?.catch(() => {});
      await store.flush();
    },
  };
}

export { CHEAPEST, cheapestIds };
