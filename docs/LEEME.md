# Panel Maipo Vigía — cómo se abre, se publica y se actualiza

**Qué es.** El panel de datos del pluviómetro comunitario del Cajón del Maipo: la última
lectura de lluvia al frente, el acumulado de 24 h, el estado del dato, el registro completo
con gráfico y tabla, la serie histórica y las descargas CSV y JSON.

**Qué no es.** No hay servidor, no hay base de datos, no hay formulario en línea y no recibe
mediciones en vivo: es una **copia estática** de la última publicación. Hay un solo punto
propuesto y todavía no está instalado. Todo lo que se ve son **datos simulados para prueba**.

---

## 1. Abrirla

Doble clic en `index.html`. Funciona sin internet desde el disco: las tipografías, los datos
y el gráfico están en esta misma carpeta. Es a propósito — el proyecto completo se trata de
que el registro sobreviva cuando no hay conexión.

Para verla servida (por ejemplo, para probar en el celular dentro de la misma red):

```bash
cd sitio
python3 -m http.server 8811
# abrir http://127.0.0.1:8811/
```

En los dos casos la página hace **cero peticiones externas**: solo pide archivos de esta
carpeta. No hay CDN, ni fuentes remotas, ni analítica, ni claves en el navegador.

## 2. Publicarla

**Está publicada** en GitHub Pages desde la carpeta `docs/` del repositorio
`MaipuSeguritos`, en `https://drchifuu.github.io/MaipuSeguritos/`. El informe de la
Unidad 2 había declarado la forma `https://<cuenta>.github.io/maipo-vigia/`; se eligió la
carpeta `docs/` del repositorio que ya existía, así que la dirección publicada es la de
este repositorio y no la que el informe prometió.

Para republicar después de un cambio:

```bash
cd panel-web
python3 publicar.py            # regenera los datos, revisa el sitio y copia a docs/
cd ../MaipuSeguritos
git add docs && git commit -m "Publica el panel Maipo Vigía"
git push origin main           # Pages reconstruye el sitio en uno o dos minutos
```

`publicar.py` no hace commit: deja la copia revisada y recuerda el comando. La dirección
publicada solo cambia cuando el commit llega a `main`.

## 3. Actualizar los datos

Los datos viven en dos archivos:

```
sitio/datos/registros.js     → estación, publicación y las mediciones
sitio/datos/historicos.js    → la serie histórica (hoy ficticia)
```

Son `.js` y no `.json` a propósito: así la página funciona abierta desde el disco, sin
servidor.

### La forma del archivo de registros

`window.REGISTROS` **es un objeto** con cuatro metadatos y el arreglo de registros en
`measurements`. La forma la define un solo módulo, `panel-web/datos/formato_panel.py`,
que comparten el simulador y el importador:

```js
window.REGISTROS = {
  "label": "Datos simulados para prueba. No corresponden a una medición real.",
  "generated_at": "2026-11-15T02:45:00-03:00",  // cuándo se armó el archivo
  "published_at": "2026-11-15T02:43:00-03:00",  // la última publicación declarada
  "station": { id, name, sector, commune, region, zone,
               elevation_m, interval_min, unit },
  "measurements": [ { …los once campos… }, … ]
};
```

Tres consecuencias que conviene tener escritas:

- Una sola forma para el escritor, el lector, el panel y los documentos: no hay arreglo
  con propiedades ni alias que se apunte a sí mismo.
- `JSON.stringify(window.REGISTROS)` devuelve el archivo completo, con sus metadatos.
- `HISTORICOS` sigue siendo un **objeto** (`window.HISTORICOS.series.rows`). La forma de
  objeto con `measurements` es solo de `REGISTROS`.

Para regenerar los datos de prueba:

```bash
python3 datos/generar_datos.py
```

El generador está en `datos/` y escribe en `sitio/datos/`. Si cambia el formato, se cambia
ahí y no a mano.

### Los campos

Los siete del dispositivo son los mismos que escribe el firmware
(`presentacion/firmware/maipo_vigia_esp32.ino`), para que una medición real entre sin
traducir nada:

```json
{
  "id": "MV-20261114-0016",
  "station_id": "SJM-PLAZA-01",
  "timestamp": "2026-11-14T20:30:00-03:00",
  "rainfall_mm": 1.6,
  "temperature_c": 14.2,
  "source": "automatico",
  "verified": false,
  "published_at": "2026-11-14T22:41:00-03:00",
  "estado": "simulado",
  "tube_empty": false,
  "note": null
}
```

`published_at`, `estado`, `tube_empty` y `note` los agrega la copia publicada, no el sensor.

### Cómo lee la página esos campos

- **No renombra ninguna clave.** `source` vale `automatico` o `manual`; `estado` es la
  condición del dato (hoy `simulado`) y no el canal.
- **Valida antes de mostrar.** Un registro sin las siete claves, o con un tipo que no
  corresponde, no se muestra: aparece un bloque que dice cuántos quedaron fuera y por qué.
  No se completa a mano ni se convierte un tipo en silencio.
- **Ordena por instante**, no por comparación de texto, para que una serie con desfases
  distintos no se ordene mal.
- **Suma solo el sensor.** El acumulado y la intensidad usan únicamente las lecturas con
  `source: "automatico"`. La lectura manual no suma: se compara, y su fila muestra un
  guion largo en el acumulado.
- **Dos acumulados distintos, declarados.** El de **24 h** es una ventana que termina en la
  última lectura del sensor y se rotula como *ventana incompleta* si la serie no la cubre.
  El **total del archivo** suma todo lo que trae el archivo y dice cuál es su período. Si
  los dos números coinciden —porque la serie dura menos de 24 h— la página lo dice en vez
  de dar a entender que son lo mismo.
- **La intensidad es un promedio del período**, no la intensidad de un intervalo, y el texto
  lo aclara.
- **El acumulado por fila se reinicia** cuando se vacía el tubo (`tube_empty`), y el vaciado
  queda marcado en su fila y en el gráfico.
- **La antigüedad va al lado de la fecha.** Una publicación de más de seis horas se marca
  como dato antiguo.
- **El estado del dato se declara arriba.** El bloque de cabecera responde sin desplazarse:
  última lectura del sensor, hace cuánto se registró, acumulado de 24 h con su advertencia de
  ventana incompleta y estado (al día, atrasado o sin datos). La referencia es la última
  publicación y, si el archivo no la declara, la última lectura.
- **La ubicación del punto sale del archivo.** El sector, la comuna, la región y la altitud
  se muestran tal como los declara `station`, con su carácter aproximado; la página nunca
  escribe una dirección ni inventa un punto que no esté en los datos.
- **La tabla se filtra por canal y por punto.** Los botones de canal usan los valores de
  `source`; los de punto se generan con los `station_id` del archivo, uno por punto.

## 4. Reglas que no se rompen

1. **El rótulo de simulación se queda.** Mientras no haya mediciones reales, la banda
   «Datos simulados para prueba» va visible arriba del panel y dentro de cada archivo que se
   descarga.
2. **Nada de datos personales.** Sin nombres, teléfonos, correos, RUT ni direcciones
   exactas. Los puntos se identifican por su sector aproximado y su `station_id`, tal como
   vienen en el archivo.
3. **La hora de medir no es la hora de publicar.** Se muestran las dos.
4. **Un vacío es un vacío.** No se rellena con cero.
5. **Un total diario no se convierte en intensidad horaria.**
6. **Ningún total se presenta como lo que no es.** El acumulado de 24 h, el total del
   archivo y la intensidad media son tres cuentas distintas y se dicen por su nombre.
7. **El histórico vive aparte**, con su fuente y su permiso de uso.
8. **La página no se presenta como un servicio en vivo.** Dice, arriba y en el pie, que es
   una copia estática de la última publicación y muestra la hora de actualización. No usa
   «tiempo real», «en vivo» ni «streaming» para describir lo que no lo es.
9. **No hay narrativa de proyecto en la página.** No aparecen equipos, cursos, ferias ni
   repositorios: el panel muestra el dato y lo que hace falta para leerlo. «Maipo Vigía» es
   el nombre del instrumento.

## 5. Los cinco estados del dato

El sistema visual define cinco condiciones. En esta página se ven así:

| Estado | Dónde aparece | Cuándo |
|---|---|---|
| Carga en curso | Bloque bajo el título del panel, con barra que avanza | Antes de que `app.js` arme el registro: está en el marcado, no se agrega después |
| Error de carga | Bloque con marca tachada y borde óxido | El archivo de datos no llegó o no tiene la forma esperada |
| Sin datos | Bloque bajo el título, y la celda «sin dato» de históricos | El archivo no trae registros, o un día de la serie no tiene total |
| Dato antiguo | Marca en línea en el estado del bloque de arriba y en la fecha de publicación de la ficha | La publicación declarada tiene más de seis horas |
| Período incompleto | Bloque bajo las cifras | La serie no cubre la ventana de 24 h que se informa |

El detalle de cada pieza está en `panel-web/diseno/sistema.md` §8; la muestra navegable,
en `panel-web/diseno/muestra.html`.

El bloque de arriba agrega un estado propio del dato, que no es uno de los cinco del
sistema visual: **sin fecha** (marca neutra), cuando el archivo tiene registros pero ni la
publicación ni la última lectura del sensor tienen una fecha válida. En ese caso no se
calcula ninguna antigüedad ni se dice «al día»: se escribe «sin fecha» y se explica por qué.

## 5.1 Cómo se lee la página

Las secciones siguen el orden en que se necesita el dato: **Datos** (la última lectura, el
estado y el acumulado de 24 h), **Registro** (ficha, gráfico, cifras, tabla y descargas),
**Estado del dato** (cuándo se publicó y si está al día o atrasado), **Instrumento** (cómo
mide y de qué depende la lectura), **Formato** (los campos del archivo) e **Históricos**
(series anteriores, aparte).

## 6. Estructura

```
sitio/
  index.html              la página completa
  assets/estilos.css      estilos
  assets/app.js           validación, gráfico, tabla, estados, descargas y navegación
  assets/fuentes/         tres tipografías, para que no dependa de internet
  datos/registros.js      estación, publicación y las mediciones
  datos/historicos.js     serie histórica
  img/diseno_conceptual.jpg  dibujo del instrumento (25-10-2026)
```

Sin dependencias, sin compilación, sin paquetes. Lo único que hace falta para editarla es un
editor de texto.

## 7. Qué se verificó y qué no

**Verificado** (navegador sin interfaz, 360, 768 y 1280 px, por `file://` y por servidor
local):

- La página carga sin errores de consola y sin peticiones a servicios externos.
- Si `assets/app.js` no se ejecuta (archivo bloqueado o error de sintaxis), a los 3 s un
  respaldo mínimo escrito en el propio `index.html` muestra el bloque de error, en vez de
  dejar el bloque de carga avanzando para siempre.
- Las 41 filas de la tabla se generan desde el archivo de datos; el gráfico dibuja 40
  barras, la línea del acumulado y el vaciado del tubo.
- El filtro por canal (todo, sensor, manual) y el filtro por punto cambian la tabla y
  anuncian cuántas filas quedan.
- Las descargas CSV y JSON se generan, se abren y declaran que son simuladas.
- El bloque de arriba muestra la última lectura, su antigüedad, el acumulado de 24 h con la
  marca de ventana incompleta y el estado del dato; en 360, 390 y 1280 px se ve sin
  desplazarse.
- La ubicación del punto y el sector de la tabla salen de los metadatos del archivo, no de
  texto escrito a mano.
- El acumulado de 24 h, el total del archivo y la intensidad media salen de cuentas
  distintas y comprobables a mano sobre el archivo.
- Los cinco estados se ven: se probaron con archivos de datos preparados para cada caso
  (sin archivo, vacío, con registros fuera del contrato, solo manual, sin altitud y sin
  `app.js`).
- Contraste AA de todo el texto renderizado, sin desborde horizontal y sin errores de
  consola en los tres anchos, medido con `panel-web/diseno/verificar.mjs`.
- Navegación por teclado con foco visible, `th` con `scope`, texto alternativo en la única
  imagen y `aria-current` en el índice de secciones.
- La impresión: la pantalla oscura se imprime en papel y la tabla completa cabe en la hoja.

- La publicación en GitHub Pages (`https://drchifuu.github.io/MaipuSeguritos/`, desde
  `docs/` de `main`) responde 200 y sirve los mismos archivos de `sitio/`.

**No verificado:**

- La prueba con cinco personas que exige el informe (cuatro deben identificar punto, unidad,
  período, fuente y publicación sin ayuda).
- Conexión con una estación real, que no existe.
