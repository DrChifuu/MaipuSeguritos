# Maipo Vigía — sitio del tablero comunitario

Tablero de lluvia y caminos del Cajón del Maipo. Es una página estática: se abre con doble
clic o desde GitHub Pages, sin servidor propio ni dependencias externas.

## Cómo abrirlo

- **En el computador:** abrir `index.html` con el navegador. Funciona sin internet.
- **Publicado:** la carpeta `docs/` del repositorio se sirve en
  <https://drchifuu.github.io/MaipuSeguritos/>.

## Qué hay dentro

```
index.html            armazón: barra, pestañas, solapas, hojas laterales, kiosco
assets/maipo.css      todo el estilo, sin dependencias externas
assets/maipo.js       pantallas y comportamiento
assets/almacen.js     la puerta de los datos: local hoy, Supabase cuando se configure
assets/fuentes/       IBM Plex Sans y Spectral, locales
datos/config.js       versión, zona horaria, umbrales y credenciales de Supabase
datos/semilla.js      puntos, caminos, observadores y archivos de ejemplo
supabase/esquema.sql  tablas, políticas y funciones de la fase 2
supabase/LEEME.md     cómo conectar la base de datos, paso a paso
```

Las páginas antiguas (`zona.html`, `camino.html`, `archivo.html`, etc.) redirigen a la pestaña
correspondiente de `index.html`, también cuando el sitio se abre como archivo local.

## Las pestañas

| Pestaña | Para quién | Qué hace |
|---|---|---|
| Ahora | todos | lluvia de los seis puntos y estado del camino |
| Camino | todos | estado de los tramos, informar un cambio, historial |
| Registrar | con tarjeta | lectura del tubo en tres pasos |
| Archivo | todos | archivos publicados, tablero y tabla con filtros |
| Directiva | directiva | por validar, ingreso oficial, observadores, datos, subir |
| Ayuda | todos | estados, milímetros, alertas, sin internet |

Contacto, kiosco y ayuda también están en el pie. La barra superior permite agrandar la letra
con **A+**; el modo Kiosco se abre desde el pie y se cierra con cinco toques en la marca o con
`Escape`.

### Estado inicial

Los seis puntos parten **sin equipo instalado**: se muestran como «Equipo no instalado» y «Sin
dato», sin lecturas ni avisos previos. Los seis tramos de camino tampoco tienen reporte. El
archivo trae cuatro planillas de ejemplo para mostrar el tablero y la tabla.

## Roles y tarjetas

- **Público:** ve lluvia, caminos, archivos y ayuda; puede avisar algo sin registrarse.
- **Observador:** entra con el código de su tarjeta (8 dígitos) y una clave de 4 números.
  Registra lecturas y ve su historial reciente.
- **Directiva:** además valida lecturas, registra datos oficiales, administra observadores,
  crea o edita puntos y publica archivos históricos.

La sesión dura 8 horas o 30 minutos sin uso. Tres intentos fallidos bloquean la hoja por
5 minutos.

### Tarjetas de prueba

| Tarjeta | Clave | Rol |
|---|---|---|
| 10042042 | 1234 | Observador San Alfonso |
| 10042051 | 2222 | Observadora El Manzano |
| 90000001 | 9999 | Directiva |

**Cambiar estas claves antes de usar datos reales.** Mientras el sitio esté en modo local, la
validación ocurre en el navegador; sirve para demostrar el flujo, no para proteger datos.

## Qué puede hacer el sitio

- **Semáforo con cuatro estados** (Normal, Ojo, Peligro, Sin dato) y cifras que siempre dicen
  hace cuánto se midieron. Una medición vale **1 hora (60 minutos)**; al superar ese plazo, el
  punto pasa a «Sin dato». Los tiempos («hace 4 min», «hace 15 horas», «Actualizado ahora») y
  la cuenta regresiva del bloqueo avanzan solos, sin recargar ni mover el foco.
- **Registro de lecturas** con teclado numérico, límite de 0 a 300 mm y un decimal, lectura
  atrasada de hasta 7 días y foto comprimida en el mismo navegador.
- **Validación de a una lectura**: validar, corregir (crea una fila nueva y conserva la
  original) o rechazar con motivo. El semáforo público solo se mueve con datos validados.
- **Ingreso oficial** de planillas, equipos automáticos o verificaciones en terreno. Si la
  medición tiene hasta 1 hora, actualiza el tablero; si es más antigua, queda en el historial y
  la pantalla lo dice.
- **Puntos de medición**: crear, editar y quitar; un punto nuevo crea también su tramo de
  camino. Las acciones destructivas usan una hoja de confirmación, nunca `window.confirm`.
- **Observadores**: alta con tarjeta y clave aleatorias, y reposición de clave o de tarjeta
  desde la ficha, mostrando el resultado en la misma hoja.
- **Carga de históricos** en cuatro pasos:
  - CSV con reglas RFC 4180 (comillas y comas internas).
  - XLSX nativo, sin librerías, usando `DecompressionStream`; si el navegador no lo soporta,
    la pantalla lo dice y sugiere guardar como CSV. Nunca inventa filas.
  - Fechas `AAAA-MM-DD`, `DD/MM/AAAA` y `DD-MM-AAAA`, con hora opcional.
  - Borradores que se guardan, retoman y descartan.
  - Reglas de conflicto para fechas repetidas: saltar, mezclar o reemplazar.
  - Resumen real: acumulado, día más lluvioso, días con lluvia, por punto y por hora.
  - Publicación con 24 horas para deshacerla.
- **Archivo**: tablero, tabla filtrable por punto y texto, mapeo de columnas cuando el archivo
  no trae los nombres del proyecto, y descarga en CSV con BOM. El formato predeterminado es
  **CSV**, el más liviano y usable. Cada jornada cerrada genera sola
  `lluvia_diaria_AAAA-MM-DD.csv`; la directiva también puede forzar el cierre del día con
  «Generar cierre de hoy (CSV)».
- **Avisos vecinales**: en `Avisar algo` y en `Camino › Informar` hay un enfriamiento de **2 minutos** entre envíos, con cuenta regresiva en vivo. Mientras el aviso propio siga en
  revisión se puede **cancelar**; al hacerlo desaparece de la cola y del contador de pendientes,
  sin liberar el enfriamiento.
- **Kiosco**: estaciones ordenadas por gravedad, tres por página, cambio cada 15 segundos,
  flechas del teclado, reloj con la fecha de Chile e indicador de página. Usa una paleta
  pizarra-carbón de alto contraste, con tarjetas e insignias diferenciadas por estado.
- **Accesibilidad y layout**: alto fijo, sin scroll en Ahora › Lluvia a 1280×800; textos desde
  16 px; controles desde 56 px; foco atrapado en las hojas laterales; flechas entre pestañas y
  solapas; enlace para saltar al contenido.

## Los datos

Al abrir por primera vez, el sitio copia la semilla a `localStorage` y trabaja sobre esa copia.
Todo lo que se registra, valida o carga queda en ese navegador.

- **Respaldo:** Directiva → Datos → Descargar. Genera un JSON con puntos, caminos, lecturas,
  observadores y archivos.
- **Restaurar:** Directiva → Datos → Cargar. Reemplaza el estado completo.
- **Volver al estado inicial:** Directiva → Datos → Restaurar ejemplo (deja los puntos sin equipo y sin lecturas).
- **Versión del formato:** `datos/config.js` sella cada guardado. Si cambia la versión, el sitio
  descarta el estado viejo y vuelve a la semilla.

Antes de publicar en Supabase, el sitio elimina de la copia la sesión y las credenciales de las
tarjetas (`card` y `pin`); solo conserva los dos últimos dígitos de la tarjeta. El servidor hace
el mismo saneamiento otra vez antes de guardar el snapshot.

## Configuración

`datos/config.js` reúne lo que se ajusta sin tocar la aplicación:

- `version`: versión del formato del estado.
- `zonaHoraria`: `America/Santiago`; todas las fechas y horas se calculan con ella.
- `umbrales`: 5 y 15 mm por hora, 60 minutos (1 hora) de frescura y de ventana del tablero,
  además del estado `provisional` y su versión.
- `formatoDataset`: `CSV`, el formato predeterminado de la plataforma.
- `cooldownAvisoSeg`: 120 segundos entre avisos de un mismo vecino.
- `supabase`: URL y clave pública `anon`.
- `auth.modo`: `local` o `supabase`.

## Conectar Supabase

Cuando `datos/config.js` tenga URL y `anonKey`, el mismo sitio lee y publica en la base de
datos. Las funciones esperadas están en `supabase/esquema.sql` y el paso a paso en
`supabase/LEEME.md`. En resumen:

- el público lee el último tablero publicado;
- la tarjeta se valida contra `mv_entrar`;
- la clave del servidor viaja en `Authorization: Bearer <anonKey>` y el token de sesión en el
  cuerpo como `p_token`;
- solo la directiva puede publicar (`mv_guardar_estado`) y administrar tarjetas;
- `mm` acepta nulo para representar «Sin dato».

## Verificación

Desde la raíz del repositorio:

```bash
node tests/verificar.mjs
```

La suite usa Node estándar y Obscura por CDP (`ws://127.0.0.1:9222`), levanta un servidor
efímero sobre `docs/` y comprueba unidades del almacén, layout a 1280×800 y 390×844, barrido de
vistas, flujos de sesión, validación, puntos, históricos, cierre diario CSV, cooldown y
cancelación de avisos, paleta del kiosco, además de excepciones JS y diálogos nativos.

## Datos de ejemplo

El tablero parte sin datos de terreno: los seis puntos dicen «Equipo no instalado» y «Sin
dato», y los caminos no tienen reporte. Las cuatro planillas de Archivo son de ejemplo, para
mostrar el tablero y la tabla; la franja del pie dice «Datos de ejemplo» mientras el sitio esté
en modo local. Los umbrales son provisionales y se acuerdan con Sernageomin; la vigencia del
dato es de 1 hora. El semáforo es apoyo comunitario: **no avisa de aluviones ni reemplaza a
SENAPRED, Carabineros ni Bomberos**.
