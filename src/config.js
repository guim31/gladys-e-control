// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys from the `config_schema` of
// `gladys-assistant-integration.json`. This module provides the defaults and
// normalizes the received object, so the rest of the code never deals with
// `undefined` or with a value typed by hand with stray spaces. The search
// point is the Gladys house (getHouses()), or an Austrian postal code.
// -----------------------------------------------------------------------------

import { FUEL_KEYS } from './fuels.js';

/** The languages of the Gladys interface, every text exists in all four. */
export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  // Fuels followed: one API request each per refresh.
  fuels: ['diesel', 'super'],
  // An Austrian postal code searched around instead of the house (optional).
  postal_code: '',
  // Language of the device and feature names (frozen when a device is added)
  // and of the texts the container produces (trigger, action).
  language: 'fr',
};

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const language = String(raw.language ?? DEFAULT_CONFIG.language);
  const list = Array.isArray(raw.fuels)
    ? raw.fuels
    : typeof raw.fuels === 'string'
      ? raw.fuels.split(',')
      : null;
  const chosen = list
    ? [...new Set(list.map((id) => String(id).trim()))].filter((id) => FUEL_KEYS.includes(id))
    : DEFAULT_CONFIG.fuels;
  return {
    // In the order of the code, whatever the order of the form; none at all
    // would leave the device without a price: the defaults then.
    fuels: chosen.length > 0 ? FUEL_KEYS.filter((id) => chosen.includes(id)) : DEFAULT_CONFIG.fuels,
    // "A-6580", " 6580 " → "6580"; anything else is kept and reported as unknown.
    postalCode: String(raw.postal_code ?? '')
      .trim()
      .replace(/^A\s*-\s*/i, ''),
    language: LANGUAGES.includes(language) ? language : DEFAULT_CONFIG.language,
  };
}
