// -----------------------------------------------------------------------------
// The three fuels of the Spritpreisrechner. The keys are stored by Gladys
// (feature external ids, trigger filters): they never change. `code` is the
// `fuelType` of the E-Control API.
// -----------------------------------------------------------------------------

export const FUELS = {
  diesel: {
    code: 'DIE',
    unit: '€/l',
    name: { en: 'Diesel', fr: 'Gazole', de: 'Diesel', es: 'Gasóleo' },
  },
  super: {
    code: 'SUP',
    unit: '€/l',
    name: { en: 'Super 95', fr: 'Sans plomb 95', de: 'Super 95', es: 'Gasolina 95' },
  },
  cng: {
    code: 'GAS',
    unit: '€/kg',
    name: { en: 'CNG', fr: 'GNV', de: 'Erdgas (CNG)', es: 'GNC' },
  },
};

export const FUEL_KEYS = Object.keys(FUELS);
