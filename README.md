# Maipo Vigía

Tablero comunitario de lluvia y caminos para el Cajón del Maipo. Reúne lo que miden los
pluviómetros de la red vecinal, el estado de los tramos de la ruta y los archivos históricos,
en una página que funciona con mala señal y sin instalar nada.

**Sitio publicado:** <https://drchifuu.github.io/MaipuSeguritos/>

## El proyecto

- **Asignatura:** Capstone Intermedio 2026 · INGT1034-001
- **Institución:** Universidad Mayor
- **Equipo:** Maipo Seguritos
- **Desafío:** 09 · Red comunitaria de pluviómetros para la alerta temprana de aluviones en
  San José de Maipo.

El equipo trabaja con la junta de vecinos y con observadores acreditados de seis puntos del
valle: Plaza de Armas, El Canelo, El Manzano, El Melocotón, San Alfonso y San Gabriel. Hoy los
seis puntos están **sin equipo instalado**: el tablero los muestra como «Equipo no instalado» y
«Sin dato», sin lecturas ni avisos previos. Cuando se instalen, la red combinará equipos
automáticos con tubos comunitarios leídos a mano. El sitio ordena esa información para que
cualquier vecino pueda responder tres preguntas: cuánto llovió, cómo está el camino y de cuándo
es el dato.

## Qué resuelve

- **Lluvia al día por punto**, con cuatro estados que combinan forma, palabra y color:
  Normal, Ojo, Peligro y Sin dato. Un punto sin lectura se muestra en gris, nunca en verde.
  Una medición vale **1 hora (60 minutos)**; pasado ese plazo, el punto pasa a «Sin dato».
- **Estado de los caminos informado por personas**, con fuente y hora. Un tramo sin reporte
  dice «Sin dato»; no se deduce del clima ni se supone abierto.
- **Registro y validación del dato comunitario**: el observador entra con su tarjeta, registra
  la lectura del tubo y la directiva la valida antes de que mueva el semáforo.
- **Archivo abierto**: carga de planillas CSV o XLSX, tablero, tabla filtrable y descarga.
  El formato predeterminado es **CSV**, el más liviano y usable. Cada jornada cerrada genera
  sola `lluvia_diaria_AAAA-MM-DD.csv`; la directiva también puede forzar el cierre del día con
  «Generar cierre de hoy (CSV)».
- **Avisos vecinales** con enfriamiento de **2 minutos** entre envíos y opción de **cancelar el
  aviso propio** mientras siga en revisión, tanto en `Avisar algo` como en `Camino › Informar`.
- **Ingreso oficial** de planillas, equipos automáticos o verificaciones en terreno.
- **Kiosco de alto contraste** con paleta pizarra-carbón, tarjetas diferenciadas por estado e
  insignias sólidas.

## Cómo está hecho

Sitio estático, sin compilación y sin dependencias externas:

- HTML, CSS y JavaScript escritos a mano. Sin CDN, sin Google Fonts, sin fuentes de iconos.
- Tipografías locales (`docs/assets/fuentes/`) e iconos SVG en línea.
- Una sola página con pestañas y solapas; el alto es el de la ventana y solo se desplaza el
  panel de contenido.
- Datos en el navegador (`localStorage`) con una capa de almacén preparada para Supabase.
- Accesibilidad: piso de 16 px, controles de 56 px, foco visible, trampa de foco en hojas
  laterales y navegación por teclado.

## Estructura del repositorio

```
docs/                       sitio publicado por GitHub Pages
  index.html                armazón: barra, pestañas, hojas, kiosco
  assets/maipo.css          estilos
  assets/maipo.js           pantallas y comportamiento
  assets/almacen.js         almacén local y adaptador Supabase
  assets/fuentes/           IBM Plex Sans y Spectral
  datos/config.js           versión, zona horaria, umbrales y Supabase
  datos/semilla.js          puntos, caminos, observadores y archivos de ejemplo
  supabase/esquema.sql      tablas, RLS y funciones para la fase 2
  supabase/LEEME.md         cómo conectar la base de datos
  LEEME.md                  guía de uso del sitio
  archivo.html, camino.html, …   redirecciones a las pestañas actuales
tests/verificar.mjs         suite de verificación (fuera del sitio publicado)
bitacora/                   bitácora del equipo, sesiones S01 a S11
```

## Bitácora

| Sesión | Tema |
|---|---|
| S01 | Identidad del equipo y desafío |
| S02 | Observación en terreno y conexión con el desafío |
| S03 | Estado del arte, benchmark y conexión con el desafío |
| S04 | Reunión con Sernageomin y definición de necesidades |
| S05 | Constancia de sesión no realizada (reconstruida) |
| S06 | Revisión de materiales y coordinación de la propuesta |
| S07 | Selección del pluviómetro automatizado y revisión docente |
| S08 | Informe compartido y preparación de la entrega de Unidad 2 |
| S09 | Presentación provisional de Maipo Vigía y estado del avance |
| S10 | Cierre de la Unidad 2, calificación y recepción del kit |
| S11 | Presentación de avances, actividad de equipo y organización de la feria |

## Abrir en local

Con doble clic en `docs/index.html` el sitio funciona igual: no usa peticiones externas. Para
probarlo con la misma dirección base que GitHub Pages:

```bash
cd docs
python3 -m http.server 8080
# abrir http://127.0.0.1:8080/
```

Los datos se guardan en el navegador de cada equipo. Para moverlos entre computadores se usa
**Directiva → Datos → Descargar** (respaldo JSON).

## Conectar Supabase

El sitio funciona sin base de datos. Para que los datos sean los mismos para todos:

1. Crear un proyecto en <https://supabase.com>.
2. Ejecutar `docs/supabase/esquema.sql` completo en el SQL Editor.
3. Copiar la URL del proyecto y la clave `anon` en `docs/datos/config.js`.
4. Poner `auth.modo: 'supabase'`.
5. Seguir el detalle de `docs/supabase/LEEME.md`.

La clave `service_role` no se usa en el sitio. El público solo lee; toda escritura pasa por
funciones que validan una sesión de tarjeta.

## Verificación

La suite usa solo Node estándar y el WebSocket nativo del navegador Obscura:

```bash
node tests/verificar.mjs
```

Requiere el daemon de Obscura en `ws://127.0.0.1:9222`. La suite levanta un servidor HTTP
efímero sobre `docs/`, ejecuta las pruebas y lo cierra. Verifica:

- Saneamiento de credenciales y versionado del almacén.
- `Authorization: Bearer <anonKey>` con `p_token` en el cuerpo.
- Layout exacto a 1280×800 y 390×844.
- Barrido de todas las vistas sin textos bajo 16 px ni controles bajo 56 px.
- Rutas protegidas, bloqueo tras tres fallos, lectura de observador, validación y corrección,
  ingreso oficial, puntos, carga de históricos, borradores, deshacer, cierre diario CSV,
  cooldown y cancelación de avisos, y paleta del kiosco.
- Cero excepciones JS y cero diálogos nativos durante el recorrido.

Termina con código 0 si todo pasa.

## Datos de ejemplo y límites

- El tablero parte **sin datos de terreno**: los seis puntos dicen «Equipo no instalado» y
  «Sin dato», los caminos no tienen reporte y no hay lecturas ni avisos previos.
- Los cuatro archivos que aparecen en Archivo son **de ejemplo**, para mostrar el tablero y la
  tabla. El pie del sitio dice «Datos de ejemplo» mientras no haya una base conectada.
- Los umbrales de 5 y 15 mm por hora son **provisionales**, a la espera de acordarlos con
  Sernageomin. La vigencia del dato es de 1 hora.
- Solo San Alfonso tiene una quebrada documentada (Estero San Alfonso). Las demás zonas no
  tienen un nombre de quebrada asignado.
- El semáforo es **apoyo comunitario**: no avisa de aluviones ni reemplaza a SENAPRED,
  Carabineros ni Bomberos.
