# Conectar Maipo Vigía a Supabase

El sitio funciona hoy **sin base de datos**: guarda en el navegador (`localStorage`). Este
documento es la fase 2, para cuando los datos tengan que vivir en un servidor y ser los mismos
para todos.

No hay que reescribir la página. El sitio ya habla con una sola puerta, `assets/almacen.js`, y
esa puerta cambia de destino cuando `datos/config.js` tiene `url` y `anonKey`. Las funciones que
espera están en `esquema.sql`.

---

## 1. Crear el proyecto

1. Entrar a <https://supabase.com> y crear un proyecto (plan gratuito sirve para empezar).
2. Guardar la contraseña de la base de datos en un lugar seguro. No va en el sitio.
3. Esperar a que el proyecto termine de aprovisionarse.

## 2. Crear las tablas y las funciones

1. En el panel del proyecto: **SQL Editor → New query**.
2. Pegar todo el contenido de `esquema.sql`.
3. Ejecutar (**Run**). No debería devolver errores.
4. Revisar en **Table Editor** que existan `mv_puntos`, `mv_tramos`, `mv_lecturas`,
   `mv_observadores` y `mv_estado_snapshot`.

El script crea además seis puntos, seis tramos y tres tarjetas de ejemplo. **Cambiar las claves
de esas tarjetas antes de publicar** (ver §6).

## 3. Copiar las llaves

En **Project Settings → API**:

- `Project URL` → va en `supabase.url`
- `anon public` → va en `supabase.anonKey`

La clave `anon` es pública por diseño: puede ir en el HTML. Lo que protege los datos son las
políticas RLS y las funciones, no el secreto de esa clave. **La clave `service_role` no se pone
nunca en el sitio.**

## 4. Completar `datos/config.js`

```js
supabase: {
  url: 'https://tuproyecto.supabase.co',
  anonKey: 'eyJhbGciOi...'
},
auth: {
  modo: 'supabase'
}
```

Con esos valores:

- al abrir, el sitio pide `mv_estado_publico()` y muestra el último tablero publicado;
- la tarjeta se valida contra `mv_entrar()`, con la clave hasheada en el servidor;
- los cambios de la directiva se publican con `mv_guardar_estado()`.

Si `url` o `anonKey` están vacíos, todo sigue funcionando en modo local, con la etiqueta
«Datos de ejemplo» en el pie.

## 5. Publicar el tablero

El sitio es estático: no necesita servidor propio, solo GitHub Pages sobre `docs/`.

Para que el tablero público tenga datos:

1. Entrar como directiva en el sitio.
2. Validar o ingresar lecturas.
3. En **Directiva → Datos**, confirmar que el estado es «Supabase».
4. Al guardar, el sitio publica el estado completo en `mv_estado_snapshot`.

El tablero público lee ese snapshot, no consulta las tablas una por una. Es una decisión
deliberada: la página queda rápida, funciona con mala señal y el JSON tiene exactamente la forma
que el sitio ya sabe dibujar.

## 6. Antes de publicar de verdad

- [ ] Cambiar las claves de las tres tarjetas de ejemplo.
- [ ] Borrar o suspender las tarjetas que no correspondan.
- [ ] Definir los umbrales con SERNAGEOMIN y actualizarlos en `datos/config.js` y en el sitio.
- [ ] Probar en el teléfono: entrar, registrar, validar, subir un archivo.
- [ ] Guardar un respaldo (**Directiva → Datos → Descargar**).
- [ ] Activar los respaldos automáticos de Supabase (plan de pago) o programar un `pg_dump`.

## 7. Qué queda pendiente para una segunda iteración

Estas cosas **no** están resueltas por el esquema y hay que decidirlas antes de abrir el sitio
a todo el público:

| Tema | Estado | Qué falta |
|---|---|---|
| Límite de intentos de tarjeta | Básico | Contar intentos por IP en una Edge Function; hoy el bloqueo es local |
| Recuperar una clave | No existe | La directiva debe poder regenerarla desde el panel |
| Crear observadores desde el sitio | Solo local | Función `mv_crear_observador(token, alias, sector)` con hash |
| Reemplazar una tarjeta perdida | No existe | Suspender y crear otra; el historial queda con el alias viejo |
| Datos en vivo entre pestañas | No | Realtime o revalidar cada 2 minutos |
| Fotos de las lecturas | No | Storage + política por carpeta; hoy la foto es solo una marca |
| Aprobación de avisos de camino | Parcial | `mv_confirmar_tramo` existe; falta la cola de avisos |

## 8. Cómo está armado

```
datos/config.js        → url, anonKey y modo de autenticación
assets/almacen.js      → cargar, guardar, traer, entrar, respaldar
supabase/esquema.sql   → tablas, RLS y funciones
assets/maipo.js        → pantallas; no sabe si los datos son locales o remotos
```

`almacen.js` expone:

```js
MV_ALMACEN.modo          // 'local' | 'supabase'
MV_ALMACEN.cargar()      // estado guardado en el navegador
MV_ALMACEN.guardar(e)    // guarda local y empuja al servidor con retardo
MV_ALMACEN.traer()       // estado publicado en Supabase
MV_ALMACEN.entrar(c,p)   // { ok, observador, token }
MV_ALMACEN.respaldar(e)  // descarga un JSON con todo
```

## 9. Seguridad, en simple

- La tarjeta se guarda como hash con un secreto del proyecto; nunca el número.
- La clave se guarda con bcrypt; nunca en texto plano.
- El público solo lee. Escribir exige token de sesión y, para publicar, rol directiva.
- El token dura 8 horas y se guarda en `sessionStorage`: se va al cerrar la pestaña.
- Si alguien copia la clave `anon` del HTML no puede escribir: RLS lo impide.
- Los datos personales no existen: solo alias y sector.

## 10. Volver atrás

Para desconectar Supabase sin perder nada:

1. Vaciar `url` y `anonKey` en `datos/config.js`.
2. Dejar `auth.modo` en `'local'`.
3. El sitio vuelve a leer el estado guardado en el navegador.

Antes de eso, descargar un respaldo desde **Directiva → Datos**.
