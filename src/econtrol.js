// -----------------------------------------------------------------------------
// Client of the Spritpreisrechner API of E-Control, the Austrian energy
// regulator (https://api.e-control.at/sprit/1.0, JSON, no key).
//
//   GET /search/gas-stations/by-address?latitude=&longitude=&fuelType=&includeClosed=false
//     up to 10 open stations around a point, nearest area first: the 5
//     cheapest carry their price (`prices[0].amount`), the others none (the
//     Austrian law only requires the cheapest to be shown). `distance` is in
//     km from the point. An empty array outside Austria.
//   GET /regions/units
//     the federal states, their districts and postal codes with a position
//     (`p` postal code, `n` place, `b` latitude, `l` longitude), ~140 kB.
//
// `GET /gas-stations/{id}` answers 401 (account only): a single station cannot
// be followed, hence no "favourite station" device.
// -----------------------------------------------------------------------------

import { FUELS } from './fuels.js';

export const BASE_URL = 'https://api.e-control.at/sprit/1.0';
export const UNITS_URL = `${BASE_URL}/regions/units`;
export const TIMEOUT_MS = 15 * 1000;

/** A failure of the source, with a short English message for the logs. */
export class SourceError extends Error {}

/** The URL of the search around a point for a fuel key. */
export function searchUrl(position, fuel) {
  const query = new URLSearchParams({
    latitude: String(position.lat),
    longitude: String(position.lon),
    fuelType: FUELS[fuel].code,
    includeClosed: 'false',
  });
  return `${BASE_URL}/search/gas-stations/by-address?${query}`;
}

async function getJson(fetchImpl, url) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const code = err.cause?.code ?? err.name;
    throw new SourceError(`E-Control unreachable (${code ?? err.message})`);
  }
  if (!response.ok) {
    throw new SourceError(`E-Control answered HTTP ${response.status}`);
  }
  try {
    return await response.json();
  } catch {
    throw new SourceError('E-Control answered something else than JSON');
  }
}

const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/**
 * The priced stations of a search, cheapest first (equal prices: the nearest).
 * @returns {{ id: number, name: string, address: string, postalCode: string,
 *   city: string, distanceKm: number | null, price: number }[]}
 */
export function parseStations(list, fuel) {
  if (!Array.isArray(list)) {
    throw new SourceError('E-Control answered an unexpected document');
  }
  const code = FUELS[fuel].code;
  const stations = [];
  for (const item of list) {
    const price = finite(
      (Array.isArray(item?.prices) ? item.prices : []).find((p) => p?.fuelType === code)?.amount,
    );
    // A price of 0 or a typo would become the cheapest: plausible ones only.
    if (price === null || price <= 0.2 || price >= 5 || item.open === false) {
      continue;
    }
    const location = item.location ?? {};
    const distance = finite(item.distance);
    stations.push({
      id: Number(item.id),
      name: String(item.name ?? '').trim() || `#${item.id}`,
      address: String(location.address ?? '').trim(),
      postalCode: String(location.postalCode ?? '').trim(),
      city: String(location.city ?? '').trim(),
      distanceKm: distance === null ? null : Math.round(distance * 10) / 10,
      price,
    });
  }
  return stations.sort(
    (a, b) => a.price - b.price || (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
  );
}

/** The cheapest stations of a fuel around a point. */
export async function searchStations(fetchImpl, position, fuel) {
  return parseStations(await getJson(fetchImpl, searchUrl(position, fuel)), fuel);
}

/**
 * The Austrian postal codes and their position.
 * @returns {Promise<Map<string, { lat: number, lon: number, place: string }>>}
 */
export async function loadPostalCodes(fetchImpl) {
  const states = await getJson(fetchImpl, UNITS_URL);
  if (!Array.isArray(states)) {
    throw new SourceError('E-Control answered an unexpected list of regions');
  }
  const codes = new Map();
  for (const state of states) {
    for (const district of state?.b ?? []) {
      for (const unit of district?.g ?? []) {
        const lat = finite(unit?.b);
        const lon = finite(unit?.l);
        if (typeof unit?.p === 'string' && lat !== null && lon !== null && !codes.has(unit.p)) {
          codes.set(unit.p, { lat, lon, place: String(unit.n ?? '') });
        }
      }
    }
  }
  if (codes.size === 0) {
    throw new SourceError('E-Control answered an empty list of postal codes');
  }
  return codes;
}
