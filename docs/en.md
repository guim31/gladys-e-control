# E-Control fuel prices

The cheapest fuel stations around your home in Austria, from the
[Spritpreisrechner](https://www.e-control.at/spritpreisrechner) of E-Control, the Austrian energy
regulator. Free, without account or key. Not affiliated with E-Control.

## What you get

- A **Cheapest fuel – Austria** device: for each fuel followed (diesel, Super 95, CNG), the lowest
  price around the search point, the name and address of the station, and its distance.
- A **Fuel price drop** scene trigger, with the station and the new price.
- A **Cheapest stations** dashboard widget: the lowest price and the list of the cheapest
  stations.
- An action to test the service from the Configuration screen.

## Requirements

- Gladys Assistant 5.3.0 or later.
- Your house located on the map in Gladys (Settings → Houses), or an Austrian postal code.
- Internet access from Gladys: the integration asks the E-Control servers.

## Installation

In Gladys, open **Integrations → Install from GitHub** and enter
`https://github.com/guim31/gladys-e-control`. Then open the integration, fill in the
configuration, and add the device from the **Discovery** tab.

## Configuration

- **Fuels to follow**: diesel and Super 95 by default; CNG (natural gas, €/kg) too if you wish. One
  request per fuel every 30 minutes.
- **Austrian postal code (optional)**: the stations are searched around it instead of around the
  house located in Gladys (for example a workplace, or a house in another country).
- **Language of the names**: the language of the device and feature names, written once when the
  device is added, and of the texts of the trigger and the action.

## Devices

### Cheapest fuel – Austria

For each fuel followed, four features:

- the price in euros (per litre, per kilogram for CNG);
- the name of the station;
- its address;
- its distance in km from the search point.

The device is read only. Its values are kept in the history, except the texts.

## Scenes

### Price under a threshold

No trigger is needed: create a scene with the **Device value** trigger on the price feature, for
example "Diesel (€/l) below 1.90".

### Fuel price drop

Fires when the lowest price of a fuel falls, with the variables **fuel**, **fuel name**,
**station**, **new price**, **previous price** and **drop**. Filter on one or more fuels if you
wish. The first price after an installation or a change of search point is only remembered.

## Dashboard

### Cheapest stations widget

Choose a fuel (the first one followed by default). The widget shows the lowest price, then up to 5
stations with their address, distance and price, and the time of the last read. A setting hides
the list.

## Actions

**Test the price service** asks E-Control at once and answers with the lowest price of each fuel.
It fails in red when no search point is set, when the postal code is unknown, when no station is
found or when the service cannot be reached.

## Data and limits

- Austrian law obliges stations to report their prices; the Spritpreisrechner only shows the
  **cheapest ones** (5 per fuel), so a given station cannot be followed and the API gives no
  favourites.
- In Austria, prices may only rise once a day, at noon; they may fall at any time.
- The integration asks every 30 minutes (15 minutes after a failure), which stays gentle with a
  free public service. Closed stations are left out.
- The search area is the one of E-Control: in the countryside, the cheapest CNG station may be
  100 km away.
- Outside Austria, E-Control finds nothing.

## Troubleshooting

- **"No search point"**: locate your house in Gladys, or enter a postal code.
- **"Not an Austrian postal code"**: check the four digits (for example `6580`).
- **"Cannot be reached"**: the E-Control servers do not answer; the integration tries again every
  15 minutes. More details with `LOG_LEVEL=debug` in the logs of the integration.

## Credits

Prices: E-Control, [Spritpreisrechner](https://www.e-control.at/spritpreisrechner). Integration by
guim31, Apache-2.0 licence. Not affiliated with E-Control.
