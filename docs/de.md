# E-Control Spritpreise

Die günstigsten Tankstellen rund um dein Zuhause in Österreich, aus dem
[Spritpreisrechner](https://www.e-control.at/spritpreisrechner) der E-Control, der österreichischen
Regulierungsbehörde für Energie. Kostenlos, ohne Konto und ohne Schlüssel. Nicht mit E-Control
verbunden.

## Was du bekommst

- Ein Gerät **Günstigster Kraftstoff – Österreich**: für jeden verfolgten Kraftstoff (Diesel,
  Super 95, CNG) der niedrigste Preis rund um den Suchort, Name und Adresse der Tankstelle und ihre
  Entfernung.
- Einen Szenen-Auslöser **Günstigster Preis gesunken**, mit der Tankstelle und dem neuen Preis.
- Ein Dashboard-Widget **Günstigste Tankstellen**: der niedrigste Preis und die Liste der
  günstigsten Tankstellen.
- Eine Aktion, um den Dienst im Konfigurationsbildschirm zu testen.

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer.
- Dein Haus auf der Karte in Gladys verortet (Einstellungen → Häuser) oder eine österreichische
  Postleitzahl.
- Internetzugang für Gladys: die Integration fragt die Server der E-Control ab.

## Installation

Öffne in Gladys **Integrationen → Von GitHub installieren** und gib
`https://github.com/guim31/gladys-e-control` ein. Öffne dann die Integration, fülle die
Konfiguration aus und füge das Gerät im Tab **Erkennung** hinzu.

## Konfiguration

- **Verfolgte Kraftstoffe**: standardmäßig Diesel und Super 95; auf Wunsch auch CNG (Erdgas,
  €/kg). Eine Anfrage je Kraftstoff alle 30 Minuten.
- **Österreichische Postleitzahl (optional)**: gesucht wird rund um sie statt um das in Gladys
  verortete Haus (etwa ein Arbeitsort oder ein Haus in einem anderen Land).
- **Sprache der Namen**: die Sprache der Namen des Geräts und seiner Funktionen, einmal beim
  Hinzufügen geschrieben, und der Texte des Auslösers und der Aktion.

## Geräte

### Günstigster Kraftstoff – Österreich

Für jeden verfolgten Kraftstoff vier Funktionen:

- der Preis in Euro (pro Liter, pro Kilogramm bei CNG);
- der Name der Tankstelle;
- ihre Adresse;
- ihre Entfernung in km vom Suchort.

Das Gerät ist nur lesbar. Seine Werte bleiben im Verlauf, außer den Texten.

## Szenen

### Preis unter einer Schwelle

Kein Auslöser nötig: erstelle eine Szene mit dem Auslöser **Gerätewert** auf der Preisfunktion,
zum Beispiel „Diesel (€/l) unter 1,90“.

### Günstigster Preis gesunken

Löst aus, wenn der niedrigste Preis eines Kraftstoffs sinkt, mit den Variablen **Kraftstoff**,
**Kraftstoffname**, **Tankstelle**, **neuer Preis**, **vorheriger Preis** und **Rückgang**. Filtere
auf Wunsch nach einem oder mehreren Kraftstoffen. Der erste Preis nach der Installation oder einem
Wechsel des Suchorts wird nur gemerkt.

## Dashboard

### Widget Günstigste Tankstellen

Wähle einen Kraftstoff (standardmäßig den ersten verfolgten). Das Widget zeigt den niedrigsten
Preis, dann bis zu 5 Tankstellen mit Adresse, Entfernung und Preis sowie die Uhrzeit der letzten
Abfrage. Eine Einstellung blendet die Liste aus.

## Aktionen

**Preisdienst testen** fragt E-Control sofort ab und antwortet mit dem niedrigsten Preis jedes
Kraftstoffs. Rot schlägt die Aktion fehl, wenn kein Suchort festgelegt ist, die Postleitzahl unbekannt
ist, keine Tankstelle gefunden wird oder der Dienst nicht erreichbar ist.

## Daten und Grenzen

- Das österreichische Gesetz verpflichtet die Tankstellen, ihre Preise zu melden; der
  Spritpreisrechner zeigt nur die **günstigsten** (5 je Kraftstoff): eine bestimmte Tankstelle
  lässt sich nicht verfolgen, und die API kennt keine Favoriten.
- In Österreich dürfen die Preise nur einmal am Tag steigen, um 12 Uhr; sinken dürfen sie
  jederzeit.
- Die Integration fragt alle 30 Minuten ab (15 Minuten nach einem Fehler), schonend für einen
  kostenlosen öffentlichen Dienst. Geschlossene Tankstellen werden ausgelassen.
- Das Suchgebiet ist das der E-Control: auf dem Land kann die günstigste CNG-Tankstelle 100 km
  entfernt sein.
- Außerhalb Österreichs findet E-Control nichts.

## Fehlerbehebung

- **„Kein Suchort“**: verorte dein Haus in Gladys oder gib eine Postleitzahl ein.
- **„Keine österreichische Postleitzahl“**: prüfe die vier Ziffern (zum Beispiel `6580`).
- **„Nicht erreichbar“**: die Server der E-Control antworten nicht; die Integration versucht es
  alle 15 Minuten erneut. Mehr Details mit `LOG_LEVEL=debug` in den Protokollen der Integration.

## Danksagung

Preise: E-Control, [Spritpreisrechner](https://www.e-control.at/spritpreisrechner). Integration
von guim31, Lizenz Apache-2.0. Nicht mit E-Control verbunden.
