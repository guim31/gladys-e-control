// -----------------------------------------------------------------------------
// The "Cheapest stations" dashboard widget: for one fuel (a setting, the first
// one followed by default), the lowest price as a tile, then the list of the
// cheapest stations E-Control gives (up to 5, a setting hides it): name,
// address and distance, the price as a badge; a caption with the search point
// and the time of the last read.
//
// Budget (core): 8 components, 2 texts — 1 tile, 1 card-list, 1 caption here.
// -----------------------------------------------------------------------------

import { FUELS, FUEL_KEYS } from './fuels.js';
import { MESSAGES, TEXT, formatKm, formatPrice, fuelName, pick, stationAddress } from './i18n.js';

export const WIDGET_KEY = 'cheapest_stations';
export const MAX_ITEMS = 5;

/** The content is cached by the core: the API is read every 30 minutes. */
export const WIDGET_TTL_SECONDS = 900;

const short = (value, max) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

/** The widget settings, normalized. */
export function normalizeSettings(settings = {}) {
  return {
    fuel: FUEL_KEYS.includes(settings.fuel) ? settings.fuel : null,
    showList: settings.show_list !== false,
  };
}

/**
 * Build the widget content.
 * @param {object} options
 * @param {string | null} options.fuel the fuel of the settings (null: the first followed)
 * @param {string[]} options.fuels the fuels followed
 * @param {Record<string, object[]>} options.results priced stations per fuel, cheapest first
 * @param {boolean} options.showList
 * @param {'ok' | 'waiting' | 'failing' | 'noPlace' | 'unknownPostalCode'} options.status
 * @param {string | null} options.place the postal code and place, null for the house
 * @param {number | null} options.readAt time of the last read
 * @param {string} options.language
 */
export function buildWidgetContent({
  fuel,
  fuels,
  results,
  showList,
  status,
  place,
  readAt,
  language,
}) {
  const components = [];
  const message = (text) => {
    components.push({ type: 'text', variant: 'body', text: pick(text, language) });
    return { ttl_seconds: WIDGET_TTL_SECONDS, components };
  };
  const shown = fuel ?? fuels[0];
  if (!fuels.includes(shown)) {
    return message(TEXT.notFollowed);
  }
  if (status !== 'ok') {
    return message(
      {
        waiting: TEXT.waiting,
        failing: TEXT.unreachable,
        noPlace: TEXT.noPlace,
        unknownPostalCode: TEXT.unknownPostalCode,
      }[status],
    );
  }
  const stations = results[shown] ?? [];
  if (stations.length === 0) {
    return message(TEXT.noStation);
  }
  components.push({
    type: 'value',
    label: fuelName(shown, language),
    value: Number(stations[0].price.toFixed(3)),
    unit: FUELS[shown].unit,
    icon: 'droplet',
    color: 'success',
  });
  if (showList) {
    components.push({
      type: 'card-list',
      display: 'list',
      items: stations.slice(0, MAX_ITEMS).map((station, index) => ({
        title: short(station.name, 60),
        subtitle: short(
          [
            stationAddress(station),
            station.distanceKm === null ? null : formatKm(station.distanceKm, language),
          ]
            .filter(Boolean)
            .join(' · '),
          120,
        ),
        badge: {
          text: formatPrice(station.price, language),
          color: index === 0 ? 'success' : 'neutral',
        },
      })),
    });
  }
  components.push({
    type: 'text',
    variant: 'caption',
    text: short(pick(MESSAGES.caption(place, readAt), language), 80),
  });
  return { ttl_seconds: WIDGET_TTL_SECONDS, components };
}
