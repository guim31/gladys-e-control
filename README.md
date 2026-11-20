# E-Control fuel prices for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com): the cheapest fuel
stations around your home in **Austria**, from the
[Spritpreisrechner](https://www.e-control.at/spritpreisrechner) of E-Control, the Austrian energy
regulator, without account nor key. User documentation: [English](docs/en.md),
[français](docs/fr.md), [Deutsch](docs/de.md), [español](docs/es.md).

## Features

- A **Cheapest fuel – Austria** device: per fuel followed (diesel, Super 95, CNG), the lowest price
  around the house located in Gladys or an Austrian postal code, the name, address and distance of
  the station.
- A **Fuel price drop** scene trigger (fuel filter; station, new price, previous price and drop as
  variables). A threshold is a plain Gladys scene on a price feature.
- A **Cheapest stations** dashboard widget: the lowest price of a fuel and the list of the cheapest
  stations (up to 5), with address, distance and price.
- A **Test the price service** action.
- Texts in English, French, German and Spanish.

## Requirements

- Gladys Assistant 5.3.0 or later, with Internet access.
- The house located in Gladys (the integration declares `location: true`), or an Austrian postal
  code in the configuration.

## Installation

In Gladys, **Integrations → Install from GitHub**, address
`https://github.com/guim31/gladys-e-control`, then choose the fuels, and add the device from the
Discovery tab.

## How it works

- `GET https://api.e-control.at/sprit/1.0/search/gas-stations/by-address` with the position, the
  fuel (`DIE`, `SUP`, `GAS`) and `includeClosed=false`: up to 10 open stations, the 5 cheapest with
  their price. One request per fuel every 30 minutes (15 minutes after a failure).
- `GET …/regions/units` once, when a postal code is configured: the position of every Austrian
  postal code.
- No core polling: the container has its own timer and publishes only the values that change.

## Limitations

- The Spritpreisrechner only gives the cheapest stations: a given station cannot be followed
  (`/gas-stations/{id}` requires an account), hence no "favourite station" device.
- One search point per installation (the first located house, or the postal code).
- The search area is the one of the API: the cheapest CNG station can be 100 km away in the
  countryside. Nothing outside Austria.

## Development

```bash
npm ci
npm run format:check
npm run lint
npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests run against the SDK's fake Gladys and a fake API serving real answers of 20/11/2026
(`test/fixtures/`, Vienna and St. Anton am Arlberg), never the network. See
[`CLAUDE.md`](CLAUDE.md) for the project rules. Versions, images and releases belong to the Release
workflow (Actions → Release).

## Credits

- Prices: E-Control (Energie-Control Austria),
  [Spritpreisrechner](https://www.e-control.at/spritpreisrechner).
- Cover: the E-Control logo, from [www.e-control.at](https://www.e-control.at), a trademark of
  E-Control.
- The architecture and tests follow
  [gladys-fuel-es-it](https://github.com/guim31/gladys-fuel-es-it).

## Disclaimer

This project is not affiliated with, endorsed or sponsored by E-Control.
