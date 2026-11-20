// -----------------------------------------------------------------------------
// Every text the integration shows, in the four languages of the Gladys
// interface (en, fr, de, es). German says "du", Spanish says "usted", like the
// rest of guim31's integrations. Brands, station and place names stay as is.
//
//   - NAMES    : device and feature names, written once in the language of
//                the configuration (Gladys freezes them when a device is added);
//   - TEXT     : the fixed texts (widget, configuration screen, actions);
//   - MESSAGES : the texts built from a value, numbers in the local format.
//
// test/i18n.test.js checks that every entry carries exactly the four
// languages, with no empty text and no polite German.
// -----------------------------------------------------------------------------

import { LANGUAGES } from './config.js';
import { FUELS } from './fuels.js';

export { LANGUAGES };

/** Device and feature names, by language then key. */
export const NAMES = {
  en: {
    cheapest: 'Cheapest fuel – Austria',
    price: (fuel, unit) => `${fuel} (${unit})`,
    station: (fuel) => `${fuel}, station`,
    address: (fuel) => `${fuel}, address`,
    distance: (fuel) => `${fuel}, distance`,
  },
  fr: {
    cheapest: 'Carburant le moins cher – Autriche',
    price: (fuel, unit) => `${fuel} (${unit})`,
    station: (fuel) => `${fuel}, station`,
    address: (fuel) => `${fuel}, adresse`,
    distance: (fuel) => `${fuel}, distance`,
  },
  de: {
    cheapest: 'Günstigster Kraftstoff – Österreich',
    price: (fuel, unit) => `${fuel} (${unit})`,
    station: (fuel) => `${fuel}, Tankstelle`,
    address: (fuel) => `${fuel}, Adresse`,
    distance: (fuel) => `${fuel}, Entfernung`,
  },
  es: {
    cheapest: 'Carburante más barato – Austria',
    price: (fuel, unit) => `${fuel} (${unit})`,
    station: (fuel) => `${fuel}, gasolinera`,
    address: (fuel) => `${fuel}, dirección`,
    distance: (fuel) => `${fuel}, distancia`,
  },
};

/** Fixed texts. */
export const TEXT = {
  waiting: {
    en: 'Waiting for the first prices…',
    fr: 'En attente des premiers prix…',
    de: 'Warte auf die ersten Preise …',
    es: 'Esperando los primeros precios…',
  },
  unreachable: {
    en: 'The E-Control fuel price service cannot be reached right now.',
    fr: 'Le service des prix des carburants d’E-Control est injoignable pour le moment.',
    de: 'Der Spritpreisrechner von E-Control ist gerade nicht erreichbar.',
    es: 'El servicio de precios de E-Control no está disponible en este momento.',
  },
  noPlace: {
    en: 'No search point: locate your house in Gladys or enter an Austrian postal code.',
    fr: 'Aucun point de recherche : placez votre maison dans Gladys ou saisissez un code postal autrichien.',
    de: 'Kein Suchort: lege den Standort deines Hauses in Gladys fest oder gib eine österreichische Postleitzahl ein.',
    es: 'Ningún punto de búsqueda: ubique su casa en Gladys o introduzca un código postal austriaco.',
  },
  unknownPostalCode: {
    en: 'This postal code is not an Austrian one known to E-Control.',
    fr: 'Ce code postal n’est pas un code autrichien connu d’E-Control.',
    de: 'Diese Postleitzahl ist keine österreichische, die E-Control kennt.',
    es: 'Este código postal no es un código austriaco conocido por E-Control.',
  },
  noStation: {
    en: 'No station found: is the search point in Austria?',
    fr: 'Aucune station trouvée : le point de recherche est-il en Autriche ?',
    de: 'Keine Tankstelle gefunden: liegt der Suchort in Österreich?',
    es: 'No se encontró ninguna gasolinera: ¿está el punto de búsqueda en Austria?',
  },
  notFollowed: {
    en: 'This fuel is not followed: add it in the configuration.',
    fr: 'Ce carburant n’est pas suivi : ajoutez-le dans la configuration.',
    de: 'Dieser Kraftstoff wird nicht verfolgt: füge ihn in der Konfiguration hinzu.',
    es: 'Este carburante no se sigue: añádalo en la configuración.',
  },
  initFailed: {
    en: 'The integration could not start: see its logs.',
    fr: 'L’intégration n’a pas pu démarrer : voir ses journaux.',
    de: 'Die Integration konnte nicht starten: siehe ihre Protokolle.',
    es: 'La integración no pudo iniciarse: consulte sus registros.',
  },
};

/** Pick a language in a multi-language object, English as a fallback. */
export const pick = (texts, language) => texts[language] ?? texts.en;

export const fuelName = (fuel, language) => pick(FUELS[fuel].name, language);

/** "1.984 €" / "1,984 €": three decimals, as E-Control publishes them. */
export const formatPrice = (value, language) =>
  new Intl.NumberFormat(language, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);

/** "2.5 km" / "2,5 km" */
export const formatKm = (value, language) =>
  `${new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value)} km`;

/** A read time in the time zone of Gladys (TZ): "20 Nov 2026, 22:25". */
export const formatTime = (ms, language, timeZone = process.env.TZ || undefined) =>
  new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(
    new Date(ms),
  );

/** "Währinger Gürtel 116, 1090 Wien", or "" without an address. */
export const stationAddress = (station) =>
  [station.address, [station.postalCode, station.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');

const each = (build) =>
  Object.fromEntries(LANGUAGES.map((language) => [language, build(language)]));

/** The search point in words: "around the house" or "around 6580 St. Anton am Arlberg". */
const around = (place, l) =>
  place
    ? pick({ en: 'around', fr: 'autour de', de: 'rund um', es: 'alrededor de' }, l) + ` ${place}`
    : pick(
        {
          en: 'around the house',
          fr: 'autour de la maison',
          de: 'rund ums Haus',
          es: 'alrededor de la casa',
        },
        l,
      );

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** Texts built from values, in the four languages. */
export const MESSAGES = {
  /** Widget caption: "Around the house · 20 Nov 2026, 22:25". */
  caption: (place, readAt) =>
    each((l) => {
      const where = capitalize(around(place, l));
      return readAt === null ? where : `${where} · ${formatTime(readAt, l)}`;
    }),

  /** The answer of the "Test the price service" action. */
  testOk: ({ place, results }) =>
    each((l) => {
      const found = Object.entries(results)
        .map(([fuel, stations]) =>
          stations.length > 0
            ? `${fuelName(fuel, l)} ${formatPrice(stations[0].price, l)} (${stations[0].name})`
            : `${fuelName(fuel, l)} –`,
        )
        .join(', ');
      return `${pick(
        {
          en: 'Cheapest',
          fr: 'Les moins chers',
          de: 'Am günstigsten',
          es: 'Los más baratos',
        },
        l,
      )} ${around(place, l)}${l === 'fr' ? ' :' : ':'} ${found}.`;
    }),
};
