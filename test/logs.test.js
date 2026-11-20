// -----------------------------------------------------------------------------
// Quiet logs: a normal cycle writes nothing at the info level, and a failure
// that lasts writes one line when it starts and one when it ends.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAILURE_RETRY_MS, REFRESH_MS } from '../src/app.js';
import { createAll, createWorld } from './helpers/world.js';

/** Capture what the loggers write, at a given LOG_LEVEL. */
function captureLogs(t, level) {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  const lines = [];
  for (const stream of ['log', 'error']) {
    t.mock.method(console, stream, (...args) => lines.push(args.map(String).join(' ')));
  }
  return lines;
}

test('a normal cycle writes nothing at the info level', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world);
  const lines = captureLogs(t, 'info');
  for (let i = 0; i < 8; i += 1) {
    world.clock.advance(REFRESH_MS);
    if (i === 4) {
      world.api.setPrice('vienna', 'DIE', 0, 1.9);
    }
    await world.app.tick();
    await world.fake.widgetGet('cheapest_stations', { settings: {}, language: 'fr' });
  }
  assert.ok(world.api.count() >= 24);
  assert.deepEqual(lines, []);
});

test('a lasting failure: one line when it starts, one when it ends', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world);
  const lines = captureLogs(t, 'info');
  world.api.fail = () => new Response('down', { status: 503 });
  world.clock.advance(REFRESH_MS);
  for (let i = 0; i < 5; i += 1) {
    await world.app.tick();
    world.clock.advance(FAILURE_RETRY_MS);
  }
  assert.equal(world.api.count(), 3 + 5);
  assert.equal(lines.length, 1);
  assert.match(
    lines[0],
    /\[WARN\].*E-Control fuel prices cannot be read: E-Control answered HTTP 503/,
  );
  world.api.fail = null;
  await world.app.tick();
  assert.equal(lines.length, 2);
  assert.match(lines[1], /\[INFO\].*E-Control fuel prices answer again/);
});
