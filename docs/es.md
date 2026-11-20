# Precios de carburantes E-Control

Las gasolineras más baratas cerca de su casa en Austria, según el
[Spritpreisrechner](https://www.e-control.at/spritpreisrechner) de E-Control, el regulador austriaco
de la energía. Gratuito, sin cuenta ni clave. Sin relación con E-Control.

## Lo que obtiene

- Un dispositivo **Carburante más barato – Austria**: para cada carburante seguido (gasóleo,
  gasolina 95, GNC), el precio más bajo alrededor del punto de búsqueda, el nombre y la dirección
  de la gasolinera, y su distancia.
- Un disparador de escena **Bajada del precio más bajo**, con la gasolinera y el nuevo precio.
- Un widget de panel **Gasolineras más baratas**: el precio más bajo y la lista de las gasolineras
  más baratas.
- Una acción para probar el servicio desde la pantalla Configuración.

## Requisitos

- Gladys Assistant 5.3.0 o posterior.
- Su casa ubicada en el mapa de Gladys (Ajustes → Casas), o un código postal austriaco.
- Acceso a Internet desde Gladys: la integración consulta los servidores de E-Control.

## Instalación

En Gladys, abra **Integraciones → Instalar desde GitHub** e introduzca
`https://github.com/guim31/gladys-e-control`. Después abra la integración, rellene la
configuración y añada el dispositivo desde la pestaña **Descubrimiento**.

## Configuración

- **Carburantes a seguir**: gasóleo y gasolina 95 por defecto; también el GNC (gas natural, €/kg)
  si lo desea. Una solicitud por carburante cada 30 minutos.
- **Código postal austriaco (opcional)**: las gasolineras se buscan alrededor de él en lugar de la
  casa ubicada en Gladys (un lugar de trabajo, o una casa en otro país).
- **Idioma de los nombres**: el idioma de los nombres del dispositivo y sus funciones, escritos una
  vez al añadir el dispositivo, y de los textos del disparador y de la acción.

## Dispositivos

### Carburante más barato – Austria

Para cada carburante seguido, cuatro funciones:

- el precio en euros (por litro, por kilogramo para el GNC);
- el nombre de la gasolinera;
- su dirección;
- su distancia en km desde el punto de búsqueda.

El dispositivo es de solo lectura. Sus valores se guardan en el historial, salvo los textos.

## Escenas

### Precio por debajo de un umbral

No hace falta disparador: cree una escena con el disparador **Valor de un dispositivo** sobre la
función de precio, por ejemplo «Gasóleo (€/l) inferior a 1,90».

### Bajada del precio más bajo

Se activa cuando baja el precio más bajo de un carburante, con las variables **carburante**,
**nombre del carburante**, **gasolinera**, **nuevo precio**, **precio anterior** y **bajada**.
Filtre por uno o varios carburantes si lo desea. El primer precio tras la instalación o un cambio
de punto de búsqueda solo se memoriza.

## Panel

### Widget Gasolineras más baratas

Elija un carburante (el primero seguido por defecto). El widget muestra el precio más bajo, luego
hasta 5 gasolineras con su dirección, distancia y precio, y la hora de la última lectura. Un ajuste
oculta la lista.

## Acciones

**Probar el servicio de precios** consulta E-Control al instante y responde con el precio más bajo
de cada carburante. Falla en rojo cuando no hay punto de búsqueda, cuando el código postal es
desconocido, cuando no se encuentra ninguna gasolinera o cuando el servicio no responde.

## Datos y límites

- La ley austriaca obliga a las gasolineras a declarar sus precios; el Spritpreisrechner solo
  muestra las **más baratas** (5 por carburante): no se puede seguir una gasolinera concreta, y la
  API no conoce favoritos.
- En Austria, los precios solo pueden subir una vez al día, a mediodía; pueden bajar en cualquier
  momento.
- La integración consulta cada 30 minutos (15 minutos tras un fallo), lo que es moderado para un
  servicio público gratuito. Las gasolineras cerradas se descartan.
- La zona de búsqueda es la de E-Control: en el campo, la gasolinera de GNC más barata puede estar
  a 100 km.
- Fuera de Austria, E-Control no encuentra nada.

## Solución de problemas

- **«Ningún punto de búsqueda»**: ubique su casa en Gladys o introduzca un código postal.
- **«No es un código austriaco»**: compruebe las cuatro cifras (por ejemplo `6580`).
- **«No disponible»**: los servidores de E-Control no responden; la integración lo intenta de nuevo
  cada 15 minutos. Más detalles con `LOG_LEVEL=debug` en los registros de la integración.

## Créditos

Precios: E-Control, [Spritpreisrechner](https://www.e-control.at/spritpreisrechner). Integración
de guim31, licencia Apache-2.0. Sin relación con E-Control.
