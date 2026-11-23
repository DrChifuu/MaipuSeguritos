# Maipo Vigía — sitio del tablero comunitario

Tablero de lluvia y caminos del Cajón del Maipo, con pestañas, ingreso por tarjeta y archivos
históricos. Es una página estática: se abre con doble clic o desde GitHub Pages, sin servidor
propio.

## Cómo abrirlo

- **En el computador:** abrir `index.html` con el navegador. Funciona sin internet.
- **Publicado:** la carpeta `docs/` del repositorio se sirve como sitio en GitHub Pages.

## Qué hay dentro

```
index.html            armazón: barra, pestañas, solapas, hojas laterales, kiosco
assets/maipo.css      todo el estilo, sin dependencias externas
assets/maipo.js       pantallas y comportamiento
assets/almacen.js     la puerta de los datos: local hoy, Supabase cuando se configure
assets/fuentes/       IBM Plex Sans y Spectral, locales
datos/config.js       configuración: modo local, url y clave de Supabase
datos/semilla.js      los seis puntos, caminos, observadores y archivos de ejemplo
supabase/esquema.sql  tablas, políticas y funciones para la fase 2
supabase/LEEME.md     cómo conectar la base de datos, paso a paso
```

## Las pestañas

| Pestaña | Para quién | Qué hace |
|---|---|---|
| Ahora | todos | lluvia de los seis puntos y estado del camino |
| Camino | todos | estado de los tramos, informar un cambio, historial |
| Registrar | con tarjeta | lectura del tubo en tres pasos |
| Archivo | todos | archivos publicados, tablero y tabla |
| Directiva | directiva | por validar, ingreso oficial, observadores, datos, subir |
| Ayuda | todos | estados, milímetros, alertas, sin internet |

Dentro de **Directiva**:

- **Por validar**: lecturas y avisos que esperan revisión, de a uno.
- **Oficial**: ingreso de planillas, equipos automáticos o verificaciones en terreno. Entra
  ya validado; si es de la última hora y media, también mueve el tablero.
- **Observadores**: padrón con alias y estado, sin datos personales.
- **Datos**: puntos de medición (crear, editar, quitar si no tienen lecturas) y respaldo
  completo en JSON.
- **Subir**: archivos CSV o XLSX en cuatro pasos, con columnas, errores y duplicados.

## Tarjetas de prueba

Mientras el sitio está en modo local, las tarjetas viven en `datos/semilla.js`:

| Tarjeta | Clave | Rol |
|---|---|---|
| 10042042 | 1234 | Observador San Alfonso |
| 10042051 | 2222 | Observadora El Manzano |
| 90000001 | 9999 | Directiva |

**Cambiar estas claves antes de publicar el sitio con datos reales.** En modo local la
validación ocurre en el navegador; sirve para demostrar el flujo, no para proteger datos.
En la fase 2 la clave se valida en el servidor (ver `supabase/LEEME.md`).

## Los datos

Al abrir por primera vez, el sitio copia la semilla a `localStorage` y trabaja sobre esa copia.
Todo lo que se registra, valida o carga queda en ese navegador.

- **Respaldo:** Directiva → Datos → Descargar. Genera un JSON con puntos, caminos, lecturas,
  observadores y archivos.
- **Restaurar:** Directiva → Datos → Cargar. Reemplaza el estado completo.
- **Volver al ejemplo:** Directiva → Datos → Restaurar ejemplo.
- **Borrar todo:** limpiar los datos del sitio en el navegador (o la clave
  `maipo_vigia_estado_v2` en el almacenamiento local).

Cuando `datos/config.js` tenga `url` y `anonKey` de Supabase, el mismo sitio lee y publica en la
base de datos. No hay que cambiar pantallas: solo ese archivo.

## Datos de ejemplo

Las cifras —18,4 mm en San Alfonso, camino restringido por Carabineros— son de demostración.
La franja del pie dice «Datos de ejemplo» mientras el sitio esté en modo local. Los umbrales
(5 y 15 mm en la última hora) son provisionales y se acuerdan con SERNAGEOMIN.

El semáforo es apoyo comunitario: **no avisa de aluviones ni reemplaza a SENAPRED, Carabineros
ni Bomberos**.

## Reglas de la interfaz

- El alto de la página es el de la ventana. Lo único que se desplaza es el panel de contenido.
- Si algo no cabe, se parte en otra solapa; nunca se estira la página.
- Cuatro estados con forma, palabra y color: Normal, Ojo, Peligro, Sin dato. Un punto sin
  lectura va en gris con «—», nunca en verde ni con cero.
- Cada cifra dice hace cuánto se midió, y cada estado de camino dice quién lo informó.
- Nada de letra bajo 16 px ni controles bajo 56 px.
- Sin CDN, sin Google Fonts, sin iconos de fuente, sin mapas externos.

## Publicar

La carpeta `docs/` es la que se publica. El archivo `.nojekyll` ya está para que GitHub Pages
no procese el sitio con Jekyll.

Para actualizar: reemplazar los archivos, confirmar el cambio (`git commit`) y subirlo
(`git push`). GitHub Pages tarda alrededor de un minuto.

## Pendientes conocidos

- Las fotos de las lecturas son una marca, no un archivo: falta Storage.
- La validación de tarjeta es local hasta conectar Supabase.
- No hay recuperación de clave ni expulsión de una tarjeta perdida desde el sitio; se hace
  editando la semilla o, en fase 2, con una función del servidor.
- El kiosco está pensado para 1920×1080; en pantallas menores las tarjetas se achican.
