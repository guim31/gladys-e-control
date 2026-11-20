// -----------------------------------------------------------------------------
// The integration end to end, against the SDK's fake Gladys and the fake
// E-Control API (real answers, test/helpers/world.js).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { FAILURE_RETRY_MS, PRICE_DROP, REFRESH_MS, TICK_MS } from '../src/app.js';
import { cheapestIds } from '../src/devices.js';
import { UNITS_URL, parseStations, searchUrl } from '../src/econtrol.js';
import { WIDGET_KEY } from '../src/widgets.js';
import {
  HOUR,
  PARIS,
  ST_ANTON,
  createAll,
  createClock,
  createFakeApi,
  createWorld,
  fixture,
  house,
} from './helpers/world.js';

const widget = async (world, settings = {}, language = 'fr') => {
  const ack = await world.fake.widgetGet(WIDGET_KEY, { settings, language });
  assert.equal(ack.success, true, JSON.stringify(ack));
  assert.doesNotThrow(() => validateWidgetContent(ack.data.content));
  return ack.data.content;
};

const bodyText = (content) => content.components.find((c) => c.type === 'text').text;

test('the client: the 5 priced stations of a real answer, cheapest first, the others ignored', () => {
  const stations = parseStations(fixture('vienna-die.json'), 'diesel');
  assert.equal(stations.length, 5);
  assert.deepEqual(stations[0], {
    id: 6083,
    name: 'Turmöl Quick',
    address: 'Währinger Gürtel 116',
    postalCode: '1090',
    city: 'Wien',
    distanceKm: 2.6,
    price: 1.984,
  });
  const prices = stations.map((s) => s.price);
  assert.deepEqual(
    prices,
    [...prices].sort((a, b) => a - b),
  );
  // Equal prices: the nearest first (CNG around St. Anton, all at 1.725 €/kg).
  const cng = parseStations(fixture('stanton-gas.json'), 'cng');
  const distances = cng.map((s) => s.distanceKm);
  assert.deepEqual(
    distances,
    [...distances].sort((a, b) => a - b),
  );
  // A price of 0, another fuel or a closed station never become the cheapest.
  const odd = structuredClone(fixture('vienna-die.json'));
  odd[1].prices[0].amount = 0;
  odd[2].prices[0].fuelType = 'SUP';
  odd[3].open = false;
  assert.equal(parseStations(odd, 'diesel').length, 2);
  assert.throws(() => parseStations({ errors: [] }, 'diesel'), /unexpected document/);
});

test('the search URL asks for the open stations only', () => {
  const url = new URL(searchUrl({ lat: 48.2, lon: 16.37 }, 'cng'));
  assert.equal(url.searchParams.get('fuelType'), 'GAS');
  assert.equal(url.searchParams.get('includeClosed'), 'false');
});

test('Vienna: one cheapest device, its states once added, one request per fuel', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  assert.equal(world.api.count(), 3);
  const [device] = world.fake.discoveredDevices;
  assert.equal(world.fake.discoveredDevices.length, 1);
  assert.equal(device.name, 'Carburant le moins cher – Autriche');
  assert.equal(device.should_poll, false);
  assert.equal(device.features.length, 12);
  assert.equal(world.fake.connectionStatus.connected, true);

  await createAll(world);
  const ids = cheapestIds(world.gladys);
  assert.equal(world.fake.lastState(ids.feature('diesel_price')), 1.984);
  assert.equal(world.fake.lastState(ids.feature('diesel_station')), 'Turmöl Quick');
  assert.equal(
    world.fake.lastState(ids.feature('diesel_address')),
    'Währinger Gürtel 116, 1090 Wien',
  );
  assert.equal(world.fake.lastState(ids.feature('diesel_distance')), 2.6);
  assert.equal(world.fake.lastState(ids.feature('super_price')), 1.584);
  assert.equal(world.fake.lastState(ids.feature('cng_price')), 1.5);
  assert.equal(world.fake.widgetRefreshes.at(-1), WIDGET_KEY);
});

test('the API is read every 30 minutes, not before; only the changes are published', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world);
  const published = world.fake.states.length;
  world.clock.advance(REFRESH_MS - TICK_MS);
  await world.app.tick();
  assert.equal(world.api.count(), 3);
  world.clock.advance(TICK_MS);
  await world.app.tick();
  assert.equal(world.api.count(), 6);
  assert.equal(world.fake.states.length, published);
  world.api.setPrice('vienna', 'DIE', 0, 1.979);
  world.clock.advance(REFRESH_MS);
  await world.app.tick();
  assert.equal(world.fake.states.length, published + 1);
  assert.equal(world.fake.lastState(cheapestIds(world.gladys).feature('diesel_price')), 1.979);
});

test('the timer reads by itself: no core polling', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const world = await createWorld({ timers: true });
  t.after(() => world.app.stop());
  assert.equal(world.api.count(), 3);
  world.clock.advance(REFRESH_MS);
  t.mock.timers.tick(TICK_MS);
  // The tick runs in the timer callback: let it finish.
  for (let i = 0; i < 50 && world.api.count() < 6; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal(world.api.count(), 6);
});

test('a postal code of the configuration: searched around it, the house ignored', async (t) => {
  const world = await createWorld({
    config: { language: 'de', fuels: ['super'], postal_code: 'A-6580' },
  });
  t.after(() => world.app.stop());
  assert.deepEqual(world.api.calls.slice(0, 1), [UNITS_URL]);
  const search = new URL(world.api.calls[1]).searchParams;
  assert.equal(search.get('latitude'), '47.13296');
  await createAll(world);
  const ids = cheapestIds(world.gladys);
  assert.equal(world.fake.lastState(ids.feature('super_price')), 1.604);
  assert.equal(world.fake.lastState(ids.feature('diesel_price')), undefined);
  const content = await widget(world, {}, 'de');
  assert.match(content.components.at(-1).text, /^Rund um 6580 St\. Anton am Arlberg · /);
  // The postal codes are read once.
  world.clock.advance(REFRESH_MS);
  await world.app.tick();
  assert.equal(world.api.calls.filter((url) => url === UNITS_URL).length, 1);
});

test('an unknown postal code, no house: said on the configuration screen, in the widget and the action', async (t) => {
  const unknown = await createWorld({ config: { postal_code: '9999' } });
  t.after(() => unknown.app.stop());
  assert.equal(unknown.fake.connectionStatus.connected, false);
  assert.match(unknown.fake.connectionStatus.message.fr, /code postal/);
  assert.deepEqual(unknown.fake.discoveredDevices, []);
  assert.match(bodyText(await widget(unknown)), /n’est pas un code autrichien/);
  const ack = await unknown.fake.action('test_source');
  assert.equal(ack.success, false);
  assert.match(ack.error.fr, /code postal/);

  const nowhere = await createWorld({ houses: [] });
  t.after(() => nowhere.app.stop());
  assert.equal(nowhere.api.count(), 0);
  assert.match(nowhere.fake.connectionStatus.message.en, /locate your house/);
  const none = await nowhere.fake.action('test_source');
  assert.equal(none.success, false);
  assert.match(none.error.de, /Postleitzahl/);
});

test('outside Austria: no station, said by the widget and the action', async (t) => {
  const world = await createWorld({ houses: [house(PARIS)] });
  t.after(() => world.app.stop());
  await createAll(world);
  assert.match(bodyText(await widget(world)), /Aucune station trouvée/);
  const ack = await world.fake.action('test_source');
  assert.equal(ack.success, false);
  assert.match(ack.error.es, /Austria/);
});

test('the action: the cheapest price of each fuel, in the language of the configuration', async (t) => {
  const world = await createWorld({ houses: [house(ST_ANTON)] });
  t.after(() => world.app.stop());
  const ack = await world.fake.action('test_source');
  assert.equal(ack.success, true, JSON.stringify(ack));
  assert.match(ack.data.message, /^Les moins chers autour de la maison : Gazole 2,000\s€ \(DISK\)/);
});

test('a network failure: status, widget and action say so, a retry after 15 minutes', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world);
  world.api.fail = () => {
    throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
  };
  world.clock.advance(REFRESH_MS);
  await world.app.tick();
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.match(world.fake.connectionStatus.message.fr, /injoignable/);
  assert.match(bodyText(await widget(world)), /injoignable/);
  const calls = world.api.count();
  world.clock.advance(FAILURE_RETRY_MS - TICK_MS);
  await world.app.tick();
  assert.equal(world.api.count(), calls);
  world.clock.advance(TICK_MS);
  await world.app.tick();
  assert.equal(world.api.count(), calls + 1);
  const ack = await world.fake.action('test_source');
  assert.equal(ack.success, false);
  assert.match(ack.error.en, /cannot be reached/);

  world.api.fail = null;
  world.clock.advance(FAILURE_RETRY_MS);
  await world.app.tick();
  assert.equal(world.fake.connectionStatus.connected, true);
  // An HTTP error too.
  world.api.fail = () => new Response('{}', { status: 503 });
  world.clock.advance(REFRESH_MS);
  await world.app.tick();
  assert.equal(world.fake.connectionStatus.connected, false);
});

test('the widget: the cheapest price as a tile, five stations, a caption; the list hidden by a setting', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const content = await widget(world, { fuel: 'super' }, 'en');
  const [tile, list, caption] = content.components;
  assert.equal(tile.type, 'value');
  assert.equal(tile.label, 'Super 95');
  assert.equal(tile.value, 1.584);
  assert.equal(tile.unit, '€/l');
  assert.equal(list.type, 'card-list');
  assert.equal(list.items.length, 5);
  assert.equal(list.items[0].title, 'Turmöl Quick');
  assert.equal(list.items[0].badge.text, '€1.584');
  assert.match(list.items[0].subtitle, /^Währinger Gürtel 116, 1090 Wien · 2\.6 km$/);
  assert.match(caption.text, /^Around the house · Nov 20, 2026/);

  const hidden = await widget(world, { fuel: 'cng', show_list: false }, 'fr');
  assert.deepEqual(
    hidden.components.map((c) => c.type),
    ['value', 'text'],
  );
  assert.equal(hidden.components[0].unit, '€/kg');

  // Default: the first fuel followed.
  assert.equal((await widget(world, {}, 'de')).components[0].label, 'Diesel');

  const only = await createWorld({ config: { fuels: ['diesel'] } });
  t.after(() => only.app.stop());
  assert.match(bodyText(await widget(only, { fuel: 'cng' })), /n’est pas suivi/);
});

test('the price drop trigger: first prices remembered, a drop fired once, not again after a restart', async (t) => {
  const api = createFakeApi();
  const clock = createClock();
  const world = await createWorld({ api, clock });
  await createAll(world);
  assert.deepEqual(world.fake.sceneEvents, []);
  assert.deepEqual(world.app.prices, { diesel: 1.984, super: 1.584, cng: 1.5 });

  api.setPrice('vienna', 'SUP', 2, 1.549);
  clock.advance(REFRESH_MS);
  await world.app.tick();
  const events = world.fake.sceneEvents.filter((e) => e.key === PRICE_DROP);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].data, {
    fuel: 'super',
    fuel_name: 'Sans plomb 95',
    station: 'BP',
    price: 1.549,
    previous_price: 1.584,
    drop: 0.035,
  });
  // A rise is not a drop.
  api.setPrice('vienna', 'DIE', 0, 2.5);
  clock.advance(REFRESH_MS);
  await world.app.tick();
  assert.equal(world.fake.sceneEvents.length, 1);
  await world.app.stop();

  // Restart on the same /data: the same prices are not a drop.
  const again = await createWorld({
    api,
    clock,
    dataDir: world.dataDir,
    devices: world.fake.discoveredDevices,
  });
  t.after(() => again.app.stop());
  clock.advance(REFRESH_MS);
  await again.app.tick();
  assert.equal(again.fake.sceneEvents.length, 0);
});

test('another search point: its first prices are remembered, not compared', async (t) => {
  const clock = createClock();
  const world = await createWorld({ clock });
  t.after(() => world.app.stop());
  await createAll(world);
  // St. Anton is cheaper for super: not a drop, another place.
  await world.fake.configUpdated({
    language: 'fr',
    fuels: ['diesel', 'super'],
    postal_code: '6580',
  });
  await world.app.tick();
  assert.deepEqual(world.fake.sceneEvents, []);
  assert.equal(world.app.prices.super, 1.604);
  assert.equal(world.app.prices.cng, undefined);
});

test('nothing is published or remembered before the device is added', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  world.clock.advance(HOUR);
  await world.app.tick();
  assert.equal(world.fake.states.length, 0);
  assert.deepEqual(world.app.prices, {});
});
