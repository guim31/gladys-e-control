# Prix des carburants E-Control

Les stations les moins chères autour de chez vous en Autriche, d’après le
[Spritpreisrechner](https://www.e-control.at/spritpreisrechner) d’E-Control, le régulateur
autrichien de l’énergie. Gratuit, sans compte ni clé. Sans lien avec E-Control.

## Ce que vous obtenez

- Un appareil **Carburant le moins cher – Autriche** : pour chaque carburant suivi (gazole, sans
  plomb 95, GNV), le prix le plus bas autour du point de recherche, le nom et l’adresse de la
  station, et sa distance.
- Un déclencheur de scène **Baisse du prix le plus bas**, avec la station et le nouveau prix.
- Un widget de tableau de bord **Stations les moins chères** : le prix le plus bas et la liste des
  stations les moins chères.
- Une action pour tester le service depuis l’écran Configuration.

## Prérequis

- Gladys Assistant 5.3.0 ou plus récent.
- Votre maison placée sur la carte dans Gladys (Paramètres → Maisons), ou un code postal
  autrichien.
- Un accès à Internet depuis Gladys : l’intégration interroge les serveurs d’E-Control.

## Installation

Dans Gladys, ouvrez **Intégrations → Installer depuis GitHub** et saisissez
`https://github.com/guim31/gladys-e-control`. Ouvrez ensuite l’intégration, remplissez la
configuration, et ajoutez l’appareil depuis l’onglet **Découverte**.

## Configuration

- **Carburants à suivre** : gazole et sans plomb 95 par défaut ; le GNV (gaz naturel, €/kg) aussi
  si vous le souhaitez. Une requête par carburant toutes les 30 minutes.
- **Code postal autrichien (facultatif)** : les stations sont cherchées autour de lui plutôt
  qu’autour de la maison placée dans Gladys (un lieu de travail, ou une maison dans un autre pays).
- **Langue des noms** : la langue des noms de l’appareil et de ses fonctionnalités, écrits une fois
  à l’ajout de l’appareil, et des textes du déclencheur et de l’action.

## Appareils

### Carburant le moins cher – Autriche

Pour chaque carburant suivi, quatre fonctionnalités :

- le prix en euros (au litre, au kilogramme pour le GNV) ;
- le nom de la station ;
- son adresse ;
- sa distance en km depuis le point de recherche.

L’appareil est en lecture seule. Ses valeurs sont gardées dans l’historique, sauf les textes.

## Scènes

### Prix sous un seuil

Pas besoin de déclencheur : créez une scène avec le déclencheur **Valeur d’un appareil** sur la
fonctionnalité de prix, par exemple « Gazole (€/l) inférieur à 1,90 ».

### Baisse du prix le plus bas

Se déclenche quand le prix le plus bas d’un carburant baisse, avec les variables **carburant**,
**nom du carburant**, **station**, **nouveau prix**, **prix précédent** et **baisse**. Filtrez sur
un ou plusieurs carburants si vous le souhaitez. Le premier prix après l’installation ou un
changement de point de recherche est seulement mémorisé.

## Tableau de bord

### Widget Stations les moins chères

Choisissez un carburant (le premier suivi par défaut). Le widget affiche le prix le plus bas, puis
jusqu’à 5 stations avec leur adresse, leur distance et leur prix, et l’heure de la dernière
lecture. Un réglage masque la liste.

## Actions

**Tester le service des prix** interroge E-Control tout de suite et répond avec le prix le plus bas
de chaque carburant. Elle échoue en rouge quand aucun point de recherche n’est défini, quand le
code postal est inconnu, quand aucune station n’est trouvée ou quand le service est injoignable.

## Données et limites

- La loi autrichienne oblige les stations à déclarer leurs prix ; le Spritpreisrechner ne montre
  que les **moins chères** (5 par carburant) : une station précise ne peut pas être suivie, et
  l’API ne connaît pas de favoris.
- En Autriche, les prix ne peuvent monter qu’une fois par jour, à midi ; ils peuvent baisser à tout
  moment.
- L’intégration interroge toutes les 30 minutes (15 minutes après un échec), ce qui reste doux pour
  un service public gratuit. Les stations fermées sont écartées.
- La zone de recherche est celle d’E-Control : à la campagne, la station GNV la moins chère peut
  être à 100 km.
- Hors d’Autriche, E-Control ne trouve rien.
- Pendant une panne, ou quand plus aucune station ne vend un carburant, l’appareil garde ses
  dernières valeurs : l’écran Configuration et le widget le signalent.

## Dépannage

- **« Aucun point de recherche »** : placez votre maison dans Gladys, ou saisissez un code postal.
- **« Ce code postal n’est pas un code autrichien connu d’E-Control »** : vérifiez les quatre chiffres (par exemple `6580`).
- **« Le service des prix des carburants d’E-Control est injoignable »** : les serveurs d’E-Control ne répondent pas ; l’intégration réessaie toutes
  les 15 minutes. Plus de détails avec `LOG_LEVEL=debug` dans les journaux de l’intégration.

## Crédits

Prix : E-Control, [Spritpreisrechner](https://www.e-control.at/spritpreisrechner). Intégration par
guim31, licence Apache-2.0. Sans lien avec E-Control.
