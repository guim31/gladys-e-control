// -----------------------------------------------------------------------------
// The device and its states.
//
// "Cheapest fuel – Austria" (one device, key "cheapest:at"), per fuel
// followed: the lowest price the Spritpreisrechner gives around the search
// point, the station, its address and its distance:
//   currency/decimal + euro   <fuel>_price
//   text/text                 <fuel>_station    name of the station
//   text/text                 <fuel>_address    street, postal code and place
//   distance-sensor/decimal   <fuel>_distance   km from the search point
//
// "Price under a threshold" is a plain Gladys scene on a price feature; a drop
// is the integration's trigger (src/app.js). No core polling: the container
// reads the API on its own timer. Ids must never change.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { FUELS } from './fuels.js';
import { NAMES, fuelName, stationAddress } from './i18n.js';

export const CHEAPEST = 'cheapest';
export const COUNTRY = 'at';

/** Display bounds of a price, €/l or €/kg (the highest seen are about 2.5 €). */
export const PRICE_MAX = 5;
/** The API looks far for CNG: 120 km around a village of the Arlberg. */
export const DISTANCE_MAX = 200;

export const cheapestIds = (gladys) => gladys.externalIds(CHEAPEST, COUNTRY);

const base = { read_only: true, has_feedback: false, keep_history: true };

const feature = (ids, key, name, definition) => ({
  ...base,
  ...definition,
  name,
  external_id: ids.feature(key),
});

// A text: no history, min/max NOT NULL in the core.
const text = {
  category: DEVICE_FEATURE_CATEGORIES.TEXT,
  type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
  keep_history: false,
  min: 0,
  max: 0,
};

/** The cheapest device, with the features of the fuels followed. */
export function buildCheapestDevice(gladys, config) {
  const ids = cheapestIds(gladys);
  const names = NAMES[config.language] ?? NAMES.fr;
  return {
    name: names.cheapest,
    external_id: ids.device,
    should_poll: false,
    features: config.fuels.flatMap((fuel) => {
      const label = fuelName(fuel, config.language);
      return [
        feature(ids, `${fuel}_price`, names.price(label, FUELS[fuel].unit), {
          category: DEVICE_FEATURE_CATEGORIES.CURRENCY,
          type: DEVICE_FEATURE_TYPES.CURRENCY.DECIMAL,
          unit: DEVICE_FEATURE_UNITS.EURO,
          min: 0,
          max: PRICE_MAX,
        }),
        feature(ids, `${fuel}_station`, names.station(label), text),
        feature(ids, `${fuel}_address`, names.address(label), text),
        feature(ids, `${fuel}_distance`, names.distance(label), {
          category: DEVICE_FEATURE_CATEGORIES.DISTANCE_SENSOR,
          // The SDK has no constant for this type (the core does: distance-sensor/decimal).
          type: 'decimal',
          unit: DEVICE_FEATURE_UNITS.KM,
          min: 0,
          max: DISTANCE_MAX,
        }),
      ];
    }),
  };
}

/**
 * The states of the cheapest device.
 * @param {Record<string, object[]>} results the priced stations per fuel, cheapest first
 */
export function cheapestStates(gladys, config, results) {
  const ids = cheapestIds(gladys);
  const states = [];
  for (const fuel of config.fuels) {
    const best = results[fuel]?.[0];
    if (!best) {
      continue;
    }
    states.push(
      { device_feature_external_id: ids.feature(`${fuel}_price`), state: best.price },
      { device_feature_external_id: ids.feature(`${fuel}_station`), text: best.name.slice(0, 200) },
    );
    // Never the address of the previous station: a dash when E-Control has none.
    states.push({
      device_feature_external_id: ids.feature(`${fuel}_address`),
      text: (stationAddress(best) || '–').slice(0, 200),
    });
    if (best.distanceKm !== null) {
      states.push({
        device_feature_external_id: ids.feature(`${fuel}_distance`),
        state: Math.min(best.distanceKm, DISTANCE_MAX),
      });
    }
  }
  return states;
}
